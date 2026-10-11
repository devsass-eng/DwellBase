// src/api/client.ts
// Central API client for DwellBase multi-landlord platform

const BASE_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL || "http://localhost:4000";

// ─── Token & Auth helpers ─────────────────────────────────────────────────────

export type AppRole = 'super_admin' | 'landlord' | 'tenant';

export function detectRole(path?: string): AppRole {
  if (path && path.startsWith("/api/superadmin")) return "super_admin";
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname.startsWith("/superadmin")) return "super_admin";
    if (pathname.startsWith("/landlord")) return "landlord";
    if (pathname.startsWith("/tenant")) return "tenant";
    if (pathname === "/superadmin-login") return "super_admin";
    if (pathname === "/admin-login" || pathname === "/activate") return "landlord";
    if (pathname === "/tenant-login") return "tenant";

    try {
      const sessionRole = sessionStorage.getItem("dwellbase_active_role") as AppRole | null;
      if (sessionRole && ["super_admin", "landlord", "tenant"].includes(sessionRole)) {
        return sessionRole;
      }
    } catch { /* ignore */ }
  }
  const legacyRole = localStorage.getItem("dwellbase_role") as AppRole | null;
  if (legacyRole && ["super_admin", "landlord", "tenant"].includes(legacyRole)) {
    return legacyRole;
  }
  return "landlord";
}

export function getToken(role?: string): string | null {
  const targetRole = (role as AppRole) || detectRole();
  const roleToken = localStorage.getItem(`dwellbase_token_${targetRole}`);
  if (roleToken) return roleToken;

  // Fallback to legacy single token if role matches or only one exists
  const legacyRole = localStorage.getItem("dwellbase_role");
  const legacyToken = localStorage.getItem("dwellbase_token");
  if (legacyToken && (!legacyRole || legacyRole === targetRole)) {
    return legacyToken;
  }
  return null;
}

export function setToken(token: string, role?: AppRole): void {
  const targetRole = role || detectRole();
  localStorage.setItem(`dwellbase_token_${targetRole}`, token);
  localStorage.setItem("dwellbase_token", token);
}

export function setSession(
  role: AppRole,
  token: string,
  user: Record<string, unknown> | null | undefined,
  authInfo: Record<string, unknown>
): void {
  // Store role-isolated session keys in localStorage
  localStorage.setItem(`dwellbase_token_${role}`, token);
  if (user) {
    localStorage.setItem(`dwellbase_user_${role}`, JSON.stringify(user));
  }
  localStorage.setItem(`dwellbase_auth_${role}`, JSON.stringify(authInfo));

  // Store tab-isolated active role in sessionStorage
  try {
    sessionStorage.setItem("dwellbase_active_role", role);
  } catch { /* ignore */ }

  // Maintain legacy keys for backwards compatibility
  localStorage.setItem("dwellbase_token", token);
  localStorage.setItem("dwellbase_role", role);
  if (user) {
    localStorage.setItem("dwellbase_user", JSON.stringify(user));
  }
  localStorage.setItem("dwellbase_auth", JSON.stringify(authInfo));
}

export function clearSession(role?: string): void {
  if (role) {
    localStorage.removeItem(`dwellbase_token_${role}`);
    localStorage.removeItem(`dwellbase_user_${role}`);
    localStorage.removeItem(`dwellbase_auth_${role}`);
    try {
      if (sessionStorage.getItem("dwellbase_active_role") === role) {
        sessionStorage.removeItem("dwellbase_active_role");
      }
    } catch { /* ignore */ }
  } else {
    // Clear all roles
    (['super_admin', 'landlord', 'tenant'] as const).forEach((r) => {
      localStorage.removeItem(`dwellbase_token_${r}`);
      localStorage.removeItem(`dwellbase_user_${r}`);
      localStorage.removeItem(`dwellbase_auth_${r}`);
    });
    localStorage.removeItem("dwellbase_token");
    localStorage.removeItem("dwellbase_role");
    localStorage.removeItem("dwellbase_user");
    localStorage.removeItem("dwellbase_auth");
    try {
      sessionStorage.clear();
    } catch { /* ignore */ }
  }
}

