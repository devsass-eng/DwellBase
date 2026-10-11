import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  roomsApi, tenantsApi, chargesApi, paymentsApi,
  regulationsApi, settingsApi, reportsApi, getToken, getRole
} from "../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  sequenceNumber: number;
  roomNumber: string;
  roomCode: string;
  monthlyRent: number;
  status: "Vacant" | "Occupied" | "Maintenance";
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email: string;
  roomId: string;
  roomNumber: string;
  roomCode: string;
  monthlyRent: number;
  startDate: string;
  durationMonths: number;
  endDate: string;
  totalContractualRent: number;
  amountPaid: number;
  outstandingBalance: number;
  tenancyStatus: "Upcoming" | "Active" | "Expiring Soon" | "Expired" | "Ended";
  accountStatus: "Not Set Up" | "Invitation Pending" | "Active" | "Suspended";
  notificationPreferences?: {
    paymentConfirmations: boolean;
    manualMomo: boolean;
    upcomingBills: boolean;
    overdueCharges: boolean;
    newRegulations: boolean;
  };
}

export type BillingFrequency = "monthly" | "yearly" | "custom";

export interface BillingCategory {
  id: string;
  name: string;
  description: string;
  billingFrequency: BillingFrequency;
  customIntervalMonths?: number;
  defaultAmount?: number;
  isDefault: boolean;
  status: "active" | "archived";
  gracePeriodDays: number;
  createdAt: string;
}

export type ChargeStatus = "upcoming" | "pending" | "overdue" | "paid" | "partially_paid";

export interface Charge {
  id: string;
  categoryId: string;
  categoryName: string;
  tenantId: string;
  tenantName: string;
  roomId: string;
  roomNumber: string;
  amount: number;
  amountPaid: number;
  remainingBalance: number;
  issueDate: string;
  dueDate: string;
  billingPeriod: string;
  status: ChargeStatus;
  issuedBy: string;
  createdAt: string;
}

export type PaymentMethod = "cash" | "momo";
export type PaymentStatus = "pending" | "processing" | "successful" | "failed" | "reversed" | "pending_sync";
export type MomoNetwork = "mtn" | "telecel" | "at";

export interface PaymentRecord {
  id: string;
  referenceNumber: string;
  tenantId: string;
  tenantName: string;
  roomId: string;
  roomNumber: string;
  chargeId: string;
  categoryId: string;
  categoryName: string;
  billingPeriod: string;
  amount: number;
  paymentMethod: PaymentMethod;
  momoNetwork?: MomoNetwork;
  providerRef?: string;
  status: PaymentStatus;
  recordedBy: string;
  paymentDate: string;
  notes?: string;
  receiptRef?: string;
  receiptNumber?: string;
  createdAt: string;
}

export interface Regulation {
  id: string;
  text: string;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  entityType: "payment" | "charge" | "tenant";
  entityId: string;
  field: string;
  originalValue: string;
  correctedValue: string;
  actor: string;
  timestamp: string;
  reason: string;
}

export interface LandlordProfile {
  fullName: string;
  phone: string;
  email: string;
  propertyName: string;
  propertyAddress: string;
}

export interface LandlordPaymentSettings {
  momoNetwork: MomoNetwork | "";
  momoName: string;
  momoNumber: string;
  paymentInstructions: string;
}

export interface LandlordNotificationPreferences {
  newTenant: boolean;
  manualMomo: boolean;
  confirmedPayment: boolean;
  upcomingCharges: boolean;
  overdueCharges: boolean;
}

