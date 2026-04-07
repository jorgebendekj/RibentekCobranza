import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappService } from '../services/whatsapp.service';
import { useAuth } from '../context/AuthContext';

export const WA_CONFIG_KEY = 'whatsapp-config';
export const WA_TEMPLATES_KEY = 'whatsapp-templates';

export function useWhatsappConfig() {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: [WA_CONFIG_KEY, tenantId],
    queryFn: () => whatsappService.getConfiguration(tenantId!),
    enabled: !!tenantId,
  });
}

export function useSaveWhatsappConfig() {
  const { tenantId, dbUser } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { meta_id: string; waba_id: string; token: string }) =>
      whatsappService.saveConfiguration(tenantId!, payload, dbUser?.id ?? ''),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WA_CONFIG_KEY, tenantId] }),
  });
}

export function useTemplates() {
  const { tenantId } = useAuth();
  return useQuery({
    queryKey: [WA_TEMPLATES_KEY, tenantId],
    queryFn: () => whatsappService.getTemplates(tenantId!),
    enabled: !!tenantId,
  });
}