export function clearToken(): void {
  clearSession();
}

export function getRole(): string | null {
  try {
    const sessionRole = sessionStorage.getItem("dwellbase_active_role");
    if (sessionRole) return sessionRole;
  } catch { /* ignore */ }
  return detectRole();
}

export function getAuth(role?: string): { role: string; [key: string]: unknown } | null {
  const targetRole = role || detectRole();
  const roleRaw = localStorage.getItem(`dwellbase_auth_${targetRole}`);
  if (roleRaw) {
    try {
      return JSON.parse(roleRaw);
    } catch { /* ignore */ }
  }
  // Fallback to legacy dwellbase_auth if its role matches targetRole
  const legacyRaw = localStorage.getItem("dwellbase_auth");
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw);
      if (!targetRole || parsed.role === targetRole) {
        return parsed;
      }
    } catch { /* ignore */ }
  }
  return null;
}

export function getUser(role?: string): Record<string, unknown> | null {
  const targetRole = role || detectRole();
  const roleUserRaw = localStorage.getItem(`dwellbase_user_${targetRole}`);
  if (roleUserRaw) {
    try {
      return JSON.parse(roleUserRaw);
    } catch { /* ignore */ }
  }
  const legacyRaw = localStorage.getItem("dwellbase_user");
  if (legacyRaw) {
    try {
      return JSON.parse(legacyRaw);
    } catch { /* ignore */ }
  }
  return null;
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken(path.startsWith("/api/superadmin") ? "super_admin" : undefined);
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
  role?: string;
  landlord?: Record<string, unknown>;
  tenant?: Record<string, unknown>;
  superAdmin?: Record<string, unknown>;
}

export interface PublicPlatformSettings {
  one_time_fee?: string;
  platform_name?: string;
  tagline?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_momo_number?: string;
  contact_momo_name?: string;
  contact_instructions?: string;
  [key: string]: string | undefined;
}

