import { supabase } from '../../lib/supabase';

const ADMIN_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_SERVER_URL ?? 'http://localhost:3001';

/** Get auth header from current Supabase session */
async function getAuthHeader(): Promise<{ Authorization: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${ADMIN_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ── Tenants ───────────────────────────────────────────────────
export const adminTenantsService = {
  getAll: () => adminFetch<any[]>('/admin/tenants'),
  create: (body: { name: string; nit?: string; address?: string }) =>
    adminFetch('/admin/tenants', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; nit?: string; address?: string }) =>
    adminFetch(`/admin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    adminFetch(`/admin/tenants/${id}`, { method: 'DELETE' }),
};

// ── Users (global) ────────────────────────────────────────────
export const adminUsersService = {
  create: (body: { email: string; password: string; name: string; role: string; tenant_id: string }) =>
    adminFetch('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) =>
    adminFetch(`/admin/users/${id}`, { method: 'DELETE' }),
};

// ── Subscriptions ────────────────────────────────────────────
export const adminSubscriptionsService = {
  getAll:  () => adminFetch<any[]>('/admin/subscriptions'),
  getPlans: () => adminFetch<any[]>('/admin/plans'),
  create: (body: { tenant_id: string; subscription_plan_id: string; price: number; expiration_date: string }) =>
    adminFetch('/admin/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
  toggle: (id: string) =>
    adminFetch(`/admin/subscriptions/${id}/toggle`, { method: 'PATCH' }),
};

// ── Users (all tenants — read via anon key, RLS allows Superadmin) ──
export const adminUsersReadService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*, tenants(name)')
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return data ?? [];
  },
};