// ─── DB row -> domain model mappers ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoom(r: any): Room {
  return {
    id: r.id,
    sequenceNumber: r.sequence_number,
    roomNumber: r.room_number,
    roomCode: r.room_code,
    monthlyRent: Number(r.monthly_rent),
    status: r.status,
    archived: r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTenant(t: any): Tenant {
  return {
    id: t.id,
    tenantId: t.tenant_id,
    fullName: t.full_name,
    phone: t.phone || "",
    email: t.email || "",
    roomId: t.room_id || "",
    roomNumber: t.room_number || "",
    roomCode: t.room_code || "",
    monthlyRent: Number(t.monthly_rent || 0),
    startDate: t.start_date || "",
    durationMonths: Number(t.duration_months || 0),
    endDate: t.end_date || "",
    totalContractualRent: Number(t.total_contractual_rent || 0),
    amountPaid: Number(t.amount_paid || 0),
    outstandingBalance: Number(t.outstanding_balance || 0),
    tenancyStatus: t.tenancy_status,
    accountStatus: t.account_status,
    notificationPreferences: {
      paymentConfirmations: t.notif_payment_confirmations ?? true,
      manualMomo: t.notif_manual_momo ?? true,
      upcomingBills: t.notif_upcoming_bills ?? false,
      overdueCharges: t.notif_overdue_charges ?? true,
      newRegulations: t.notif_new_regulations ?? true,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategory(c: any): BillingCategory {
  return {
    id: c.id,
    name: c.name,
    description: c.description || "",
    billingFrequency: c.billing_frequency,
    customIntervalMonths: c.custom_interval_months,
    defaultAmount: c.default_amount !== null ? Number(c.default_amount) : undefined,
    isDefault: c.is_default,
    status: c.status,
    gracePeriodDays: Number(c.grace_period_days || 7),
    createdAt: c.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCharge(c: any): Charge {
  return {
    id: c.id,
    categoryId: c.category_id || "",
    categoryName: c.category_name,
    tenantId: c.tenant_id || "",
    tenantName: c.tenant_name,
    roomId: c.room_id || "",
    roomNumber: c.room_number,
    amount: Number(c.amount),
    amountPaid: Number(c.amount_paid || 0),
    remainingBalance: Number(c.remaining_balance),
    issueDate: c.issue_date,
    dueDate: c.due_date,
    billingPeriod: c.billing_period,
    status: c.status,
    issuedBy: c.issued_by,
    createdAt: c.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(p: any): PaymentRecord {
  return {
    id: p.id,
    referenceNumber: p.reference_number,
    tenantId: p.tenant_id || "",
    tenantName: p.tenant_name,
    roomId: p.room_id || "",
    roomNumber: p.room_number,
    chargeId: p.charge_id || "",
    categoryId: p.category_id || "",
    categoryName: p.category_name,
    billingPeriod: p.billing_period,
    amount: Number(p.amount),
    paymentMethod: p.payment_method,
    momoNetwork: p.momo_network,
    providerRef: p.provider_ref,
    status: p.status,
    recordedBy: p.recorded_by,
    paymentDate: p.payment_date,
    notes: p.notes,
    receiptRef: p.receipt_ref,
    receiptNumber: p.receipt_number,
    createdAt: p.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRegulation(r: any): Regulation {
  return { id: r.id, text: r.text, createdAt: r.created_at };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAuditLog(a: any): AuditRecord {
  return {
    id: a.id,
    entityType: a.entity_type,
    entityId: a.entity_id,
    field: a.field,
    originalValue: a.original_value || "",
    correctedValue: a.corrected_value || "",
    actor: a.actor,
    timestamp: a.created_at,
    reason: a.reason || "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettings(s: any): { profile: LandlordProfile; paymentSettings: LandlordPaymentSettings; notifPrefs: LandlordNotificationPreferences } {
  return {
    profile: {
      fullName: s.full_name || "",
      phone: s.phone || "",
      email: s.email || "",
      propertyName: s.property_name || "",
      propertyAddress: s.property_address || "",
    },
    paymentSettings: {
      momoNetwork: s.momo_network || "",
      momoName: s.momo_name || "",
      momoNumber: s.momo_number || "",
      paymentInstructions: s.payment_instructions || "",
    },
    notifPrefs: {
      newTenant: s.notif_new_tenant ?? true,
      manualMomo: s.notif_manual_momo ?? true,
      confirmedPayment: s.notif_confirmed_payment ?? true,
      upcomingCharges: s.notif_upcoming_charges ?? false,
      overdueCharges: s.notif_overdue_charges ?? true,
    },
  };
}

// ─── Context Interface ────────────────────────────────────────────────────────

interface AppDataContextType {
  loading: boolean;
  // Rooms
  rooms: Room[];
  nextRoomSequence: number;
  addRoom: (monthlyRent: number) => Promise<Room>;
  updateRoom: (roomId: string, updates: Partial<Pick<Room, "monthlyRent" | "status" | "archived">>) => Promise<void>;
  archiveRoom: (roomId: string) => Promise<boolean>;

  // Tenants
  tenants: Tenant[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addTenant: (tenant: Omit<Tenant, "id"> & { createLogin?: string }) => Promise<any>;
  updateTenant: (id: string, updates: Partial<Tenant>) => Promise<void>;
  endTenancy: (tenantId: string) => Promise<void>;
  removeTenant: (tenantId: string, reason: string) => Promise<{ success: boolean; debtWarning?: string }>;

  // Billing Categories
  categories: BillingCategory[];
  addCategory: (cat: Omit<BillingCategory, "id" | "createdAt" | "isDefault">) => Promise<void>;
  updateCategory: (id: string, updates: Partial<BillingCategory>) => Promise<void>;
  archiveCategory: (id: string) => Promise<void>;

  // Charges
  charges: Charge[];
  issueCharge: (charge: Omit<Charge, "id" | "amountPaid" | "remainingBalance" | "status" | "createdAt">) => Promise<Charge>;
  recalculateChargeStatus: (chargeId: string) => void;
  recordCorrection: (chargeId: string, newAmount: number, reason: string, actor: string) => void;

  // Payments
  payments: PaymentRecord[];
  recordCashPayment: (payment: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; paymentDate: string; notes?: string; receiptRef?: string;
    recordedBy: string;
  }) => Promise<PaymentRecord | { error: string }>;
  initiateMoneyPayment: (payment: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; momoNetwork: MomoNetwork;
  }) => Promise<PaymentRecord>;
  updatePaymentStatus: (paymentId: string, status: PaymentStatus, providerRef?: string) => Promise<void>;
  reversePayment: (paymentId: string, reason: string, actor: string) => Promise<void>;

  // Derived helpers
  getTenantCharges: (tenantId: string) => Charge[];
  getTenantPayments: (tenantId: string) => PaymentRecord[];
  getTenantOutstandingBalance: (tenantId: string) => number;
  getTenantTotalPaid: (tenantId: string) => number;

  // Regulations
  regulations: Regulation[];
  addRegulation: (text: string) => Promise<Regulation>;
  deleteRegulation: (id: string) => Promise<void>;

  // Audit Logs
  auditLogs: AuditRecord[];
  addAuditRecord: (record: Omit<AuditRecord, "id" | "timestamp">) => AuditRecord;

  // Settings
  landlordProfile: LandlordProfile;
  updateLandlordProfile: (updates: Partial<LandlordProfile>) => Promise<void>;
  landlordPaymentSettings: LandlordPaymentSettings;
  updateLandlordPaymentSettings: (updates: Partial<LandlordPaymentSettings>) => Promise<void>;
  landlordNotificationPrefs: LandlordNotificationPreferences;
  updateLandlordNotificationPrefs: (updates: Partial<LandlordNotificationPreferences>) => Promise<void>;

  // Data refresh
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─── Fallback defaults ────────────────────────────────────────────────────────

const DEFAULT_PROFILE: LandlordProfile = {
  fullName: "", phone: "", email: "", propertyName: "DwellBase", propertyAddress: "",
};
const DEFAULT_PAYMENT_SETTINGS: LandlordPaymentSettings = {
  momoNetwork: "", momoName: "", momoNumber: "", paymentInstructions: "",
};
const DEFAULT_NOTIF_PREFS: LandlordNotificationPreferences = {
  newTenant: true, manualMomo: true, confirmedPayment: true, upcomingCharges: false, overdueCharges: true,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [categories, setCategories] = useState<BillingCategory[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [landlordProfile, setLandlordProfile] = useState<LandlordProfile>(DEFAULT_PROFILE);
  const [landlordPaymentSettings, setLandlordPaymentSettings] = useState<LandlordPaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [landlordNotificationPrefs, setLandlordNotificationPrefs] = useState<LandlordNotificationPreferences>(DEFAULT_NOTIF_PREFS);
  const hasFetched = useRef(false);

  const isAuthenticated = () => !!getToken();
  const isLandlord = () => getRole() === "landlord";

  const refresh = useCallback(async () => {
    const role = getRole();
    if (!isAuthenticated() || role === "super_admin") { setLoading(false); return; }
    try {
      if (role === "tenant") {
        const [meRaw, catsRaw, chargesRaw, paymentsRaw, regsRaw, settingsRaw] = await Promise.all([
          tenantsApi.me().catch(() => null),
          settingsApi.getCategories().catch(() => []),
          chargesApi.list().catch(() => []),
          paymentsApi.list().catch(() => []),
          regulationsApi.list().catch(() => []),
          settingsApi.get().catch(() => null),
        ]);
        if (meRaw) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTenants([mapTenant(meRaw as any)]);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCategories((catsRaw as any[]).map(mapCategory));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCharges((chargesRaw as any[]).map(mapCharge));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPayments((paymentsRaw as any[]).map(mapPayment));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRegulations((regsRaw as any[]).map(mapRegulation));
        if (settingsRaw) {
          const { profile, paymentSettings, notifPrefs } = mapSettings(settingsRaw);
          setLandlordProfile(profile);
          setLandlordPaymentSettings(paymentSettings);
          setLandlordNotificationPrefs(notifPrefs);
        }
        return;
      }

      const [roomsRaw, tenantsRaw, catsRaw, chargesRaw, paymentsRaw, regsRaw] = await Promise.all([
        roomsApi.list().catch(() => []),
        tenantsApi.list().catch(() => []),
        settingsApi.getCategories().catch(() => []),
        chargesApi.list().catch(() => []),
        paymentsApi.list().catch(() => []),
        regulationsApi.list().catch(() => []),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRooms((roomsRaw as any[]).map(mapRoom));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTenants((tenantsRaw as any[]).map(mapTenant));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCategories((catsRaw as any[]).map(mapCategory));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCharges((chargesRaw as any[]).map(mapCharge));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPayments((paymentsRaw as any[]).map(mapPayment));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRegulations((regsRaw as any[]).map(mapRegulation));

      if (isLandlord()) {
        const [settingsRaw, auditRaw] = await Promise.all([
          settingsApi.get().catch(() => null),
          reportsApi.auditLogs().catch(() => []),
        ]);
        if (settingsRaw) {
          const { profile, paymentSettings, notifPrefs } = mapSettings(settingsRaw);
          setLandlordProfile(profile);
          setLandlordPaymentSettings(paymentSettings);
          setLandlordNotificationPrefs(notifPrefs);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAuditLogs((auditRaw as any[]).map(mapAuditLog));
      }
    } catch (err) {
      console.error("AppDataContext refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      refresh();
    }
  }, [refresh]);

  const nextRoomSequence = rooms.length > 0
    ? Math.max(...rooms.map(r => r.sequenceNumber)) + 1
    : 1;

  // ── Rooms ────────────────────────────────────────────────────────────────────

  const addRoom = useCallback(async (monthlyRent: number): Promise<Room> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await roomsApi.create(monthlyRent) as any;
    const room = mapRoom(raw);
    setRooms(prev => [...prev, room]);
    return room;
  }, []);

  const updateRoom = useCallback(async (roomId: string, updates: Partial<Pick<Room, "monthlyRent" | "status" | "archived">>) => {
    const payload: Record<string, unknown> = {};
    if (updates.monthlyRent !== undefined) payload.monthlyRent = updates.monthlyRent;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.archived !== undefined) payload.archived = updates.archived;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await roomsApi.update(roomId, payload) as any;
    const room = mapRoom(raw);
    setRooms(prev => prev.map(r => r.id === roomId ? room : r));
  }, []);

  const archiveRoom = useCallback(async (roomId: string): Promise<boolean> => {
    const hasActive = rooms.some(r => r.id === roomId) &&
      tenants.some(t => t.roomId === roomId && (t.tenancyStatus === "Active" || t.tenancyStatus === "Upcoming"));
    if (hasActive) return false;
    await updateRoom(roomId, { archived: true, status: "Vacant" });
    setRooms(prev => prev.filter(r => r.id !== roomId));
    return true;
  }, [rooms, tenants, updateRoom]);

  // ── Tenants ──────────────────────────────────────────────────────────────────

  const addTenant = useCallback(async (tenantData: Omit<Tenant, "id"> & { createLogin?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await tenantsApi.create(tenantData as any) as any;
    const tenant = mapTenant(raw);
    setTenants(prev => [...prev, tenant]);
    if (tenantData.roomId) {
      setRooms(prev => prev.map(r => r.id === tenantData.roomId ? { ...r, status: "Occupied" } : r));
    }
    // Return the raw response so the caller can access loginCredentials
    return raw;
  }, []);

  const updateTenant = useCallback(async (id: string, updates: Partial<Tenant>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await tenantsApi.update(id, updates as any) as any;
    const tenant = mapTenant(raw);
    setTenants(prev => prev.map(t => t.id === id ? tenant : t));
  }, []);

  const endTenancy = useCallback(async (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    await updateTenant(tenantId, { tenancyStatus: "Ended" } as Partial<Tenant>);
    const otherActive = tenants.some(t =>
      t.id !== tenantId && t.roomId === tenant.roomId &&
      (t.tenancyStatus === "Active" || t.tenancyStatus === "Upcoming")
    );
    if (!otherActive && tenant.roomId) {
      await updateRoom(tenant.roomId, { status: "Vacant" });
    }
  }, [tenants, updateTenant, updateRoom]);

  const removeTenant = useCallback(async (tenantId: string, _reason: string): Promise<{ success: boolean; debtWarning?: string }> => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return { success: false };
    const unpaidBalance = charges
      .filter(c => c.tenantId === tenantId && c.status !== "paid")
      .reduce((sum, c) => sum + c.remainingBalance, 0);
    await updateTenant(tenantId, { tenancyStatus: "Ended", accountStatus: "Suspended" } as Partial<Tenant>);
    const otherActive = tenants.some(t =>
      t.id !== tenantId && t.roomId === tenant.roomId &&
      (t.tenancyStatus === "Active" || t.tenancyStatus === "Upcoming")
    );
    if (!otherActive && tenant.roomId) {
      await updateRoom(tenant.roomId, { status: "Vacant" });
    }
    return {
      success: true,
      debtWarning: unpaidBalance > 0
        ? `Tenant has an outstanding balance of GH₵${unpaidBalance.toFixed(2)}. Debt remains attached to their historical record.`
        : undefined,
    };
  }, [tenants, charges, updateTenant, updateRoom]);

  // ── Categories ────────────────────────────────────────────────────────────────

  const addCategory = useCallback(async (cat: Omit<BillingCategory, "id" | "createdAt" | "isDefault">) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await settingsApi.createCategory(cat as any) as any;
    setCategories(prev => [...prev, mapCategory(raw)]);
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<BillingCategory>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await settingsApi.updateCategory(id, updates as any) as any;
    setCategories(prev => prev.map(c => c.id === id ? mapCategory(raw) : c));
  }, []);

  const archiveCategory = useCallback(async (id: string) => {
    await updateCategory(id, { status: "archived" });
  }, [updateCategory]);

  // ── Charges ───────────────────────────────────────────────────────────────────

  const issueCharge = useCallback(async (chargeData: Omit<Charge, "id" | "amountPaid" | "remainingBalance" | "status" | "createdAt">): Promise<Charge> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await chargesApi.create(chargeData as any) as any;
    const charge = mapCharge(raw);
    setCharges(prev => [...prev, charge]);
    return charge;
  }, []);

  const recalculateChargeStatus = useCallback((_chargeId: string) => {
    // Status is managed server-side; trigger a refresh to sync
    refresh();
  }, [refresh]);

  const recordCorrection = useCallback((_chargeId: string, _newAmount: number, _reason: string, _actor: string) => {
    // Correction handled server-side; refresh to sync
    refresh();
  }, [refresh]);

  // ── Payments ─────────────────────────────────────────────────────────────────

  const recordCashPayment = useCallback(async (paymentData: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; paymentDate: string; notes?: string; receiptRef?: string;
    recordedBy: string;
  }): Promise<PaymentRecord | { error: string }> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await paymentsApi.recordCash(paymentData as any) as any;
      const payment = mapPayment(raw);
      setPayments(prev => [payment, ...prev]);
      // Refresh charges and tenants to get updated balances
      const [chargesRaw, tenantsRaw] = await Promise.all([
        chargesApi.list().catch(() => []),
        tenantsApi.list().catch(() => []),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCharges((chargesRaw as any[]).map(mapCharge));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTenants((tenantsRaw as any[]).map(mapTenant));
      return payment;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Payment failed" };
    }
  }, []);

  const initiateMoneyPayment = useCallback(async (paymentData: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; momoNetwork: MomoNetwork;
  }): Promise<PaymentRecord> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await paymentsApi.initiateMomo(paymentData as any) as any;
    const payment = mapPayment(raw);
    setPayments(prev => [payment, ...prev]);
    return payment;
  }, []);

  const updatePaymentStatus = useCallback(async (paymentId: string, status: PaymentStatus, providerRef?: string) => {
    await paymentsApi.updateStatus(paymentId, status, providerRef);
    await refresh();
  }, [refresh]);

  const reversePayment = useCallback(async (paymentId: string, reason: string, _actor: string) => {
    await paymentsApi.reverse(paymentId, reason);
    await refresh();
  }, [refresh]);

  // ── Regulations ───────────────────────────────────────────────────────────────

  const addRegulation = useCallback(async (text: string): Promise<Regulation> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await regulationsApi.create(text) as any;
    const reg = mapRegulation(raw);
    setRegulations(prev => [reg, ...prev]);
    return reg;
  }, []);

  const deleteRegulation = useCallback(async (id: string) => {
    await regulationsApi.delete(id);
    setRegulations(prev => prev.filter(r => r.id !== id));
  }, []);

  // ── Audit Logs ────────────────────────────────────────────────────────────────

  const addAuditRecord = useCallback((record: Omit<AuditRecord, "id" | "timestamp">): AuditRecord => {
    const newRecord: AuditRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [newRecord, ...prev]);
    return newRecord;
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────────

  const updateLandlordProfile = useCallback(async (updates: Partial<LandlordProfile>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await settingsApi.update(updates as any) as any;
    const { profile } = mapSettings(raw);
    setLandlordProfile(profile);
  }, []);

  const updateLandlordPaymentSettings = useCallback(async (updates: Partial<LandlordPaymentSettings>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await settingsApi.update(updates as any) as any;
    const { paymentSettings } = mapSettings(raw);
    setLandlordPaymentSettings(paymentSettings);
  }, []);

  const updateLandlordNotificationPrefs = useCallback(async (updates: Partial<LandlordNotificationPreferences>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await settingsApi.update(updates as any) as any;
    const { notifPrefs } = mapSettings(raw);
    setLandlordNotificationPrefs(notifPrefs);
  }, []);

  // ── Derived helpers ───────────────────────────────────────────────────────────

  const getTenantCharges = useCallback((tenantId: string) =>
    charges.filter(c => c.tenantId === tenantId), [charges]);

  const getTenantPayments = useCallback((tenantId: string) =>
    payments.filter(p => p.tenantId === tenantId &&
      (p.status === "successful" || p.status === "pending" || p.status === "processing" || p.status === "reversed")),
    [payments]);

  const getTenantOutstandingBalance = useCallback((tenantId: string) =>
    charges.filter(c => c.tenantId === tenantId && c.status !== "paid")
      .reduce((sum, c) => sum + c.remainingBalance, 0), [charges]);

  const getTenantTotalPaid = useCallback((tenantId: string) =>
    payments.filter(p => p.tenantId === tenantId && p.status === "successful")
      .reduce((sum, p) => sum + p.amount, 0), [payments]);

  return (
    <AppDataContext.Provider value={{
      loading,
      rooms, nextRoomSequence, addRoom, updateRoom, archiveRoom,
      tenants, addTenant, updateTenant, endTenancy, removeTenant,
      categories, addCategory, updateCategory, archiveCategory,
      charges, issueCharge, recalculateChargeStatus, recordCorrection,
      payments, recordCashPayment, initiateMoneyPayment, updatePaymentStatus, reversePayment,
      getTenantCharges, getTenantPayments, getTenantOutstandingBalance, getTenantTotalPaid,
      regulations, addRegulation, deleteRegulation,
      auditLogs, addAuditRecord,
      landlordProfile, updateLandlordProfile,
      landlordPaymentSettings, updateLandlordPaymentSettings,
      landlordNotificationPrefs, updateLandlordNotificationPrefs,
      refresh,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
};