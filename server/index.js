import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// ── Supabase Admin Client (service_role) ──────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const INVITE_EMAIL_WINDOW_MS = 60 * 1000;
const INVITE_EMAIL_MAX_ATTEMPTS = 5;
const inviteRateLimitByActor = new Map();

function enforceInviteRateLimit(actorKey) {
  const now = Date.now();
  const existing = inviteRateLimitByActor.get(actorKey) ?? { count: 0, resetAt: now + INVITE_EMAIL_WINDOW_MS };
  if (now > existing.resetAt) {
    inviteRateLimitByActor.set(actorKey, { count: 1, resetAt: now + INVITE_EMAIL_WINDOW_MS });
    return null;
  }
  if (existing.count >= INVITE_EMAIL_MAX_ATTEMPTS) {
    return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  }
  inviteRateLimitByActor.set(actorKey, { ...existing, count: existing.count + 1 });
  return null;
}

function getInviteUrl(inviteId) {
  const appBaseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${appBaseUrl}/invite?token=${inviteId}`;
}

async function sendInviteEmail(email, inviteUrl) {
  const { error: authEmailError } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: inviteUrl,
    },
  });
  if (authEmailError) {
    return { email_sent: false, email_error: authEmailError.message };
  }
  return { email_sent: true, email_error: null };
}

function computeWindowState(lastInboundAt) {
  if (!lastInboundAt) return { windowOpen: false, windowExpiresAt: null };
  const windowExpiresAt = new Date(new Date(lastInboundAt).getTime() + WINDOW_DURATION_MS).toISOString();
  return {
    windowOpen: new Date(windowExpiresAt).getTime() > Date.now(),
    windowExpiresAt,
  };
}

async function resolveContactAndThread({ tenantId, phoneNumber, userId, seedLastMessage }) {
  let contactId = null;
  const { data: existingContact } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_number', phoneNumber)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingContact?.id) {
    contactId = existingContact.id;
  } else {
    const { data: newContact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .insert({
        name: phoneNumber,
        phone_number: phoneNumber,
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single();
    if (contactError || !newContact?.id) throw new Error(contactError?.message || 'Could not create contact');
    contactId = newContact.id;
  }

  let threadId = null;
  const { data: existingThread } = await supabaseAdmin
    .from('whatsapp_threads')
    .select('id')
    .eq('contact_id', contactId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingThread?.id) {
    threadId = existingThread.id;
  } else {
    const { data: newThread, error: threadError } = await supabaseAdmin
      .from('whatsapp_threads')
      .insert({
        contact_id: contactId,
        tenant_id: tenantId,
        last_message: seedLastMessage ?? null,
        last_interaction: new Date().toISOString(),
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single();
    if (threadError || !newThread?.id) throw new Error(threadError?.message || 'Could not create thread');
    threadId = newThread.id;
  }

  return { contactId, threadId };
}

async function getConversationWindowState({ tenantId, phoneNumber, explicitThreadId = null }) {
  let threadId = explicitThreadId;

  if (!threadId) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone_number', phoneNumber)
      .is('deleted_at', null)
      .maybeSingle();

    if (!contact?.id) return { threadId: null, lastInboundAt: null, windowOpen: false, windowExpiresAt: null };

    const { data: thread } = await supabaseAdmin
      .from('whatsapp_threads')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contact.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!thread?.id) return { threadId: null, lastInboundAt: null, windowOpen: false, windowExpiresAt: null };
    threadId = thread.id;
  }

  const { data: lastInboundMsg } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('sent_at, created_at')
    .eq('whatsapp_thread_id', threadId)
    .eq('incoming', true)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastInboundAt = lastInboundMsg?.sent_at || lastInboundMsg?.created_at || null;
  const { windowOpen, windowExpiresAt } = computeWindowState(lastInboundAt);
  return { threadId, lastInboundAt, windowOpen, windowExpiresAt };
}

// ── Middleware: validate service token ────────────────────────
// Frontend sends its own JWT; we verify it's a valid Superadmin session
async function requireSuperadmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  const token = authHeader.split(' ')[1];

  // Verify JWT with Supabase
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  // Check role in users table
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role, tenant_id, enabled')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'Superadmin' || !profile.enabled) {
    return res.status(403).json({ error: 'Forbidden: Superadmin only' });
  }

  req.adminUser = { ...user, profile };
  next();
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const AUTH_BOOTSTRAP_WINDOW_MS = 60 * 1000;
const AUTH_BOOTSTRAP_MAX_ATTEMPTS = 20;
const authBootstrapRateLimitByUser = new Map();

function enforceAuthBootstrapRateLimit(userId) {
  const now = Date.now();
  const existing = authBootstrapRateLimitByUser.get(userId) ?? { count: 0, resetAt: now + AUTH_BOOTSTRAP_WINDOW_MS };
  if (now > existing.resetAt) {
    authBootstrapRateLimitByUser.set(userId, { count: 1, resetAt: now + AUTH_BOOTSTRAP_WINDOW_MS });
    return null;
  }
  if (existing.count >= AUTH_BOOTSTRAP_MAX_ATTEMPTS) {
    return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  }
  authBootstrapRateLimitByUser.set(userId, { ...existing, count: existing.count + 1 });
  return null;
}

/**
 * POST /auth/bootstrap
 * Headers: Authorization Bearer <Supabase access token>
 * Creates public.users profile if missing (OAuth/password parity).
 */
app.post('/auth/bootstrap', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No authorization header' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const retryAfter = enforceAuthBootstrapRateLimit(user.id);
  if (retryAfter) return res.status(429).json({ error: `Rate limit exceeded. Retry in ${retryAfter}s` });

  const email = (user.email ?? '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Auth user has no email' });

  const { data: existing, error: readError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readError) return res.status(500).json({ error: readError.message });
  if (existing?.id) return res.json({ created: false });

  const name =
    user.user_metadata?.full_name
    || user.user_metadata?.name
    || email.split('@')[0]
    || 'Usuario';

  const { error: insertError } = await supabaseAdmin
    .from('users')
    .insert({
      id: user.id,
      name,
      email,
      role: 'Agente',
      tenant_id: null,
      enabled: true,
    });
  if (insertError) return res.status(500).json({ error: insertError.message });
  return res.status(201).json({ created: true });
});

function verifyMetaSignature(req) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !signature.startsWith('sha256=')) return false;
  const incoming = signature.slice('sha256='.length);
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(incoming, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

app.get('/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe' || !challenge || !token) return res.status(400).send('Invalid webhook challenge');

  // Use verify token stored in whatsapp_configurations (app-level webhook setup),
  // fallback to env token for backward compatibility.
  (async () => {
    const { data: cfg } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id')
      .eq('verify_token', String(token))
      .is('deleted_at', null)
      .maybeSingle();

    const envVerifyToken = process.env.META_VERIFY_TOKEN;
    const isValid = Boolean(cfg) || (!!envVerifyToken && token === envVerifyToken);
    if (!isValid) return res.status(403).send('Forbidden');
    return res.status(200).send(String(challenge));
  })().catch(() => res.status(500).send('Webhook verification error'));
});

app.post('/webhooks/meta', async (req, res) => {
  const startedAt = Date.now();
  console.log('[webhook] POST /webhooks/meta received');

  try {
    const payload = req.body ?? {};
    console.log('[webhook] object:', payload.object, '| entries:', Array.isArray(payload.entry) ? payload.entry.length : 0);

    // Signature check — only enforced when META_APP_SECRET is set
    if (process.env.META_APP_SECRET) {
      if (!verifyMetaSignature(req)) {
        console.warn('[webhook] invalid signature — rejecting');
        return res.status(200).json({ ok: true, note: 'invalid_signature' });
      }
      console.log('[webhook] signature OK');
    } else {
      console.log('[webhook] META_APP_SECRET not set — skipping signature check');
    }

    if (!Array.isArray(payload.entry)) {
      console.log('[webhook] no entries — done');
      return res.status(200).json({ ok: true });
    }

    for (const entry of payload.entry) {
      for (const change of (entry.changes ?? [])) {
        const value = change.value ?? {};
        const phoneNumberId = value.metadata?.phone_number_id;
        console.log('[webhook] change field:', change.field, '| phone_number_id:', phoneNumberId);

        // ── 1. Find tenant config by the receiving phone_number_id ──
        let config = null;
        if (phoneNumberId) {
          const { data, error: cfgErr } = await supabaseAdmin
            .from('whatsapp_configurations')
            .select('id, tenant_id, token')
            .eq('phone_number_id', phoneNumberId)
            .is('deleted_at', null)
            .maybeSingle();
          config = data;
          if (cfgErr) console.error('[webhook] config lookup error:', cfgErr.message);
          console.log('[webhook] config found:', config ? `tenant=${config.tenant_id}` : 'null — no match for phone_number_id');
        }

        // ── 2. Handle incoming messages ────────────────────────────
        if (Array.isArray(value.messages)) {
          console.log('[webhook] messages count:', value.messages.length);
          for (const msg of value.messages) {
            const from = msg.from;
            const text = msg.text?.body ?? msg.type ?? '';
            console.log('[webhook] msg from:', from, '| type:', msg.type, '| text:', text.slice(0, 80));

            if (!config || !from) {
              console.warn('[webhook] skipping message — no config or no from');
              continue;
            }

            const tenantId = config.tenant_id;

            // Upsert contact
            let contactId;
            const { data: existingContact, error: cErr } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('phone_number', from)
              .is('deleted_at', null)
              .maybeSingle();
            if (cErr) console.error('[webhook] contact lookup error:', cErr.message);

            if (existingContact) {
              contactId = existingContact.id;
              await supabaseAdmin.from('contacts').update({ last_interaction: new Date().toISOString() }).eq('id', contactId);
              console.log('[webhook] existing contact:', contactId);
            } else {
              const displayName = value.contacts?.[0]?.profile?.name ?? from;
              const { data: newContact, error: ncErr } = await supabaseAdmin
                .from('contacts')
                .insert({ name: displayName, phone_number: from, tenant_id: tenantId })
                .select('id')
                .single();
              if (ncErr) console.error('[webhook] contact insert error:', ncErr.message);
              contactId = newContact?.id;
              console.log('[webhook] created contact:', contactId, 'name:', displayName);
            }
            if (!contactId) { console.error('[webhook] no contactId, skipping'); continue; }

            // Upsert thread
            let threadId;
            const { data: existingThread, error: tErr } = await supabaseAdmin
              .from('whatsapp_threads')
              .select('id')
              .eq('contact_id', contactId)
              .eq('tenant_id', tenantId)
              .is('deleted_at', null)
              .maybeSingle();
            if (tErr) console.error('[webhook] thread lookup error:', tErr.message);

            if (existingThread) {
              threadId = existingThread.id;
            } else {
              const { data: newThread, error: ntErr } = await supabaseAdmin
                .from('whatsapp_threads')
                .insert({ contact_id: contactId, tenant_id: tenantId, last_message: text, last_interaction: new Date().toISOString() })
                .select('id')
                .single();
              if (ntErr) console.error('[webhook] thread insert error:', ntErr.message);
              threadId = newThread?.id;
              console.log('[webhook] created thread:', threadId);
            }
            if (!threadId) { console.error('[webhook] no threadId, skipping'); continue; }

            // Insert message
            const { error: msgErr } = await supabaseAdmin
              .from('whatsapp_messages')
              .insert({
                whatsapp_thread_id: threadId,
                message_text: text,
                incoming: true,
                read: false,
                sent_at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
              });
            if (msgErr) console.error('[webhook] message insert error:', msgErr.message);
            else console.log('[webhook] message saved OK in thread:', threadId);

            // Update thread snapshot
            const inboundAtIso = msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString();
            const inboundWindow = computeWindowState(inboundAtIso);

            await supabaseAdmin
              .from('whatsapp_threads')
              .update({
                last_message: text,
                last_interaction: new Date().toISOString(),
                last_inbound_at: inboundAtIso,
                window_open: inboundWindow.windowOpen,
                window_expires_at: inboundWindow.windowExpiresAt,
              })
              .eq('id', threadId);

            await emitNotificationEvent({
              tenantId,
              actorUserId: null,
              eventType: NOTIFICATION_EVENT_TYPES.THREAD_INBOUND_MESSAGE,
              entityType: 'whatsapp_thread',
              entityId: threadId,
              payload: {
                thread_id: threadId,
                contact_id: contactId,
                contact_phone: from,
                preview: String(text || '').slice(0, 120),
              },
              roles: ['Agente', 'Admin'],
              title: `Nuevo mensaje de ${value.contacts?.[0]?.profile?.name || from}`,
              body: String(text || '').slice(0, 180) || 'Nuevo mensaje recibido en bandeja.',
              severity: 'info',
              actionUrl: '/bandeja',
            }).catch((error) => console.error('[notifications] inbound message emit error:', error.message));
          }
        }

        // ── 3. Handle status updates ────────────────────────────────
        if (Array.isArray(value.statuses) && config) {
          for (const status of value.statuses) {
            console.log('[webhook] status update:', status.status, 'recipient:', status.recipient_id);
            if (status.status === 'read') {
              const { data: contact } = await supabaseAdmin
                .from('contacts').select('id').eq('tenant_id', config.tenant_id).eq('phone_number', status.recipient_id).maybeSingle();
              if (contact) {
                const { data: thread } = await supabaseAdmin
                  .from('whatsapp_threads').select('id').eq('contact_id', contact.id).maybeSingle();
                if (thread) {
                  await supabaseAdmin.from('whatsapp_messages')
                    .update({ read: true, read_at: new Date().toISOString() })
                    .eq('whatsapp_thread_id', thread.id).eq('incoming', false).eq('read', false);
                }
              }
            }
          }
        }
      }
    }

    console.log('[webhook] done in', Date.now() - startedAt, 'ms');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook] fatal error:', err?.message || err);
    return res.status(200).json({ ok: true, error: err?.message }); // always 200 to Meta
  }
});

// ════════════════════════════════════════════════════════════════
// META API PROXY — Send outbound message
// ════════════════════════════════════════════════════════════════


/**
 * POST /api/meta/messages/send
 * Sends a free-form text message to a contact via Meta Cloud API
 * and stores the outbound record in whatsapp_messages.
 * Body: { phone_number, message_text, thread_id? }
 */
app.post('/api/meta/messages/send', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const { phone_number, message_text, thread_id } = req.body;

  if (!phone_number || !message_text) {
    return res.status(400).json({ error: 'phone_number and message_text are required' });
  }

  try {
    // 1. Get WhatsApp config for tenant
    const { data: config, error: configError } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id, phone_number_id, token, tenant_id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (configError || !config?.phone_number_id) {
      return res.status(400).json({ error: 'WhatsApp not configured or phone_number_id missing' });
    }

    const windowState = await getConversationWindowState({
      tenantId,
      phoneNumber: phone_number,
      explicitThreadId: thread_id || null,
    });
    if (!windowState.windowOpen) {
      return res.status(409).json({
        error: 'WINDOW_CLOSED',
        message: 'Ventana de 24h cerrada. Usa una plantilla aprobada.',
        window_open: false,
        window_expires_at: windowState.windowExpiresAt,
        last_inbound_at: windowState.lastInboundAt,
      });
    }

    // 2. Send via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone_number,
          type: 'text',
          text: { preview_url: false, body: message_text },
        }),
      }
    );

    const metaData = await metaRes.json();
    if (!metaRes.ok) {
      return res.status(metaRes.status).json({
        error: metaData.error?.message || 'Meta API Error',
        details: metaData.error,
      });
    }

    // 3. Resolve or create thread
    let resolvedThreadId = thread_id;
    if (!resolvedThreadId) {
      const resolved = await resolveContactAndThread({
        tenantId,
        phoneNumber: phone_number,
        userId,
        seedLastMessage: message_text,
      });
      resolvedThreadId = resolved.threadId;
    }

    // 4. Store outbound message
    if (resolvedThreadId) {
      const { data: saved } = await supabaseAdmin
        .from('whatsapp_messages')
        .insert({
          whatsapp_thread_id: resolvedThreadId,
          message_text,
          incoming: false,
          read: false,
          sent_at: new Date().toISOString(),
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      // Update thread snapshot
      await supabaseAdmin
        .from('whatsapp_threads')
        .update({
          last_message: message_text,
          last_interaction: new Date().toISOString(),
          window_open: true,
          window_expires_at: windowState.windowExpiresAt,
          last_inbound_at: windowState.lastInboundAt,
          updated_by: userId,
        })
        .eq('id', resolvedThreadId);

      return res.status(201).json({ success: true, message: saved, wa_response: metaData });
    }

    return res.status(201).json({ success: true, wa_response: metaData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meta/messages/send-template
 * Body: { phone_number, template_id?, template_name?, language?, template_parameters?, thread_id? }
 */
app.post('/api/meta/messages/send-template', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const { phone_number, template_id, template_name, language, template_parameters, thread_id } = req.body || {};

  if (!phone_number) return res.status(400).json({ error: 'phone_number is required' });
  if (!template_id && !template_name) {
    return res.status(400).json({ error: 'template_id or template_name is required' });
  }

  try {
    const { data: config, error: configError } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id, phone_number_id, token, default_template_language')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (configError || !config?.phone_number_id) {
      return res.status(400).json({ error: 'WhatsApp not configured or phone_number_id missing' });
    }

    let templateQuery = supabaseAdmin
      .from('whatsapp_templates')
      .select('id, template_name, language, meta_status, whatsapp_configuration_id')
      .eq('whatsapp_configuration_id', config.id)
      .eq('meta_status', 'APPROVED')
      .is('deleted_at', null)
      .limit(1);

    if (template_id) templateQuery = templateQuery.eq('id', String(template_id));
    else templateQuery = templateQuery.eq('template_name', String(template_name));

    const { data: approvedTemplate, error: templateError } = await templateQuery.maybeSingle();
    if (templateError || !approvedTemplate) {
      return res.status(400).json({ error: 'Approved template not found for this workspace' });
    }

    let components;
    if (Array.isArray(template_parameters) && template_parameters.length > 0) {
      components = [{
        type: 'body',
        parameters: template_parameters.map((value) => ({ type: 'text', text: String(value) })),
      }];
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone_number,
      type: 'template',
      template: {
        name: approvedTemplate.template_name,
        language: { code: String(language || approvedTemplate.language || config.default_template_language || 'es_LA') },
        ...(components ? { components } : {}),
      },
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const metaData = await metaRes.json();
    if (!metaRes.ok) {
      return res.status(metaRes.status).json({
        error: metaData.error?.message || 'Meta API Error',
        details: metaData.error,
      });
    }

    let resolvedThreadId = thread_id;
    if (!resolvedThreadId) {
      const resolved = await resolveContactAndThread({
        tenantId,
        phoneNumber: phone_number,
        userId,
        seedLastMessage: `[TPL] ${approvedTemplate.template_name}`,
      });
      resolvedThreadId = resolved.threadId;
    }

    const savedText = `[TPL] ${approvedTemplate.template_name}`;
    const { data: saved } = await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        whatsapp_thread_id: resolvedThreadId,
        message_text: savedText,
        incoming: false,
        read: false,
        sent_at: new Date().toISOString(),
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    const windowState = await getConversationWindowState({
      tenantId,
      phoneNumber: phone_number,
      explicitThreadId: resolvedThreadId || null,
    });

    await supabaseAdmin
      .from('whatsapp_threads')
      .update({
        last_message: savedText,
        last_interaction: new Date().toISOString(),
        window_open: windowState.windowOpen,
        window_expires_at: windowState.windowExpiresAt,
        last_inbound_at: windowState.lastInboundAt,
        updated_by: userId,
      })
      .eq('id', resolvedThreadId);

    return res.status(201).json({
      success: true,
      message: saved,
      wa_response: metaData,
      template_name: approvedTemplate.template_name,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

function toDayKey(isoDate) {
  return new Date(isoDate).toISOString().slice(0, 10);
}

function conversationStateFromLastInteraction(lastInteraction) {
  if (!lastInteraction) return 'pendiente';
  const hrs = (Date.now() - new Date(lastInteraction).getTime()) / 3_600_000;
  if (hrs < 1) return 'activo';
  if (hrs < 48) return 'pendiente';
  return 'resuelto';
}

function extractTemplateName(messageText) {
  const text = String(messageText || '').trim();
  if (!text.startsWith('[TPL]')) return null;
  return text.replace(/^\[TPL\]\s*/i, '').trim() || null;
}

function normalizeWhatsAppPhone(rawPhone) {
  const raw = String(rawPhone || '').trim();
  if (!raw) return '';
  // Meta expects digits in E.164 without "+" and no spaces/symbols.
  return raw.replace(/[^\d]/g, '');
}

function normalizeMassSendFilters(input = {}) {
  const normalizeIds = (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((id) => String(id || '').trim()).filter(Boolean)));
  };
  return {
    min_days_overdue: Number.isFinite(Number(input.min_days_overdue)) ? Number(input.min_days_overdue) : null,
    max_days_overdue: Number.isFinite(Number(input.max_days_overdue)) ? Number(input.max_days_overdue) : null,
    min_amount_due: Number.isFinite(Number(input.min_amount_due)) ? Number(input.min_amount_due) : null,
    max_amount_due: Number.isFinite(Number(input.max_amount_due)) ? Number(input.max_amount_due) : null,
    debt_status: input.debt_status ? String(input.debt_status) : null,
    included_contact_ids: normalizeIds(input.included_contact_ids),
    excluded_contact_ids: normalizeIds(input.excluded_contact_ids),
  };
}

const NOTIFICATION_EVENT_TYPES = {
  MASS_SEND_FAILED: 'mass_send_failed',
  THREAD_INBOUND_MESSAGE: 'thread_inbound_message',
  DEBT_OVERDUE_THRESHOLD: 'debt_overdue_threshold',
};

async function resolveNotificationRecipients({ tenantId, audience = 'all_members', roles = [], userIds = [] }) {
  if (audience === 'users' && userIds.length > 0) {
    return Array.from(new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean)));
  }
  let query = supabaseAdmin
    .from('tenant_members')
    .select('user_id, role, enabled')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);
  if (roles.length > 0) query = query.in('role', roles);
  const { data = [], error } = await query;
  if (error) throw new Error(error.message);
  return Array.from(new Set(data.map((row) => row.user_id)));
}

async function isInAppNotificationEnabled({ tenantId, userId, eventType }) {
  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('enabled_in_app')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return true;
  if (!data) return true;
  return Boolean(data.enabled_in_app);
}

async function emitNotificationEvent({
  tenantId,
  actorUserId = null,
  eventType,
  entityType = null,
  entityId = null,
  payload = {},
  audience = 'all_members',
  roles = [],
  userIds = [],
  title,
  body,
  severity = 'info',
  actionUrl = null,
}) {
  const recipients = await resolveNotificationRecipients({ tenantId, audience, roles, userIds });
  if (recipients.length === 0) return { event: null, notificationsCreated: 0 };

  const { data: eventRow, error: eventError } = await supabaseAdmin
    .from('notification_events')
    .insert({
      tenant_id: tenantId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select()
    .single();
  if (eventError || !eventRow) throw new Error(eventError?.message || 'Could not create notification event');

  const notificationRows = [];
  for (const recipientId of recipients) {
    const enabled = await isInAppNotificationEnabled({ tenantId, userId: recipientId, eventType });
    if (!enabled) continue;
    notificationRows.push({
      tenant_id: tenantId,
      user_id: recipientId,
      event_id: eventRow.id,
      title,
      body,
      severity,
      action_url: actionUrl,
      is_read: false,
      created_by: actorUserId,
      updated_by: actorUserId,
    });
  }

  if (notificationRows.length > 0) {
    const { error: notifError } = await supabaseAdmin.from('notifications').insert(notificationRows);
    if (notifError) throw new Error(notifError.message);
  }

  return { event: eventRow, notificationsCreated: notificationRows.length };
}

async function resolveApprovedTemplateForTenant({ tenantId, templateId, templateName }) {
  const { data: config, error: configError } = await supabaseAdmin
    .from('whatsapp_configurations')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();
  if (configError || !config) throw new Error('WhatsApp config not found');

  let query = supabaseAdmin
    .from('whatsapp_templates')
    .select('id, template_name, language, meta_status')
    .eq('whatsapp_configuration_id', config.id)
    .eq('meta_status', 'APPROVED')
    .is('deleted_at', null)
    .limit(1);

  if (templateId) query = query.eq('id', String(templateId));
  else if (templateName) query = query.eq('template_name', String(templateName));
  else throw new Error('template_id or template_name is required');

  const { data: approvedTemplate, error: templateError } = await query.maybeSingle();
  if (templateError || !approvedTemplate) throw new Error('Approved template not found for this workspace');
  return approvedTemplate;
}

async function buildMassSendCandidates({ tenantId, filters, sampleLimit = 20 }) {
  const normalizedFilters = normalizeMassSendFilters(filters || {});
  let debtsQuery = supabaseAdmin
    .from('debts')
    .select(`
      id,
      contact_id,
      total_pending,
      debt_status,
      contacts!inner(id, name, phone_number)
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (normalizedFilters.debt_status) debtsQuery = debtsQuery.eq('debt_status', normalizedFilters.debt_status);
  if (normalizedFilters.min_amount_due !== null) debtsQuery = debtsQuery.gte('total_pending', normalizedFilters.min_amount_due);
  if (normalizedFilters.max_amount_due !== null) debtsQuery = debtsQuery.lte('total_pending', normalizedFilters.max_amount_due);

  const { data: debtsRows = [], error: debtsError } = await debtsQuery;
  if (debtsError) throw new Error(debtsError.message);

  const contactsMap = new Map();
  for (const debt of debtsRows) {
    const phone = String(debt.contacts?.phone_number || '').trim();
    if (!phone) continue;
    const existing = contactsMap.get(debt.contact_id);
    if (!existing || Number(debt.total_pending || 0) > Number(existing.total_pending || 0)) {
      contactsMap.set(debt.contact_id, {
        contact_id: debt.contact_id,
        phone_number: phone,
        contact_name: debt.contacts?.name || phone,
        total_pending: Number(debt.total_pending || 0),
        debt_status: debt.debt_status,
      });
    }
  }

  const contactIds = Array.from(contactsMap.keys());
  let maxOverdueByContact = new Map();
  if (contactIds.length > 0) {
    const { data: detailRows = [], error: detailsError } = await supabaseAdmin
      .from('debt_details')
      .select('contact_id, expiration_date, debt_status')
      .in('contact_id', contactIds)
      .is('deleted_at', null);
    if (detailsError) throw new Error(detailsError.message);

    const now = Date.now();
    for (const row of detailRows) {
      if (String(row.debt_status || '').toLowerCase() === 'paid') continue;
      const expirationTs = new Date(row.expiration_date).getTime();
      if (!Number.isFinite(expirationTs)) continue;
      const overdue = Math.max(0, Math.floor((now - expirationTs) / 86_400_000));
      const curr = maxOverdueByContact.get(row.contact_id) || 0;
      if (overdue > curr) maxOverdueByContact.set(row.contact_id, overdue);
    }
  }

  let candidates = Array.from(contactsMap.values()).map((item) => ({
    ...item,
    max_days_overdue: maxOverdueByContact.get(item.contact_id) || 0,
  }));

  if (normalizedFilters.min_days_overdue !== null) {
    candidates = candidates.filter((item) => item.max_days_overdue >= normalizedFilters.min_days_overdue);
  }
  if (normalizedFilters.max_days_overdue !== null) {
    candidates = candidates.filter((item) => item.max_days_overdue <= normalizedFilters.max_days_overdue);
  }

  // Manual include must override debt filters; add contacts after all filter gates.
  const existingContactIds = new Set(candidates.map((item) => item.contact_id));
  const manualIncludedIds = (normalizedFilters.included_contact_ids || []).filter((id) => !existingContactIds.has(id));
  if (manualIncludedIds.length > 0) {
    const { data: manualContacts = [], error: manualContactsError } = await supabaseAdmin
      .from('contacts')
      .select('id, name, phone_number')
      .eq('tenant_id', tenantId)
      .in('id', manualIncludedIds)
      .is('deleted_at', null);
    if (manualContactsError) throw new Error(manualContactsError.message);

    for (const contact of manualContacts) {
      const phone = String(contact.phone_number || '').trim();
      if (!phone) continue;
      candidates.push({
        contact_id: contact.id,
        phone_number: phone,
        contact_name: contact.name || phone,
        total_pending: 0,
        debt_status: 'manual_include',
        max_days_overdue: 0,
      });
    }
  }

  if (normalizedFilters.excluded_contact_ids.length > 0) {
    const excludedSet = new Set(normalizedFilters.excluded_contact_ids);
    candidates = candidates.filter((item) => !excludedSet.has(item.contact_id));
  }

  candidates.sort((a, b) => b.total_pending - a.total_pending);
  return {
    filters: normalizedFilters,
    total: candidates.length,
    sample: candidates.slice(0, sampleLimit),
    candidates,
  };
}

