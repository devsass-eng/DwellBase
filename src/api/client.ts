// src/api/client.ts
// Central API client for DwellBase backend

const BASE_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL || "http://localhost:4000";

// ─── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem("dwellbase_token");
}

export function setToken(token: string): void {
  localStorage.setItem("dwellbase_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("dwellbase_token");
  localStorage.removeItem("dwellbase_role");
  localStorage.removeItem("dwellbase_user");
}

export function getRole(): string | null {
  return localStorage.getItem("dwellbase_role");
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = (data as { error?: string }).error || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  landlord?: Record<string, unknown>;
  tenant?: Record<string, unknown>;
  superAdmin?: Record<string, unknown>;
}

export const auth = {
  landlordRegister: (body: { fullName: string; email: string; password: string; phone?: string; propertyName?: string }) =>
    apiFetch<AuthResponse>("/api/auth/landlord/register", { method: "POST", body: JSON.stringify(body) }),
  landlordLogin: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/landlord/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  tenantLogin: (tenantId: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/tenant/login", { method: "POST", body: JSON.stringify({ tenantId, password }) }),
  superAdminLogin: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/superadmin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
};

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  list: () => apiFetch<unknown[]>("/api/rooms"),
  create: (monthlyRent: number) =>
    apiFetch<unknown>("/api/rooms", { method: "POST", body: JSON.stringify({ monthlyRent }) }),
  update: (id: string, updates: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/rooms/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
};

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenantsApi = {
  list: () => apiFetch<unknown[]>("/api/tenants"),
  me: () => apiFetch<unknown>("/api/tenants/me"),
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>("/api/tenants", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, updates: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/tenants/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
};

// ─── Charges ─────────────────────────────────────────────────────────────────

export const chargesApi = {
  list: () => apiFetch<unknown[]>("/api/charges"),
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>("/api/charges", { method: "POST", body: JSON.stringify(data) }),
  updateStatus: (id: string, updates: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/charges/${id}/status`, { method: "PATCH", body: JSON.stringify(updates) }),
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export const paymentsApi = {
  list: () => apiFetch<unknown[]>("/api/payments"),
  recordCash: (data: Record<string, unknown>) =>
    apiFetch<unknown>("/api/payments/cash", { method: "POST", body: JSON.stringify(data) }),
  initiateMomo: (data: Record<string, unknown>) =>
    apiFetch<unknown>("/api/payments/momo", { method: "POST", body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, providerRef?: string) =>
    apiFetch<unknown>(`/api/payments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, providerRef }) }),
  reverse: (id: string, reason: string) =>
    apiFetch<unknown>(`/api/payments/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
};

// ─── Regulations ─────────────────────────────────────────────────────────────

export const regulationsApi = {
  list: () => apiFetch<unknown[]>("/api/regulations"),
  create: (text: string) =>
    apiFetch<unknown>("/api/regulations", { method: "POST", body: JSON.stringify({ text }) }),
  delete: (id: string) =>
    apiFetch<unknown>(`/api/regulations/${id}`, { method: "DELETE" }),
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => apiFetch<unknown>("/api/settings"),
  update: (updates: Record<string, unknown>) =>
    apiFetch<unknown>("/api/settings", { method: "PATCH", body: JSON.stringify(updates) }),
  getCategories: () => apiFetch<unknown[]>("/api/settings/billing-categories"),
  createCategory: (data: Record<string, unknown>) =>
    apiFetch<unknown>("/api/settings/billing-categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: string, updates: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/settings/billing-categories/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
  summary: () => apiFetch<unknown>("/api/reports/summary"),
  auditLogs: () => apiFetch<unknown[]>("/api/reports/audit-logs"),
};

// ─── Super Admin API ─────────────────────────────────────────────────────────

export interface SuperAdminLandlord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  property_name: string;
  property_address: string;
  subscription_plan: 'Starter' | 'Standard' | 'Pro' | 'Enterprise';
  subscription_duration_months: number;
  subscription_start_date: string;
  subscription_end_date: string;
  account_status: 'Active' | 'Suspended' | 'Expired' | 'Pending Activation';
  computedStatus?: string;
  created_at: string;
  updated_at: string;
  room_count: number;
  tenant_count: number;
  active_tenant_count: number;
  total_billed: number;
  total_paid: number;
}

export interface SuperAdminStats {
  totalLandlords: number;
  activeLandlords: number;
  suspendedLandlords: number;
  pendingLandlords: number;
  expiredLandlords: number;
  totalRooms: number;
  totalTenants: number;
  totalCharged: number;
  totalCollected: number;
}

export interface SuperAdminAuditLog {
  id: string;
  super_admin_id: string;
  super_admin_name: string;
  action: string;
  landlord_id: string;
  landlord_name: string;
  details: Record<string, unknown>;
  notes: string;
  ip_address?: string;
  created_at: string;
}

export const superAdminApi = {
  getStats: () => apiFetch<SuperAdminStats>("/api/superadmin/stats"),
  getLandlords: () => apiFetch<SuperAdminLandlord[]>("/api/superadmin/landlords"),
  getLandlord: (id: string) => apiFetch<{
    landlord: SuperAdminLandlord;
    rooms: unknown[];
    tenants: unknown[];
    recentPayments: unknown[];
    history: SuperAdminAuditLog[];
  }>(`/api/superadmin/landlords/${id}`),
  createLandlord: (data: {
    fullName: string;
    email: string;
    password?: string;
    phone?: string;
    propertyName?: string;
    propertyAddress?: string;
    subscriptionPlan?: string;
    subscriptionDurationMonths?: number;
    subscriptionStartDate?: string;
    accountStatus?: string;
    notes?: string;
  }) => apiFetch<{ landlord: SuperAdminLandlord; initialPassword?: string; message: string }>("/api/superadmin/landlords", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateLandlord: (id: string, updates: Record<string, unknown>) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  activateLandlord: (id: string, notes?: string) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  suspendLandlord: (id: string, reason: string, notes?: string) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason, notes }),
    }),
  renewSubscription: (id: string, months: number, notes?: string) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}/renew`, {
      method: "POST",
      body: JSON.stringify({ months, notes }),
    }),
  changePlan: (id: string, plan: string, durationMonths?: number, notes?: string) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}/change-plan`, {
      method: "POST",
      body: JSON.stringify({ plan, durationMonths, notes }),
    }),
  resetAccess: (id: string, temporaryPassword?: string, notes?: string) =>
    apiFetch<{
      message: string;
      temporaryPassword?: string;
      resetToken?: string;
      resetLink?: string;
      expiresAt: string;
    }>(`/api/superadmin/landlords/${id}/reset-access`, {
      method: "POST",
      body: JSON.stringify({ temporaryPassword, notes }),
    }),
  getLandlordHistory: (id: string) => apiFetch<SuperAdminAuditLog[]>(`/api/superadmin/landlords/${id}/history`),
  getAuditLogs: () => apiFetch<SuperAdminAuditLog[]>("/api/superadmin/audit-logs"),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => apiFetch<{ status: string; time: string }>("/api/health"),
};