export const auth = {
  getPublicSettings: () => apiFetch<PublicPlatformSettings>("/api/auth/public-settings"),
  verifyActivationToken: (token: string) =>
    apiFetch<{
      valid: boolean;
      landlord: { id: string; fullName: string; email: string; propertyName: string };
      expiresAt: string;
    }>(`/api/auth/verify-activation-token?token=${encodeURIComponent(token)}`),
  completeActivation: (token: string, password: string) =>
    apiFetch<{
      success: boolean;
      token: string;
      landlord: Record<string, unknown>;
      message: string;
    }>("/api/auth/complete-activation", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  superAdminLogin: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/superadmin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  landlordLogin: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/landlord/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  tenantLogin: (tenantId: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/tenant/login", { method: "POST", body: JSON.stringify({ tenantId, password }) }),
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

// ─── Payments (Tenant to Landlord) ───────────────────────────────────────────

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

export interface OneTimePaymentRecord {
  id: string;
  payment_id: string;
  landlord_id: string;
  landlord_name: string;
  landlord_email: string;
  landlord_code?: string;
  landlord_phone?: string;
  landlord_account_status?: string;
  amount: number;
  payment_method: 'cash' | 'direct_momo';
  date_received: string;
  external_reference?: string;
  receipt_number?: string;
  status: 'pending_verification' | 'approved' | 'rejected' | 'reversed';
  recorded_by: string;
  approved_by?: string;
  approval_date?: string;
  rejection_reason?: string;
  reversal_reason?: string;
  notes?: string;
  created_at: string;
}

export interface SuperAdminLandlord {
  id: string;
  landlord_code?: string;
  full_name: string;
  email: string;
  phone: string;
  property_name: string;
  property_address: string;
  one_time_fee: number;
  is_paid: boolean;
  payment_approved_at?: string;
  account_activated_at?: string;
  account_status: 'Active' | 'Pending Payment' | 'Pending Activation' | 'Suspended';
  suspension_reason?: string;
  created_at: string;
  updated_at: string;
  room_count: number;
  tenant_count: number;
  latest_payment?: OneTimePaymentRecord;
}

export interface SuperAdminStats {
  totalLandlords: number;
  activeLandlords: number;
  pendingPayment: number;
  pendingActivation: number;
  suspendedAccounts: number;
  totalApprovedCollections: number;
  totalRooms: number;
  totalTenants: number;
  recentLandlords: SuperAdminLandlord[];
  recentPayments: OneTimePaymentRecord[];
  recentAudit: SuperAdminAuditLog[];
}

export interface SuperAdminAuditLog {
  id: string;
  super_admin_id: string;
  super_admin_name: string;
  action: string;
  landlord_id?: string;
  landlord_name?: string;
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
    payments: OneTimePaymentRecord[];
    history: SuperAdminAuditLog[];
    activationTokens: { id: string; raw_token: string; expires_at: string; used_at: string | null; created_at: string }[];
  }>(`/api/superadmin/landlords/${id}`),
  createLandlord: (data: {
    fullName: string;
    email: string;
    phone?: string;
    propertyName?: string;
    propertyAddress?: string;
    oneTimeFee?: number;
    paymentReceived?: boolean;
    paymentMethod?: string;
    dateReceived?: string;
    externalReference?: string;
    receiptNumber?: string;
    notes?: string;
    autoApprove?: boolean;
  }) => apiFetch<{
    landlord: SuperAdminLandlord;
    payment?: OneTimePaymentRecord;
    activation?: { token: string; activationLink: string; expiresAt: string };
    message: string;
  }>("/api/superadmin/landlords", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateLandlord: (id: string, updates: Record<string, unknown>) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  activateLandlord: (id: string, notes?: string) =>
    apiFetch<{
      landlord: SuperAdminLandlord;
      activation?: { token: string; activationLink: string; expiresAt: string };
      message: string;
    }>(`/api/superadmin/landlords/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  suspendLandlord: (id: string, reason: string, notes?: string) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason, notes }),
    }),
  reactivateLandlord: (id: string, notes?: string) =>
    apiFetch<{ landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/landlords/${id}/reactivate`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  resetAccess: (id: string, temporaryPassword?: string, notes?: string) =>
    apiFetch<{
      message: string;
      activationLink: string;
      token: string;
      temporaryPassword?: string;
      expiresAt: string;
    }>(`/api/superadmin/landlords/${id}/reset-access`, {
      method: "POST",
      body: JSON.stringify({ temporaryPassword, notes }),
    }),
  getPayments: () => apiFetch<OneTimePaymentRecord[]>("/api/superadmin/payments"),
  recordPayment: (data: {
    landlordId: string;
    amount: number;
    paymentMethod: string;
    dateReceived?: string;
    externalReference?: string;
    receiptNumber?: string;
    notes?: string;
    autoApprove?: boolean;
  }) => apiFetch<{ payment: OneTimePaymentRecord; message: string }>("/api/superadmin/payments", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  approvePayment: (id: string, notes?: string) =>
    apiFetch<{ payment: OneTimePaymentRecord; landlord: SuperAdminLandlord; message: string }>(`/api/superadmin/payments/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  rejectPayment: (id: string, reason: string, notes?: string) =>
    apiFetch<{ payment: OneTimePaymentRecord; message: string }>(`/api/superadmin/payments/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason, notes }),
    }),
  reversePayment: (id: string, reason: string, notes?: string) =>
    apiFetch<{ payment: OneTimePaymentRecord; message: string }>(`/api/superadmin/payments/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason, notes }),
    }),
  getAuditLogs: () => apiFetch<SuperAdminAuditLog[]>("/api/superadmin/audit-logs"),
  getSettings: () => apiFetch<PublicPlatformSettings>("/api/superadmin/settings"),
  updateSettings: (updates: Record<string, string>) =>
    apiFetch<{ settings: PublicPlatformSettings; message: string }>("/api/superadmin/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => apiFetch<{ status: string; time: string }>("/api/health"),
};
