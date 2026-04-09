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

  // 2. Insert profile
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

  res.status(201).json(profile);
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

  const appBaseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteUrl = `${appBaseUrl}/invite?token=${invite.id}`;

  // Send the invite email through Supabase Auth (SMTP proxy).
  // This keeps email transport inside Supabase Auth service (Brevo SMTP configured in Supabase).
  const { error: authEmailError } = await supabaseAdmin.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: inviteUrl,
    },
  });

  if (authEmailError) {
    return res.status(201).json({
      ...invite,
      invite_url: inviteUrl,
      email_sent: false,
      email_error: authEmailError.message,
    });
  }

  res.status(201).json({ ...invite, invite_url: inviteUrl, email_sent: true });
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
    .maybeSingle();

  if (error || !invite) return res.status(404).json({ error: 'Invitación no encontrada' });
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Invitación ya utilizada o expirada' });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('tenant_invites').update({ status: 'expired' }).eq('id', token);
    return res.status(400).json({ error: 'Invitación expirada' });
  }

  const tenant = Array.isArray(invite.tenants) ? invite.tenants[0] : invite.tenants;
  return res.json({
    token: invite.id,
    tenantId: invite.tenant_id,
    tenantName: tenant?.name ?? 'Workspace',
    email: invite.email,
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

  const { error: memberError } = await supabaseAdmin
    .from('tenant_members')
    .upsert({
      tenant_id: invite.tenant_id,
      user_id: user.id,
      role: invite.role,
      enabled: true,
    }, { onConflict: 'tenant_id,user_id' });
  if (memberError) return res.status(500).json({ error: memberError.message });

  await supabaseAdmin.from('tenant_invites').update({ status: 'accepted' }).eq('id', inviteToken);
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