/**
 * GET /api/meta/metrics
 * Query: from, to, conversation_state?, message_type?, window_state?, template?, search?
 */
app.get('/api/meta/metrics', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId } = req.workspaceAdmin;
  const {
    from,
    to,
    conversation_state,
    message_type,
    window_state,
    template,
    search,
  } = req.query || {};

  const fromIso = from ? new Date(String(from)).toISOString() : null;
  const toIso = to ? new Date(String(to)).toISOString() : null;

  if (!fromIso || !toIso || Number.isNaN(new Date(fromIso).getTime()) || Number.isNaN(new Date(toIso).getTime())) {
    return res.status(400).json({ error: 'Valid from/to query params are required (ISO date)' });
  }
  if (new Date(fromIso).getTime() > new Date(toIso).getTime()) {
    return res.status(400).json({ error: 'from date must be before to date' });
  }

  const normalizedSearch = String(search || '').trim().toLowerCase();
  const normalizedTemplate = String(template || '').trim().toLowerCase();
  const normalizedConversationState = String(conversation_state || '').trim().toLowerCase();
  const normalizedMessageType = String(message_type || '').trim().toLowerCase(); // all | text | template
  const normalizedWindowState = String(window_state || '').trim().toLowerCase(); // all | open | closed

  try {
    const { data: threadsData, error: threadsError } = await supabaseAdmin
      .from('whatsapp_threads')
      .select(`
        id,
        contact_id,
        last_interaction,
        window_open,
        contacts(name, phone_number)
      `)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (threadsError) return res.status(500).json({ error: threadsError.message });
    const threads = threadsData || [];

    const filteredThreads = threads.filter((thread) => {
      const state = conversationStateFromLastInteraction(thread.last_interaction);
      if (normalizedConversationState && normalizedConversationState !== 'all' && state !== normalizedConversationState) {
        return false;
      }
      if (normalizedWindowState === 'open' && !thread.window_open) return false;
      if (normalizedWindowState === 'closed' && thread.window_open) return false;
      if (!normalizedSearch) return true;
      const name = String(thread.contacts?.name || '').toLowerCase();
      const phone = String(thread.contacts?.phone_number || '').toLowerCase();
      return name.includes(normalizedSearch) || phone.includes(normalizedSearch) || String(thread.id).toLowerCase().includes(normalizedSearch);
    });

    const filteredThreadIds = filteredThreads.map((thread) => thread.id);
    if (filteredThreadIds.length === 0) {
      return res.json({
        success: true,
        kpis: {
          sent_messages: 0,
          responded_messages: 0,
          response_rate: 0,
          templates_sent: 0,
          active_conversations: 0,
          closed_window_conversations: 0,
          mass_sent_messages: 0,
          mass_send_runs: 0,
        },
        timeseries: [],
        template_stats: [],
        top_contacts: [],
        top_mass_sends: [],
        conversation_stats: { activo: 0, pendiente: 0, resuelto: 0 },
        detail: [],
        applied_filters: {
          from: fromIso,
          to: toIso,
          conversation_state: normalizedConversationState || 'all',
          message_type: normalizedMessageType || 'all',
          window_state: normalizedWindowState || 'all',
          template: normalizedTemplate || null,
          search: normalizedSearch || null,
        },
      });
    }

    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, whatsapp_thread_id, message_text, incoming, read, created_at, mass_send_id')
      .in('whatsapp_thread_id', filteredThreadIds)
      .is('deleted_at', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    if (messagesError) return res.status(500).json({ error: messagesError.message });
    const allMessages = messagesData || [];

    const threadById = new Map(filteredThreads.map((thread) => [thread.id, thread]));
    const filteredMessages = allMessages.filter((message) => {
      const templateName = extractTemplateName(message.message_text);
      const isTemplate = !!templateName;

      if (normalizedMessageType === 'text' && isTemplate) return false;
      if (normalizedMessageType === 'template' && !isTemplate) return false;
      if (normalizedTemplate && (!templateName || !templateName.toLowerCase().includes(normalizedTemplate))) return false;

      if (!normalizedSearch) return true;
      const thread = threadById.get(message.whatsapp_thread_id);
      const contactName = String(thread?.contacts?.name || '').toLowerCase();
      const contactPhone = String(thread?.contacts?.phone_number || '').toLowerCase();
      const messageText = String(message.message_text || '').toLowerCase();
      return (
        messageText.includes(normalizedSearch)
        || contactName.includes(normalizedSearch)
        || contactPhone.includes(normalizedSearch)
      );
    });

    const outgoingMessages = filteredMessages.filter((message) => !message.incoming);
    const incomingMessages = filteredMessages.filter((message) => message.incoming);
    const templateMessages = outgoingMessages.filter((message) => extractTemplateName(message.message_text));

    const timeseriesMap = new Map();
    filteredMessages.forEach((message) => {
      const day = toDayKey(message.created_at);
      if (!timeseriesMap.has(day)) {
        timeseriesMap.set(day, { day, sent: 0, responded: 0 });
      }
      const bucket = timeseriesMap.get(day);
      if (message.incoming) bucket.responded += 1;
      else bucket.sent += 1;
    });
    const timeseries = Array.from(timeseriesMap.values()).sort((a, b) => a.day.localeCompare(b.day));

    const templateCounter = new Map();
    templateMessages.forEach((message) => {
      const tpl = extractTemplateName(message.message_text);
      if (!tpl) return;
      templateCounter.set(tpl, (templateCounter.get(tpl) || 0) + 1);
    });
    const templateStats = Array.from(templateCounter.entries())
      .map(([template_name, sent]) => ({ template_name, sent }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 10);

    const contactCounter = new Map();
    filteredMessages.forEach((message) => {
      const thread = threadById.get(message.whatsapp_thread_id);
      const key = message.whatsapp_thread_id;
      const current = contactCounter.get(key) || {
        thread_id: key,
        contact_name: thread?.contacts?.name || 'Desconocido',
        phone_number: thread?.contacts?.phone_number || null,
        total: 0,
      };
      current.total += 1;
      contactCounter.set(key, current);
    });
    const topContacts = Array.from(contactCounter.values()).sort((a, b) => b.total - a.total).slice(0, 10);

    const conversationStats = { activo: 0, pendiente: 0, resuelto: 0 };
    filteredThreads.forEach((thread) => {
      const state = conversationStateFromLastInteraction(thread.last_interaction);
      conversationStats[state] += 1;
    });

    const detail = filteredMessages
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100)
      .map((message) => {
        const thread = threadById.get(message.whatsapp_thread_id);
        const tpl = extractTemplateName(message.message_text);
        return {
          id: message.id,
          created_at: message.created_at,
          thread_id: message.whatsapp_thread_id,
          contact_name: thread?.contacts?.name || 'Desconocido',
          phone_number: thread?.contacts?.phone_number || null,
          direction: message.incoming ? 'inbound' : 'outbound',
          message_type: tpl ? 'template' : 'text',
          template_name: tpl,
          read: message.read,
          preview: String(message.message_text || '').slice(0, 140),
          window_open: !!thread?.window_open,
          conversation_state: conversationStateFromLastInteraction(thread?.last_interaction || null),
        };
      });

    const responseRate = outgoingMessages.length > 0
      ? Number(((incomingMessages.length / outgoingMessages.length) * 100).toFixed(2))
      : 0;

    const massSendMessageCount = outgoingMessages.filter((message) => !!message.mass_send_id).length;
    const { data: massRuns = [] } = await supabaseAdmin
      .from('whatsapp_mass_send_runs')
      .select('id, sent_count, failed_count, started_at, whatsapp_mass_sends(name)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte('started_at', fromIso)
      .lte('started_at', toIso);

    const topMassSends = (massRuns || [])
      .map((run) => ({ name: run.whatsapp_mass_sends?.name || 'Sin nombre', sent: Number(run.sent_count || 0), failed: Number(run.failed_count || 0) }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 5);

    return res.json({
      success: true,
      kpis: {
        sent_messages: outgoingMessages.length,
        responded_messages: incomingMessages.length,
        response_rate: responseRate,
        templates_sent: templateMessages.length,
        active_conversations: conversationStats.activo,
        closed_window_conversations: filteredThreads.filter((thread) => !thread.window_open).length,
        mass_sent_messages: massSendMessageCount,
        mass_send_runs: (massRuns || []).length,
      },
      timeseries,
      template_stats: templateStats,
      top_contacts: topContacts,
      top_mass_sends: topMassSends,
      conversation_stats: conversationStats,
      detail,
      applied_filters: {
        from: fromIso,
        to: toIso,
        conversation_state: normalizedConversationState || 'all',
        message_type: normalizedMessageType || 'all',
        window_state: normalizedWindowState || 'all',
        template: normalizedTemplate || null,
        search: normalizedSearch || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meta/mass-sends/preview
 * Body: { filters }
 */
app.post('/api/meta/mass-sends/preview', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId } = req.workspaceAdmin;
  try {
    const { filters = {} } = req.body || {};
    const result = await buildMassSendCandidates({ tenantId, filters, sampleLimit: 25 });
    return res.json({
      success: true,
      total_recipients: result.total,
      sample: result.sample,
      applied_filters: result.filters,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/meta/mass-sends
 * Body: { name, template_id|template_name, language?, template_parameters?, filters?, mode?, schedule? }
 */
app.post('/api/meta/mass-sends', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const {
    name,
    template_id,
    template_name,
    language,
    template_parameters = [],
    filters = {},
    mode = 'manual',
    schedule = null,
  } = req.body || {};

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const approvedTemplate = await resolveApprovedTemplateForTenant({ tenantId, templateId: template_id, templateName: template_name });
    const normalizedFilters = normalizeMassSendFilters(filters);
    const finalMode = String(mode).toLowerCase() === 'scheduled' ? 'scheduled' : 'manual';

    const { data: created, error: createError } = await supabaseAdmin
      .from('whatsapp_mass_sends')
      .insert({
        tenant_id: tenantId,
        whatsapp_template_id: approvedTemplate.id,
        name: String(name).trim(),
        template_name: approvedTemplate.template_name,
        language: String(language || approvedTemplate.language || 'es_LA'),
        template_parameters: Array.isArray(template_parameters) ? template_parameters : [],
        filters: normalizedFilters,
        mode: finalMode,
        status: finalMode === 'scheduled' ? 'active' : 'draft',
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (createError || !created) return res.status(500).json({ error: createError?.message || 'Could not create mass send' });

    if (finalMode === 'scheduled' && schedule?.cron_expression) {
      await supabaseAdmin
        .from('whatsapp_mass_send_schedules')
        .insert({
          mass_send_id: created.id,
          cron_expression: String(schedule.cron_expression),
          timezone: String(schedule.timezone || 'America/Bogota'),
          next_run_at: schedule.next_run_at || null,
          enabled: schedule.enabled !== false,
          created_by: userId,
          updated_by: userId,
        });
    }

    return res.status(201).json({ success: true, mass_send: created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/meta/mass-sends', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId } = req.workspaceAdmin;
  try {
    const { data: massSends = [], error } = await supabaseAdmin
      .from('whatsapp_mass_sends')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    const ids = massSends.map((row) => row.id);
    let runs = [];
    if (ids.length > 0) {
      const { data } = await supabaseAdmin
        .from('whatsapp_mass_send_runs')
        .select('*')
        .in('mass_send_id', ids)
        .is('deleted_at', null)
        .order('started_at', { ascending: false });
      runs = data || [];
    }

    const runByMassSend = new Map();
    for (const run of runs) {
      if (!runByMassSend.has(run.mass_send_id)) runByMassSend.set(run.mass_send_id, run);
    }

    return res.json({
      success: true,
      items: massSends.map((item) => ({
        ...item,
        last_run: runByMassSend.get(item.id) || null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/meta/mass-sends/:id', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId } = req.workspaceAdmin;
  const { id } = req.params;
  try {
    const { data: massSend, error } = await supabaseAdmin
      .from('whatsapp_mass_sends')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !massSend) return res.status(404).json({ error: 'Mass send not found' });

    const { data: schedules = [] } = await supabaseAdmin
      .from('whatsapp_mass_send_schedules')
      .select('*')
      .eq('mass_send_id', id)
      .is('deleted_at', null);

    const { data: runs = [] } = await supabaseAdmin
      .from('whatsapp_mass_send_runs')
      .select('*')
      .eq('mass_send_id', id)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(20);

    return res.json({ success: true, mass_send: massSend, schedules, runs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/meta/mass-sends/:id/run', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const { id } = req.params;
  const triggerType = String(req.body?.trigger_type || 'manual').toLowerCase() === 'scheduled' ? 'scheduled' : 'manual';

  try {
    const { data: massSend, error: massSendError } = await supabaseAdmin
      .from('whatsapp_mass_sends')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (massSendError || !massSend) return res.status(404).json({ error: 'Mass send not found' });

    const { data: config, error: configError } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id, phone_number_id, token')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (configError || !config?.phone_number_id) {
      return res.status(400).json({ error: 'WhatsApp not configured or phone_number_id missing' });
    }

    const candidatesResult = await buildMassSendCandidates({ tenantId, filters: massSend.filters, sampleLimit: 5000 });
    const recipients = candidatesResult.candidates;

    const { data: runRow, error: runError } = await supabaseAdmin
      .from('whatsapp_mass_send_runs')
      .insert({
        mass_send_id: massSend.id,
        tenant_id: tenantId,
        trigger_type: triggerType,
        status: 'running',
        total_recipients: recipients.length,
        started_at: new Date().toISOString(),
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (runError || !runRow) return res.status(500).json({ error: runError?.message || 'Could not create run' });

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const recipient of recipients) {
      const normalizedPhone = normalizeWhatsAppPhone(recipient.phone_number);
      if (!normalizedPhone) {
        skippedCount += 1;
        await supabaseAdmin.from('whatsapp_mass_send_recipients').insert({
          mass_send_id: massSend.id,
          mass_send_run_id: runRow.id,
          contact_id: recipient.contact_id,
          phone_number: String(recipient.phone_number || ''),
          template_name: massSend.template_name,
          status: 'skipped',
            error_message: 'Missing or invalid phone number',
          created_by: userId,
          updated_by: userId,
        });
        continue;
      }

      try {
        const components = Array.isArray(massSend.template_parameters) && massSend.template_parameters.length > 0
          ? [{
            type: 'body',
            parameters: massSend.template_parameters.map((value) => ({ type: 'text', text: String(value) })),
          }]
          : undefined;

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedPhone,
          type: 'template',
          template: {
            name: massSend.template_name,
            language: { code: String(massSend.language || 'es_LA') },
            ...(components ? { components } : {}),
          },
        };

        const metaRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${config.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const metaData = await metaRes.json();
        if (!metaRes.ok) throw new Error(metaData.error?.message || 'Meta API Error');

        const resolved = await resolveContactAndThread({
          tenantId,
          phoneNumber: String(recipient.phone_number || normalizedPhone),
          userId,
          seedLastMessage: `[MASIVO] ${massSend.template_name}`,
        });
        const resolvedThreadId = resolved.threadId;
        const savedText = `[MASIVO] ${massSend.template_name}`;

        const { data: savedMessage } = await supabaseAdmin
          .from('whatsapp_messages')
          .insert({
            whatsapp_thread_id: resolvedThreadId,
            message_text: savedText,
            incoming: false,
            read: false,
            sent_at: new Date().toISOString(),
            mass_send_id: massSend.id,
            mass_send_run_id: runRow.id,
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        const windowState = await getConversationWindowState({
          tenantId,
          phoneNumber: String(recipient.phone_number || normalizedPhone),
          explicitThreadId: resolvedThreadId || null,
        });

        await supabaseAdmin
          .from('whatsapp_threads')
          .update({
            last_message: savedText,
            last_interaction: new Date().toISOString(),
            window_open: windowState.windowOpen,
            window_expires_at: windowState.windowExpiresAt,
            last_inbound_at: windowState.lastInboundAt,
            updated_by: userId,
          })
          .eq('id', resolvedThreadId);

        await supabaseAdmin
          .from('whatsapp_mass_send_recipients')
          .insert({
            mass_send_id: massSend.id,
            mass_send_run_id: runRow.id,
            contact_id: resolved.contactId,
            phone_number: String(recipient.phone_number || normalizedPhone),
            template_name: massSend.template_name,
            status: 'sent',
            meta_message_id: metaData?.messages?.[0]?.id || null,
            whatsapp_thread_id: resolvedThreadId,
            whatsapp_message_id: savedMessage?.id || null,
            sent_at: new Date().toISOString(),
            created_by: userId,
            updated_by: userId,
          });
        sentCount += 1;
      } catch (sendErr) {
        failedCount += 1;
        const metaError = sendErr?.message ? String(sendErr.message) : 'Unknown send error';
        await supabaseAdmin
          .from('whatsapp_mass_send_recipients')
          .insert({
            mass_send_id: massSend.id,
            mass_send_run_id: runRow.id,
            contact_id: recipient.contact_id || null,
            phone_number: String(recipient.phone_number || normalizedPhone || ''),
            template_name: massSend.template_name,
            status: 'failed',
            error_message: metaError,
            created_by: userId,
            updated_by: userId,
          });
      }
    }

    const { data: failedRecipients = [] } = await supabaseAdmin
      .from('whatsapp_mass_send_recipients')
      .select('phone_number, error_message')
      .eq('mass_send_run_id', runRow.id)
      .eq('status', 'failed')
      .limit(5);

    const finalStatus = failedCount > 0 && sentCount === 0 ? 'failed' : 'completed';
    await supabaseAdmin
      .from('whatsapp_mass_send_runs')
      .update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_count: skippedCount,
        finished_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', runRow.id);

    await supabaseAdmin
      .from('whatsapp_mass_sends')
      .update({
        status: massSend.mode === 'scheduled' ? 'active' : 'completed',
        updated_by: userId,
      })
      .eq('id', massSend.id);

    if (failedCount > 0) {
      await emitNotificationEvent({
        tenantId,
        actorUserId: userId,
        eventType: NOTIFICATION_EVENT_TYPES.MASS_SEND_FAILED,
        entityType: 'whatsapp_mass_send_run',
        entityId: runRow.id,
        payload: {
          mass_send_id: massSend.id,
          mass_send_name: massSend.name,
          failed_count: failedCount,
          sent_count: sentCount,
          skipped_count: skippedCount,
        },
        roles: ['Admin', 'Superadmin'],
        title: `Fallo en envío masivo: ${massSend.name}`,
        body: `El envío registró ${failedCount} fallo(s). Revisa el detalle en mensajería.`,
        severity: failedCount > 5 ? 'critical' : 'warning',
        actionUrl: '/mensajeria/masivos',
      }).catch((error) => console.error('[notifications] mass_send_failed emit error:', error.message));
    }

    return res.json({
      success: true,
      run_id: runRow.id,
      summary: {
        total_recipients: recipients.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      audience_debug: {
        filters_applied: massSend.filters || {},
        recipient_count: recipients.length,
      },
      failed_samples: failedRecipients,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', requireWorkspaceMember, async (req, res) => {
  const { tenantId, userId } = req.workspaceMember;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  try {
    const { data = [], error, count } = await supabaseAdmin
      .from('notifications')
      .select('id, tenant_id, user_id, event_id, title, body, severity, action_url, is_read, read_at, created_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, items: data, total: count || 0, limit, offset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications/unread-count', requireWorkspaceMember, async (req, res) => {
  const { tenantId, userId } = req.workspaceMember;
  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('deleted_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, unread_count: count || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notifications/:id/read', requireWorkspaceMember, async (req, res) => {
  const { tenantId, userId } = req.workspaceMember;
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id, is_read, read_at')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ success: true, notification: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notifications/read-all', requireWorkspaceMember, async (req, res) => {
  const { tenantId, userId } = req.workspaceMember;
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('deleted_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications/preferences', requireWorkspaceMember, async (req, res) => {
  const { tenantId, userId } = req.workspaceMember;
  try {
    const { data = [], error } = await supabaseAdmin
      .from('notification_preferences')
      .select('id, event_type, enabled_in_app, enabled_email, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('event_type', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, items: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/preferences', requireWorkspaceMember, async (req, res) => {
  const { tenantId, userId } = req.workspaceMember;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'items[] is required' });
  try {
    const rows = items
      .filter((item) => item?.event_type)
      .map((item) => ({
        tenant_id: tenantId,
        user_id: userId,
        event_type: String(item.event_type),
        enabled_in_app: item.enabled_in_app !== false,
        enabled_email: item.enabled_email === true,
        updated_by: userId,
      }));
    if (rows.length === 0) return res.status(400).json({ error: 'No valid preference rows provided' });
    const { error } = await supabaseAdmin
      .from('notification_preferences')
      .upsert(rows, { onConflict: 'tenant_id,user_id,event_type' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, updated: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/debt-threshold/check', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const minDaysOverdue = Number(req.body?.min_days_overdue || 30);
  if (!Number.isFinite(minDaysOverdue) || minDaysOverdue < 0) {
    return res.status(400).json({ error: 'min_days_overdue must be a positive number' });
  }
  try {
    const { data: detailRows = [], error } = await supabaseAdmin
      .from('debt_details')
      .select('id, contact_id, expiration_date, debt_status, contacts(name)')
      .eq('debt_status', 'Expired')
      .is('deleted_at', null);
    if (error) return res.status(500).json({ error: error.message });
    const now = Date.now();
    const matches = detailRows.filter((row) => {
      const ts = new Date(row.expiration_date).getTime();
      if (!Number.isFinite(ts)) return false;
      const overdueDays = Math.max(0, Math.floor((now - ts) / 86_400_000));
      return overdueDays >= minDaysOverdue;
    });
    if (matches.length === 0) return res.json({ success: true, emitted: 0, matches: 0 });

    await emitNotificationEvent({
      tenantId,
      actorUserId: userId,
      eventType: NOTIFICATION_EVENT_TYPES.DEBT_OVERDUE_THRESHOLD,
      entityType: 'debt_details_threshold',
      entityId: null,
      payload: { min_days_overdue: minDaysOverdue, matches: matches.length },
      roles: ['Admin', 'Agente'],
      title: 'Deudas vencidas en umbral',
      body: `${matches.length} deudas superan ${minDaysOverdue} días de mora.`,
      severity: 'warning',
      actionUrl: '/deudas',
    });
    return res.json({ success: true, emitted: 1, matches: matches.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

async function requireWorkspaceMember(req, res, next) {
  const authHeader = req.headers.authorization;
  const tenantId = req.headers['x-tenant-id'];
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No authorization header' });
  if (!tenantId) return res.status(400).json({ error: 'Missing x-tenant-id header' });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: membership } = await supabaseAdmin
    .from('tenant_members')
    .select('role, enabled')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !membership.enabled) return res.status(403).json({ error: 'Forbidden: workspace membership required' });

  req.workspaceMember = { userId: user.id, tenantId, role: membership.role };
  next();
}

async function requireWorkspaceAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const tenantId = req.headers['x-tenant-id'];
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No authorization header' });
  if (!tenantId) return res.status(400).json({ error: 'Missing x-tenant-id header' });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: membership } = await supabaseAdmin
    .from('tenant_members')
    .select('role, enabled')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !membership.enabled || !['Admin', 'Superadmin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Forbidden: Admin role required in selected workspace' });
  }

  req.workspaceAdmin = { userId: user.id, tenantId };
  next();
}

// ════════════════════════════════════════════════════════════════
// USERS — Admin operations
// ════════════════════════════════════════════════════════════════

/**
 * POST /admin/users
 * Create a new Supabase Auth user + profile row
 * Body: { email, password, name, role, tenant_id }
 */
app.post('/admin/users', requireSuperadmin, async (req, res) => {
  const { email, password, name, role, tenant_id } = req.body;

  if (!email || !password || !name || !role || !tenant_id) {
    return res.status(400).json({ error: 'Missing required fields: email, password, name, role, tenant_id' });
  }

  // 1. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // auto-confirm so they can log in immediately
  });

  if (authError) return res.status(400).json({ error: authError.message });

  // 2. Insert global profile (users).
  // tenant_id is kept as legacy/default-workspace compatibility; authorization uses tenant_members.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      name,
      email,
      role,
      tenant_id,
      enabled: true,
      created_by: req.adminUser.id,
      updated_by: req.adminUser.id,
    })
    .select()
    .single();

  if (profileError) {
    // Rollback auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: profileError.message });
  }

  // 3. Insert tenant membership (source of truth for tenant permissions)
  const { error: membershipError } = await supabaseAdmin
    .from('tenant_members')
    .insert({
      tenant_id,
      user_id: authData.user.id,
      role,
      enabled: true,
      created_by: req.adminUser.id,
      updated_by: req.adminUser.id,
    });

  if (membershipError) {
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: membershipError.message });
  }

  res.status(201).json({ ...profile, tenant_membership_created: true });
});

/**
 * DELETE /admin/users/:id
 * Soft-delete profile + disable auth account
 */
app.delete('/admin/users/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from('users')
    .update({ deleted_at: now, deleted_by: req.adminUser.id, enabled: false })
    .eq('id', id);

  if (profileError) return res.status(500).json({ error: profileError.message });

  const { error: membershipError } = await supabaseAdmin
    .from('tenant_members')
    .update({ deleted_at: now, enabled: false, deleted_by: req.adminUser.id })
    .eq('user_id', id)
    .is('deleted_at', null);
  if (membershipError) return res.status(500).json({ error: membershipError.message });

  await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '87600h' }); // ~10 years

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// TENANTS — Admin operations
// ════════════════════════════════════════════════════════════════

/** GET /admin/tenants — All tenants with user/subscription counts */
app.get('/admin/tenants', requireSuperadmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select(`
      *,
      users(count),
      subscriptions(id, enable, expiration_date, subscription_plans(name, price))
    `)
    .is('deleted_at', null)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** POST /admin/tenants — Create tenant */
app.post('/admin/tenants', requireSuperadmin, async (req, res) => {
  const { name, nit, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .insert({ name, nit, address, created_by: req.adminUser.id, updated_by: req.adminUser.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/** PUT /admin/tenants/:id — Update tenant */
app.put('/admin/tenants/:id', requireSuperadmin, async (req, res) => {
  const { name, nit, address } = req.body;
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ name, nit, address, updated_by: req.adminUser.id })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** DELETE /admin/tenants/:id — Soft delete */
app.delete('/admin/tenants/:id', requireSuperadmin, async (req, res) => {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ deleted_at: now, deleted_by: req.adminUser.id })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ════════════════════════════════════════════════════════════════

/** GET /admin/subscriptions — All with tenant + plan info */
app.get('/admin/subscriptions', requireSuperadmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*, tenants(name), subscription_plans(name, price)')
    .is('deleted_at', null)
    .order('expiration_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** POST /admin/subscriptions */
app.post('/admin/subscriptions', requireSuperadmin, async (req, res) => {
  const { tenant_id, subscription_plan_id, price, expiration_date } = req.body;
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({ tenant_id, subscription_plan_id, price, expiration_date, enable: true, created_by: req.adminUser.id, updated_by: req.adminUser.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/** PATCH /admin/subscriptions/:id/toggle */
app.patch('/admin/subscriptions/:id/toggle', requireSuperadmin, async (req, res) => {
  // Get current state first
  const { data: current } = await supabaseAdmin.from('subscriptions').select('enable').eq('id', req.params.id).single();
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({ enable: !current?.enable, updated_by: req.adminUser.id })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** GET /admin/plans */
app.get('/admin/plans', requireSuperadmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .is('deleted_at', null)
    .order('price');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ════════════════════════════════════════════════════════════════
// FIRST-TIME SETUP — Public endpoints (no auth required)
// ════════════════════════════════════════════════════════════════

/**
 * GET /setup/check
 * Returns { needsSetup: true } if no Superadmin exists yet.
 * Safe to call publicly — reveals no sensitive data.
 */
app.get('/setup/check', async (req, res) => {
  const { count, error } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'Superadmin')
    .is('deleted_at', null);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ needsSetup: (count ?? 0) === 0 });
});

/**
 * POST /setup/init
 * Creates the first tenant + Superadmin user atomically.
 * Body: { tenantName, adminName, email, password }
 * Blocked with 409 if a Superadmin already exists.
 */
app.post('/setup/init', async (req, res) => {
  // Re-check: block if already initialized (idempotency guard)
  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'Superadmin')
    .is('deleted_at', null);

  if ((count ?? 0) > 0) {
    return res.status(409).json({ error: 'El sistema ya fue configurado. Usa el panel de administración para crear más usuarios.' });
  }

  const { tenantName, adminName, email, password } = req.body;

  if (!tenantName || !adminName || !email || !password) {
    return res.status(400).json({ error: 'Campos requeridos: tenantName, adminName, email, password' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  // 1. Create tenant
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({ name: tenantName })
    .select()
    .single();

  if (tenantError) return res.status(500).json({ error: `Error creando tenant: ${tenantError.message}` });

  // 2. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    // Rollback tenant
    await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
    return res.status(400).json({ error: `Error creando usuario: ${authError.message}` });
  }

  // 3. Create user profile as Superadmin
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      name: adminName,
      email,
      role: 'Superadmin',
      tenant_id: tenant.id,
      enabled: true,
      created_by: authData.user.id,
      updated_by: authData.user.id,
    })
    .select()
    .single();

  if (profileError) {
    // Rollback both
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
    return res.status(500).json({ error: `Error creando perfil: ${profileError.message}` });
  }

  // 4. Create first workspace membership
  await supabaseAdmin
    .from('tenant_members')
    .insert({
      tenant_id: tenant.id,
      user_id: authData.user.id,
      role: 'Superadmin',
      enabled: true,
    });

  console.log(`✅ Setup complete. Superadmin: ${email}, Tenant: ${tenantName}`);
  res.status(201).json({ success: true, tenant, profile: { id: profile.id, name: profile.name, email: profile.email, role: profile.role } });
});

/**
 * POST /admin/invites
 * Headers: Authorization Bearer <token>, x-tenant-id
 * Body: { email, role }
 */
app.post('/admin/invites', requireWorkspaceAdmin, async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'Missing required fields: email, role' });
  if (!['Admin', 'Agente'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const actorKey = `${req.workspaceAdmin.tenantId}:${req.workspaceAdmin.userId}:${req.ip ?? 'na'}`;
  const retryAfter = enforceInviteRateLimit(actorKey);
  if (retryAfter) return res.status(429).json({ error: `Rate limit exceeded. Retry in ${retryAfter}s` });

  const { data: existingPending } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, role, status, expires_at, created_at, updated_at')
    .eq('tenant_id', req.workspaceAdmin.tenantId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    const inviteUrl = getInviteUrl(existingPending.id);
    const emailResult = await sendInviteEmail(normalizedEmail, inviteUrl);
    return res.status(200).json({ ...existingPending, invite_url: inviteUrl, ...emailResult, reused: true });
  }

  const { data: invite, error } = await supabaseAdmin
    .from('tenant_invites')
    .insert({
      tenant_id: req.workspaceAdmin.tenantId,
      email: normalizedEmail,
      role,
      status: 'pending',
      expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      created_by: req.workspaceAdmin.userId,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const inviteUrl = getInviteUrl(invite.id);
  const emailResult = await sendInviteEmail(normalizedEmail, inviteUrl);
  return res.status(201).json({ ...invite, invite_url: inviteUrl, ...emailResult });
});

/**
 * GET /admin/invites
 * Headers: Authorization Bearer <token>, x-tenant-id
 * Query: status=all|pending|accepted|expired|revoked
 */
app.get('/admin/invites', requireWorkspaceAdmin, async (req, res) => {
  const status = String(req.query.status || 'all');
  const allowed = ['all', 'pending', 'accepted', 'expired', 'revoked'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });

  let query = supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, role, status, expires_at, created_at, updated_at')
    .eq('tenant_id', req.workspaceAdmin.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ items: data ?? [] });
});

/**
 * POST /admin/invites/:id/resend
 * Headers: Authorization Bearer <token>, x-tenant-id
 */
app.post('/admin/invites/:id/resend', requireWorkspaceAdmin, async (req, res) => {
  const inviteId = req.params.id;
  const actorKey = `${req.workspaceAdmin.tenantId}:${req.workspaceAdmin.userId}:${req.ip ?? 'na'}`;
  const retryAfter = enforceInviteRateLimit(actorKey);
  if (retryAfter) return res.status(429).json({ error: `Rate limit exceeded. Retry in ${retryAfter}s` });

  const { data: invite, error } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, role, status, expires_at')
    .eq('id', inviteId)
    .eq('tenant_id', req.workspaceAdmin.tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !invite) return res.status(404).json({ error: 'Invitación no encontrada' });
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Solo se puede reenviar invitaciones pendientes' });

  const inviteUrl = getInviteUrl(invite.id);
  const emailResult = await sendInviteEmail(invite.email, inviteUrl);
  return res.json({ success: true, invite_url: inviteUrl, ...emailResult });
});

/**
 * DELETE /admin/invites/:id
 * Headers: Authorization Bearer <token>, x-tenant-id
 */
app.delete('/admin/invites/:id', requireWorkspaceAdmin, async (req, res) => {
  const inviteId = req.params.id;
  const { data: invite, error: readError } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, status')
    .eq('id', inviteId)
    .eq('tenant_id', req.workspaceAdmin.tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  if (readError || !invite) return res.status(404).json({ error: 'Invitación no encontrada' });
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Solo se puede revocar invitaciones pendientes' });

  const { error } = await supabaseAdmin
    .from('tenant_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('tenant_id', req.workspaceAdmin.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

/**
 * GET /invites/:token
 * Public endpoint to validate invite token
 */
app.get('/invites/:token', async (req, res) => {
  const { token } = req.params;
  const { data: invite, error } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, role, status, expires_at, tenants(name)')
    .eq('id', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !invite) return res.status(404).json({ error: 'Invitación no encontrada' });
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Invitación ya utilizada o expirada' });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('tenant_invites').update({ status: 'expired' }).eq('id', token);
    return res.status(400).json({ error: 'Invitación expirada' });
  }

  const tenant = Array.isArray(invite.tenants) ? invite.tenants[0] : invite.tenants;
  const [localPart, domainPart] = String(invite.email).split('@');
  const safeLocal = localPart && localPart.length > 2
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : '***';
  const maskedEmail = domainPart ? `${safeLocal}@${domainPart}` : invite.email;
  return res.json({
    token: invite.id,
    tenantId: invite.tenant_id,
    tenantName: tenant?.name ?? 'Workspace',
    email: maskedEmail,
    role: invite.role,
  });
});

/**
 * POST /invites/:token/accept
 * Requires authenticated user session token
 */
app.post('/invites/:token/accept', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No authorization header' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const inviteToken = req.params.token;
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('tenant_invites')
    .select('*')
    .eq('id', inviteToken)
    .is('deleted_at', null)
    .maybeSingle();
  if (inviteError || !invite) return res.status(404).json({ error: 'Invitación no encontrada' });
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Invitación ya utilizada o expirada' });
  if (invite.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return res.status(403).json({ error: 'La invitación pertenece a otro email' });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('tenant_invites').update({ status: 'expired' }).eq('id', inviteToken);
    return res.status(400).json({ error: 'Invitación expirada' });
  }

  const defaultRole = invite.role === 'Admin' ? 'Admin' : 'Agente';
  const profileName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existingProfile) {
    const { error: createProfileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        name: profileName,
        email: user.email,
        role: defaultRole,
        tenant_id: null,
        enabled: true,
      });
    if (createProfileError) return res.status(500).json({ error: createProfileError.message });
  }

  const { error: memberError } = await supabaseAdmin
    .from('tenant_members')
    .upsert({
      tenant_id: invite.tenant_id,
      user_id: user.id,
      role: invite.role,
      enabled: true,
    }, { onConflict: 'tenant_id,user_id' });
  if (memberError) return res.status(500).json({ error: memberError.message });

  const { error: markAcceptedError } = await supabaseAdmin
    .from('tenant_invites')
    .update({ status: 'accepted' })
    .eq('id', inviteToken)
    .eq('status', 'pending');
  if (markAcceptedError) return res.status(500).json({ error: markAcceptedError.message });
  return res.json({ success: true, tenant_id: invite.tenant_id, role: invite.role });
});

// ════════════════════════════════════════════════════════════════
// META API PROXIES (WhatsApp Templates)
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/meta/configurations/upsert
 * Validates connectivity against Meta Graph API and only then persists config.
 */
app.post('/api/meta/configurations/upsert', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const {
    channel_name,
    meta_id,
    waba_id,
    phone_number_id,
    token,
    verify_token,
    default_template_language,
  } = req.body || {};

  if (!meta_id || !waba_id || !phone_number_id || !token || !verify_token) {
    return res.status(400).json({
      error: 'Missing required fields: meta_id, waba_id, phone_number_id, token, verify_token',
    });
  }

  const headers = { Authorization: `Bearer ${token}` };
  const graphVersion = process.env.META_GRAPH_VERSION || 'v23.0';

  try {
    // Validate Facebook App ID with current token.
    const appRes = await fetch(`https://graph.facebook.com/${graphVersion}/${meta_id}?fields=id,name`, { headers });
    const appData = await appRes.json();
    if (!appRes.ok || !appData?.id) {
      return res.status(400).json({ error: appData?.error?.message || 'No se pudo validar Facebook App ID con el token' });
    }

    // Validate WABA access.
    const wabaRes = await fetch(`https://graph.facebook.com/${graphVersion}/${waba_id}?fields=id,name`, { headers });
    const wabaData = await wabaRes.json();
    if (!wabaRes.ok || !wabaData?.id) {
      return res.status(400).json({ error: wabaData?.error?.message || 'No se pudo validar WABA ID con el token' });
    }

    // Validate phone number access.
    const phoneRes = await fetch(`https://graph.facebook.com/${graphVersion}/${phone_number_id}?fields=id,display_phone_number,verified_name`, { headers });
    const phoneData = await phoneRes.json();
    if (!phoneRes.ok || !phoneData?.id) {
      return res.status(400).json({ error: phoneData?.error?.message || 'No se pudo validar Phone Number ID con el token' });
    }

    // Persist only after successful validations.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) return res.status(500).json({ error: existingError.message });

    const payload = {
      channel_name: channel_name || null,
      meta_id: String(meta_id),
      waba_id: String(waba_id),
      phone_number_id: String(phone_number_id),
      token: String(token),
      verify_token: String(verify_token),
      default_template_language: String(default_template_language || 'es_LA'),
      updated_by: userId,
    };

    let dbRes;
    if (existing?.id) {
      dbRes = await supabaseAdmin
        .from('whatsapp_configurations')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      dbRes = await supabaseAdmin
        .from('whatsapp_configurations')
        .insert({
          ...payload,
          tenant_id: tenantId,
          created_by: userId,
        })
        .select()
        .single();
    }

    if (dbRes.error) return res.status(500).json({ error: dbRes.error.message });

    return res.status(200).json({
      success: true,
      connection_check: {
        app: { id: appData.id, name: appData.name || null },
        waba: { id: wabaData.id, name: wabaData.name || null },
        phone: {
          id: phoneData.id,
          display_phone_number: phoneData.display_phone_number || null,
          verified_name: phoneData.verified_name || null,
        },
      },
      configuration: dbRes.data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error validando conexión con Meta' });
  }
});

/**
 * POST /api/meta/templates/create
 * Creates a template in Meta Cloud API and if successful, saves it to Supabase as PENDING
 */
app.post('/api/meta/templates/create', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId, userId } = req.workspaceAdmin;
  const { name, language, category, components, args } = req.body || {};

  if (!name || !category || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({
      error: 'Missing required fields: name, category, components[]',
    });
  }

  try {
    // 1. Get configurations for this tenant
    const { data: config, error: configError } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id, waba_id, token, default_template_language')
      .eq('tenant_id', tenantId)
      .single();

    if (configError || !config) {
      return res.status(400).json({ error: 'WhatsApp config not found for this workspace' });
    }

    // 2. Build payload for Meta
    const normalizedName = String(name).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const payload = {
      name: normalizedName,
      language: language || config.default_template_language || 'es_LA',
      category,
      components,
    };

    // 3. Send to Meta API
    const metaRes = await fetch(`https://graph.facebook.com/v23.0/${config.waba_id}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const metaData = await metaRes.json();
    if (!metaRes.ok) {
      return res.status(metaRes.status).json({
        error: metaData.error?.message || 'Meta API Error',
        details: metaData.error,
      });
    }

    // 4. Save to Supabase DB
    const { data: template, error: dbError } = await supabaseAdmin
      .from('whatsapp_templates')
      .insert({
        whatsapp_configuration_id: config.id,
        template_name: normalizedName,
        format_type: 'positional',
        args: args || [],
        meta_status: String(metaData.status || 'PENDING').toUpperCase(),
        meta_template_id: metaData.id,
        language: payload.language,
        category,
        components,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (dbError) return res.status(500).json({ error: dbError.message });
    return res.status(201).json(template);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meta/templates/sync
 * Syncs the status of local templates with Meta
 */
app.get('/api/meta/templates/sync', requireWorkspaceAdmin, async (req, res) => {
  const { tenantId } = req.workspaceAdmin;
  const mode = String(req.query.mode || 'pending').toLowerCase(); // pending | all

  try {
    const { data: config, error: configError } = await supabaseAdmin
      .from('whatsapp_configurations')
      .select('id, waba_id, token')
      .eq('tenant_id', tenantId)
      .single();

    if (configError || !config) return res.status(400).json({ error: 'WhatsApp config not found' });

    // 1) Fetch all templates from Meta
    const metaRes = await fetch(`https://graph.facebook.com/v23.0/${config.waba_id}/message_templates?limit=100`, {
      headers: { 'Authorization': `Bearer ${config.token}` },
    });

    const metaData = await metaRes.json();
    if (!metaRes.ok) return res.status(metaRes.status).json({ error: metaData.error?.message });

    const metaTemplates = metaData.data || [];
    let syncedCount = 0;
    let importedCount = 0;

    // 2) Read all local templates for this tenant config so we can both update and import.
    const { data: localTemplates = [] } = await supabaseAdmin
      .from('whatsapp_templates')
      .select('id, meta_template_id, template_name, meta_status')
      .eq('whatsapp_configuration_id', config.id)
      .is('deleted_at', null);

    const localByMetaId = new Map(localTemplates.filter((t) => t.meta_template_id).map((t) => [t.meta_template_id, t]));
    const localByName = new Map(localTemplates.map((t) => [t.template_name, t]));

    // 3) Update existing local templates from Meta statuses/details.
    for (const local of localTemplates) {
      // Keep old "pending-only" behavior for status update unless mode=all.
      if (mode !== 'all' && local.meta_status !== 'PENDING') continue;
      const match = metaTemplates.find((t) => t.id === local.meta_template_id || t.name === local.template_name);
      if (!match) continue;

      await supabaseAdmin
        .from('whatsapp_templates')
        .update({
          meta_status: String(match.status || 'PENDING').toUpperCase(),
          meta_template_id: match.id,
          language: match.language || undefined,
          category: match.category || undefined,
          components: match.components || undefined,
        })
        .eq('id', local.id);
      syncedCount++;
    }

    // 4) Import templates created directly in Meta but missing locally.
    for (const remote of metaTemplates) {
      const exists = localByMetaId.has(remote.id) || localByName.has(remote.name);
      if (exists) continue;

      const { error: insertError } = await supabaseAdmin
        .from('whatsapp_templates')
        .insert({
          whatsapp_configuration_id: config.id,
          template_name: String(remote.name || '').trim(),
          format_type: 'positional',
          args: [],
          meta_status: String(remote.status || 'PENDING').toUpperCase(),
          meta_template_id: remote.id || null,
          language: remote.language || 'es_LA',
          category: remote.category || 'UTILITY',
          components: remote.components || [],
        });

      if (!insertError) importedCount++;
    }

    return res.json({
      success: true,
      mode: mode === 'all' ? 'all' : 'pending',
      synced: syncedCount,
      imported: importedCount,
      total_remote: metaTemplates.length,
      total_local: localTemplates.length + importedCount,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Admin server running on http://localhost:${PORT}`);
    console.log(`   Supabase: ${process.env.SUPABASE_URL}`);
  });
}

export default app;
