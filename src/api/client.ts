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
}

export const auth = {
  landlordRegister: (body: { fullName: string; email: string; password: string; phone?: string; propertyName?: string }) =>
    apiFetch<AuthResponse>("/api/auth/landlord/register", { method: "POST", body: JSON.stringify(body) }),
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

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => apiFetch<{ status: string; time: string }>("/api/health"),
};
