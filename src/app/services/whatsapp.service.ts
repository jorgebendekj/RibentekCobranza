import { supabase } from '../../lib/supabase';
import type { Database, WhatsappConfiguration, WhatsappTemplate } from '../data/supabase.types';

type ConfigInsert = Database['public']['Tables']['whatsapp_configurations']['Insert'];
type TemplateInsert = Database['public']['Tables']['whatsapp_templates']['Insert'];

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
  async saveConfiguration(tenantId: string, payload: { meta_id: string; waba_id: string; token: string }, userId: string): Promise<WhatsappConfiguration> {
    // Try to find existing
    const existing = await whatsappService.getConfiguration(tenantId);

    if (existing) {
      const { data, error } = await supabase
        .from('whatsapp_configurations')
        .update({ ...payload, updated_by: userId })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const insert: ConfigInsert = {
      ...payload,
      tenant_id: tenantId,
      created_by: userId,
      updated_by: userId,
    };
    const { data, error } = await supabase
      .from('whatsapp_configurations')
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    return data;
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
};
