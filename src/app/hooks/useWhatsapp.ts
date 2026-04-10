import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappService } from '../services/whatsapp.service';
import type { MessagingMetricsFilters } from '../services/whatsapp.service';
import { useAuth } from '../context/AuthContext';

export const WA_CONFIG_KEY = 'whatsapp-config';
export const WA_TEMPLATES_KEY = 'whatsapp-templates';
export const WA_METRICS_KEY = 'whatsapp-metrics';

export function useWhatsappConfig() {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: [WA_CONFIG_KEY, tenantId],
    queryFn: () => whatsappService.getConfiguration(tenantId!),
    enabled: !!tenantId,
  });
}

export function useSaveWhatsappConfig() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      channel_name?: string;
      meta_id: string;
      waba_id: string;
      phone_number_id?: string;
      token: string;
      verify_token?: string;
      default_template_language?: string;
    }) =>
      whatsappService.saveConfiguration(tenantId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WA_CONFIG_KEY, tenantId] }),
  });
}

export function useTemplates() {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: [WA_TEMPLATES_KEY, tenantId],
    queryFn: async () => {
      // Keep Meta and local DB in sync before showing the template list.
      await whatsappService.syncMetaTemplates(tenantId!).catch(() => null);
      return whatsappService.getTemplates(tenantId!);
    },
    enabled: !!tenantId,
  });
}

export function useCreateMetaTemplate() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      language: string;
      category: string;
      components: Array<Record<string, unknown>>;
      args?: string[];
    }) => whatsappService.createMetaTemplate(tenantId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WA_TEMPLATES_KEY, tenantId] }),
  });
}

export function useSyncMetaTemplates() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => whatsappService.syncMetaTemplates(tenantId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WA_TEMPLATES_KEY, tenantId] }),
  });
}

export function useMessagingMetrics(filters: MessagingMetricsFilters) {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: [WA_METRICS_KEY, tenantId, filters],
    queryFn: () => whatsappService.getMessagingMetrics(tenantId!, filters),
    enabled: !!tenantId && !!filters.from && !!filters.to,
  });
}
