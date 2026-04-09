import { supabase } from '../../lib/supabase';
import type { Database, WhatsappConfiguration, WhatsappTemplate, Contact } from '../data/supabase.types';

type TemplateInsert = Database['public']['Tables']['whatsapp_templates']['Insert'];

function getAdminBaseUrl() {
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_SERVER_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://localhost:3001';
}

export const whatsappService = {
  // ── Configurations ──────────────────────────────────────────

  /** Get WhatsApp config for tenant (one per tenant) */
  async getConfiguration(tenantId: string): Promise<WhatsappConfiguration | null> {
    const { data, error } = await supabase
      .from('whatsapp_configurations')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Upsert WhatsApp configuration */
  async saveConfiguration(
    tenantId: string,
    payload: {
      channel_name?: string;
      meta_id: string;
      waba_id: string;
      phone_number_id?: string;
      token: string;
      verify_token?: string;
      default_template_language?: string;
    }
  ): Promise<WhatsappConfiguration> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('No active session');
    const adminUrl = getAdminBaseUrl();

    const res = await fetch(`${adminUrl}/api/meta/configurations/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error validando y guardando configuración');
    return json.configuration as WhatsappConfiguration;
  },

  // ── Templates ───────────────────────────────────────────────

  /** All templates for a tenant (joins through whatsapp_configurations) */
  async getTemplates(tenantId: string): Promise<WhatsappTemplate[]> {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*, whatsapp_configurations!inner(tenant_id)')
      .eq('whatsapp_configurations.tenant_id', tenantId)
      .is('deleted_at', null)
      .order('template_name');
    if (error) throw error;
    return (data ?? []) as WhatsappTemplate[];
  },

  /** Create a template */
  async createTemplate(payload: TemplateInsert): Promise<WhatsappTemplate> {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Create Meta template through backend proxy */
  async createMetaTemplate(
    tenantId: string,
    payload: {
      name: string;
      language: string;
      category: string;
      components: Array<Record<string, unknown>>;
      args?: string[];
    }
  ) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('No active session');
    const adminUrl = getAdminBaseUrl();

    const res = await fetch(`${adminUrl}/api/meta/templates/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error creando plantilla');
    return json as WhatsappTemplate;
  },

  /** Sync Meta template statuses through backend proxy */
  async syncMetaTemplates(tenantId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('No active session');
    const adminUrl = getAdminBaseUrl();

    const res = await fetch(`${adminUrl}/api/meta/templates/sync`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error sincronizando plantillas');
    return json as { success: boolean; synced: number; total_remote: number; total_local: number };
  },

  /** Send a free-text message to a contact via Meta proxy */
  async sendMessage(
    tenantId: string,
    payload: { phone_number: string; message_text: string; thread_id?: string }
  ) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('No active session');
    const adminUrl = getAdminBaseUrl();

    const res = await fetch(`${adminUrl}/api/meta/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error enviando mensaje');
    return json as { success: boolean; message?: Record<string, unknown> };
  },

  /** Search contacts by name or phone within a tenant */
  async searchContacts(tenantId: string, query: string): Promise<Contact[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(`name.ilike.${q},phone_number.ilike.${q}`)
      .limit(10);
    if (error) throw error;
    return data ?? [];
  },
};
