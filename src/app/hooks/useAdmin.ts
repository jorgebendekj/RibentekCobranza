import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminTenantsService, adminUsersService, adminSubscriptionsService, adminUsersReadService } from '../services/admin.service';
import { toast } from 'sonner';

// ── Tenants ───────────────────────────────────────────────────

export function useTenants() {
  return useQuery({ queryKey: ['admin', 'tenants'], queryFn: adminTenantsService.getAll });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminTenantsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }); toast.success('Tenant creado'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; nit?: string; address?: string }) =>
      adminTenantsService.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }); toast.success('Tenant actualizado'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminTenantsService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }); toast.success('Tenant eliminado'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── All users (across tenants) ────────────────────────────────

export function useAllUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: adminUsersReadService.getAll });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminUsersService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast.success('Usuario creado correctamente'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminUsersService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast.success('Usuario eliminado'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Subscriptions ────────────────────────────────────────────

export function useAdminSubscriptions() {
  return useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: adminSubscriptionsService.getAll });
}

export function useAdminPlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: adminSubscriptionsService.getPlans });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminSubscriptionsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }); toast.success('Suscripción creada'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminSubscriptionsService.toggle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
