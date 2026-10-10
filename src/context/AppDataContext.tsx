import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  sequenceNumber: number;
  roomNumber: string;
  roomCode: string;
  monthlyRent: number;
  status: 'Vacant' | 'Occupied' | 'Maintenance';
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
  tenancyStatus: 'Upcoming' | 'Active' | 'Expiring Soon' | 'Expired' | 'Ended';
  accountStatus: 'Not Set Up' | 'Invitation Pending' | 'Active' | 'Suspended';
  notificationPreferences?: {
    paymentConfirmations: boolean;
    manualMomo: boolean;
    upcomingBills: boolean;
    overdueCharges: boolean;
    newRegulations: boolean;
  };
}

export type BillingFrequency = 'monthly' | 'yearly' | 'custom';

export interface BillingCategory {
  id: string;
  name: string;
  description: string;
  billingFrequency: BillingFrequency;
  customIntervalMonths?: number;
  defaultAmount?: number;
  isDefault: boolean;
  status: 'active' | 'archived';
  gracePeriodDays: number;
  createdAt: string;
}

export type ChargeStatus = 'upcoming' | 'pending' | 'overdue' | 'paid' | 'partially_paid';

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
  billingPeriod: string; // e.g. "October 2026"
  status: ChargeStatus;
  issuedBy: string;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'momo';
export type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'reversed' | 'pending_sync';
export type MomoNetwork = 'mtn' | 'telecel' | 'at';

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
  recordedBy: string; // 'system' | admin name | 'tenant'
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
  entityType: 'payment' | 'charge' | 'tenant';
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
  momoNetwork: MomoNetwork | '';
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

// ─── Context Interface ────────────────────────────────────────────────────────

interface AppDataContextType {
  // Rooms
  rooms: Room[];
  nextRoomSequence: number;
  addRoom: (monthlyRent: number) => Room;
  updateRoom: (roomId: string, updates: Partial<Pick<Room, 'monthlyRent' | 'status' | 'archived'>>) => void;
  archiveRoom: (roomId: string) => boolean;

  // Tenants
  tenants: Tenant[];
  addTenant: (tenant: Omit<Tenant, 'id'>) => void;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  endTenancy: (tenantId: string) => void;
  removeTenant: (tenantId: string, reason: string) => { success: boolean; debtWarning?: string };

  // Billing Categories
  categories: BillingCategory[];
  addCategory: (cat: Omit<BillingCategory, 'id' | 'createdAt' | 'isDefault'>) => void;
  updateCategory: (id: string, updates: Partial<BillingCategory>) => void;
  archiveCategory: (id: string) => void;

  // Charges
  charges: Charge[];
  issueCharge: (charge: Omit<Charge, 'id' | 'amountPaid' | 'remainingBalance' | 'status' | 'createdAt'>) => Charge;
  recalculateChargeStatus: (chargeId: string) => void;
  recordCorrection: (chargeId: string, newAmount: number, reason: string, actor: string) => void;

  // Payments
  payments: PaymentRecord[];
  recordCashPayment: (payment: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; paymentDate: string; notes?: string; receiptRef?: string;
    recordedBy: string;
  }) => PaymentRecord | { error: string };
  initiateMoneyPayment: (payment: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; momoNetwork: MomoNetwork;
  }) => PaymentRecord;
  updatePaymentStatus: (paymentId: string, status: PaymentStatus, providerRef?: string) => void;
  reversePayment: (paymentId: string, reason: string, actor: string) => void;

  // Derived helpers
  getTenantCharges: (tenantId: string) => Charge[];
  getTenantPayments: (tenantId: string) => PaymentRecord[];
  getTenantOutstandingBalance: (tenantId: string) => number;
  getTenantTotalPaid: (tenantId: string) => number;

  // Regulations
  regulations: Regulation[];
  addRegulation: (text: string) => Regulation;

  // Audit Logs
  auditLogs: AuditRecord[];
  addAuditRecord: (record: Omit<AuditRecord, 'id' | 'timestamp'>) => AuditRecord;

  // Settings
  landlordProfile: LandlordProfile;
  updateLandlordProfile: (updates: Partial<LandlordProfile>) => void;
  landlordPaymentSettings: LandlordPaymentSettings;
  updateLandlordPaymentSettings: (updates: Partial<LandlordPaymentSettings>) => void;
  landlordNotificationPrefs: LandlordNotificationPreferences;
  updateLandlordNotificationPrefs: (updates: Partial<LandlordNotificationPreferences>) => void;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─── Default Categories ───────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: BillingCategory[] = [
  {
    id: 'cat-rent',
    name: 'Rent',
    description: 'Monthly/Yearly room rent',
    billingFrequency: 'yearly',
    isDefault: true,
    status: 'active',
    gracePeriodDays: 7,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-light',
    name: 'Light Bill',
    description: 'Electricity charges',
    billingFrequency: 'monthly',
    isDefault: true,
    status: 'active',
    gracePeriodDays: 7,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-water',
    name: 'Water Bill',
    description: 'Water supply charges',
    billingFrequency: 'monthly',
    isDefault: true,
    status: 'active',
    gracePeriodDays: 7,
    createdAt: new Date().toISOString(),
  },
];

// ─── Seed Data (Real persistent baseline for property management) ────────────

const SEED_ROOMS: Room[] = [
  {
    id: 'room-1',
    sequenceNumber: 1,
    roomNumber: 'ROOM 1 (R1)',
    roomCode: 'R1',
    monthlyRent: 800,
    status: 'Occupied',
    archived: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'room-2',
    sequenceNumber: 2,
    roomNumber: 'ROOM 2 (R2)',
    roomCode: 'R2',
    monthlyRent: 1200,
    status: 'Occupied',
    archived: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'room-3',
    sequenceNumber: 3,
    roomNumber: 'ROOM 3 (R3)',
    roomCode: 'R3',
    monthlyRent: 950,
    status: 'Vacant',
    archived: false,
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

const SEED_TENANTS: Tenant[] = [
  {
    id: 'tenant-1',
    tenantId: 'TENT-01',
    fullName: 'Kwesi Mensah',
    phone: '0241234567',
    email: 'tenant@dwellbase.com',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    roomCode: 'R1',
    monthlyRent: 800,
    startDate: '2026-01-01',
    durationMonths: 12,
    endDate: '2026-12-31',
    totalContractualRent: 9600,
    amountPaid: 950,
    outstandingBalance: 60,
    tenancyStatus: 'Active',
    accountStatus: 'Active',
  },
  {
    id: 'tenant-2',
    tenantId: 'TENT-02',
    fullName: 'Ama Osei',
    phone: '0544004400',
    email: 'ama.osei@dwellbase.demo',
    roomId: 'room-2',
    roomNumber: 'ROOM 2 (R2)',
    roomCode: 'R2',
    monthlyRent: 1200,
    startDate: '2026-03-01',
    durationMonths: 12,
    endDate: '2027-02-28',
    totalContractualRent: 14400,
    amountPaid: 0,
    outstandingBalance: 1320,
    tenancyStatus: 'Active',
    accountStatus: 'Invitation Pending',
  },
  {
    id: 'tenant-former-1',
    tenantId: 'TENT-00',
    fullName: 'Kofi Boateng',
    phone: '0209876543',
    email: 'kofi.boateng@dwellbase.demo',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    roomCode: 'R1',
    monthlyRent: 750,
    startDate: '2025-01-01',
    durationMonths: 12,
    endDate: '2025-12-31',
    totalContractualRent: 9000,
    amountPaid: 8700,
    outstandingBalance: 300,
    tenancyStatus: 'Ended',
    accountStatus: 'Suspended',
  },
];

const SEED_CHARGES: Charge[] = [
  {
    id: 'charge-1',
    categoryId: 'cat-rent',
    categoryName: 'Rent',
    tenantId: 'tenant-1',
    tenantName: 'Kwesi Mensah',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    amount: 800,
    amountPaid: 800,
    remainingBalance: 0,
    issueDate: '2026-10-01',
    dueDate: '2026-10-07',
    billingPeriod: 'October 2026',
    status: 'paid',
    issuedBy: 'Sarah Landlord',
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'charge-2',
    categoryId: 'cat-light',
    categoryName: 'Light Bill',
    tenantId: 'tenant-1',
    tenantName: 'Kwesi Mensah',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    amount: 150,
    amountPaid: 150,
    remainingBalance: 0,
    issueDate: '2026-10-01',
    dueDate: '2026-10-15',
    billingPeriod: 'October 2026',
    status: 'paid',
    issuedBy: 'Sarah Landlord',
    createdAt: '2026-10-01T08:30:00Z',
  },
  {
    id: 'charge-3',
    categoryId: 'cat-water',
    categoryName: 'Water Bill',
    tenantId: 'tenant-1',
    tenantName: 'Kwesi Mensah',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    amount: 60,
    amountPaid: 0,
    remainingBalance: 60,
    issueDate: '2026-10-01',
    dueDate: '2026-10-18',
    billingPeriod: 'October 2026',
    status: 'pending',
    issuedBy: 'Sarah Landlord',
    createdAt: '2026-10-01T09:00:00Z',
  },
  {
    id: 'charge-4',
    categoryId: 'cat-rent',
    categoryName: 'Rent',
    tenantId: 'tenant-2',
    tenantName: 'Ama Osei',
    roomId: 'room-2',
    roomNumber: 'ROOM 2 (R2)',
    amount: 1200,
    amountPaid: 0,
    remainingBalance: 1200,
    issueDate: '2026-10-01',
    dueDate: '2026-10-10',
    billingPeriod: 'October 2026',
    status: 'pending',
    issuedBy: 'Sarah Landlord',
    createdAt: '2026-10-01T09:15:00Z',
  },
  {
    id: 'charge-5',
    categoryId: 'cat-light',
    categoryName: 'Light Bill',
    tenantId: 'tenant-2',
    tenantName: 'Ama Osei',
    roomId: 'room-2',
    roomNumber: 'ROOM 2 (R2)',
    amount: 120,
    amountPaid: 0,
    remainingBalance: 120,
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    billingPeriod: 'September 2026',
    status: 'overdue',
    issuedBy: 'Sarah Landlord',
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    id: 'charge-former-1',
    categoryId: 'cat-water',
    categoryName: 'Water Bill',
    tenantId: 'tenant-former-1',
    tenantName: 'Kofi Boateng',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    amount: 300,
    amountPaid: 0,
    remainingBalance: 300,
    issueDate: '2025-12-01',
    dueDate: '2025-12-15',
    billingPeriod: 'December 2025',
    status: 'overdue',
    issuedBy: 'Sarah Landlord',
    createdAt: '2025-12-01T10:00:00Z',
  },
];

const SEED_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-1',
    referenceNumber: 'CASH-OCT-2026-01',
    receiptNumber: 'DB-2026-000001',
    tenantId: 'tenant-1',
    tenantName: 'Kwesi Mensah',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    chargeId: 'charge-1',
    categoryId: 'cat-rent',
    categoryName: 'Rent',
    billingPeriod: 'October 2026',
    amount: 800,
    paymentMethod: 'cash',
    status: 'successful',
    recordedBy: 'Sarah Landlord',
    paymentDate: '2026-10-02',
    notes: 'Direct cash payment for October 2026 rent',
    createdAt: '2026-10-02T14:30:00Z',
  },
  {
    id: 'pay-2',
    referenceNumber: 'MOMO-OCT-2026-02',
    receiptNumber: 'DB-2026-000002',
    tenantId: 'tenant-1',
    tenantName: 'Kwesi Mensah',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    chargeId: 'charge-2',
    categoryId: 'cat-light',
    categoryName: 'Light Bill',
    billingPeriod: 'October 2026',
    amount: 150,
    paymentMethod: 'momo',
    momoNetwork: 'mtn',
    providerRef: 'HUB-MOMO-98231',
    status: 'successful',
    recordedBy: 'tenant',
    paymentDate: '2026-10-05',
    notes: 'Mobile Money automated transfer verified via provider',
    createdAt: '2026-10-05T09:12:00Z',
  },
  {
    id: 'pay-3',
    referenceNumber: 'MOMO-OCT-2026-03',
    tenantId: 'tenant-2',
    tenantName: 'Ama Osei',
    roomId: 'room-2',
    roomNumber: 'ROOM 2 (R2)',
    chargeId: 'charge-4',
    categoryId: 'cat-rent',
    categoryName: 'Rent',
    billingPeriod: 'October 2026',
    amount: 1200,
    paymentMethod: 'momo',
    momoNetwork: 'mtn',
    providerRef: 'TX-MTN-55441',
    status: 'pending', // Awaiting landlord verification
    recordedBy: 'tenant',
    paymentDate: '2026-10-08',
    notes: 'Transferred via MTN to 05440044. Awaiting confirmation.',
    createdAt: '2026-10-08T16:45:00Z',
  },
  {
    id: 'pay-former-1',
    referenceNumber: 'CASH-HIST-2025-45',
    receiptNumber: 'DB-2025-000045',
    tenantId: 'tenant-former-1',
    tenantName: 'Kofi Boateng',
    roomId: 'room-1',
    roomNumber: 'ROOM 1 (R1)',
    chargeId: 'charge-former-1',
    categoryId: 'cat-rent',
    categoryName: 'Rent',
    billingPeriod: 'November 2025',
    amount: 750,
    paymentMethod: 'cash',
    status: 'successful',
    recordedBy: 'Sarah Landlord',
    paymentDate: '2025-11-01',
    createdAt: '2025-11-01T10:00:00Z',
  },
];

const SEED_AUDIT_LOGS: AuditRecord[] = [
  {
    id: 'aud-001',
    entityType: 'charge',
    entityId: 'charge-2',
    field: 'amount',
    originalValue: 'GH₵180.00',
    correctedValue: 'GH₵150.00',
    actor: 'Sarah Landlord',
    timestamp: '2026-10-04T11:20:00Z',
    reason: 'Verified with ECG meter reading submeter bill deduction',
  },
  {
    id: 'aud-002',
    entityType: 'tenant',
    entityId: 'tenant-former-1',
    field: 'tenancyStatus',
    originalValue: 'Active',
    correctedValue: 'Ended',
    actor: 'Sarah Landlord',
    timestamp: '2025-12-31T17:00:00Z',
    reason: 'End of 1-year tenancy agreement. Tenant moved out, debt preserved.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateRef = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

const computeChargeStatus = (charge: Pick<Charge, 'dueDate' | 'amountPaid' | 'amount' | 'remainingBalance'>): ChargeStatus => {
  if (charge.remainingBalance <= 0) return 'paid';
  const now = new Date();
  const due = new Date(charge.dueDate);
  const sevenDaysBefore = new Date(due);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  const gracePeriodEnd = new Date(due);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

  if (now < sevenDaysBefore) return charge.amountPaid > 0 ? 'partially_paid' : 'upcoming';
  if (now <= gracePeriodEnd) return charge.amountPaid > 0 ? 'partially_paid' : 'pending';
  return 'overdue';
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem('db_rooms');
    return saved ? JSON.parse(saved) : SEED_ROOMS;
  });

  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem('db_tenants');
    return saved ? JSON.parse(saved) : SEED_TENANTS;
  });

  const [roomSequence, setRoomSequence] = useState<number>(() => {
    const saved = localStorage.getItem('db_roomSeq');
    return saved ? JSON.parse(saved) : 4;
  });

  const [categories, setCategories] = useState<BillingCategory[]>(() => {
    const saved = localStorage.getItem('db_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [charges, setCharges] = useState<Charge[]>(() => {
    const saved = localStorage.getItem('db_charges');
    return saved ? JSON.parse(saved) : SEED_CHARGES;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const saved = localStorage.getItem('db_payments');
    return saved ? JSON.parse(saved) : SEED_PAYMENTS;
  });

  const [regulations, setRegulations] = useState<Regulation[]>(() => {
    const saved = localStorage.getItem('db_regulations');
    return saved ? JSON.parse(saved) : [
      { id: 'reg-1', text: 'Quiet hours must be observed between 10:00 PM and 6:00 AM daily.', createdAt: '2026-09-01T00:00:00Z' },
      { id: 'reg-2', text: 'Waste disposal bins in the courtyard must be tightly closed after use.', createdAt: '2026-09-05T00:00:00Z' },
    ];
  });

  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>(() => {
    const saved = localStorage.getItem('db_auditLogs');
    return saved ? JSON.parse(saved) : SEED_AUDIT_LOGS;
  });

  const [nextReceiptSequence, setNextReceiptSequence] = useState<number>(() => {
    const saved = localStorage.getItem('db_receiptSeq');
    return saved ? JSON.parse(saved) : 3;
  });

  const [landlordProfile, setLandlordProfile] = useState<LandlordProfile>(() => {
    const saved = localStorage.getItem('db_landlordProfile');
    return saved ? JSON.parse(saved) : {
      fullName: 'Sarah Landlord',
      phone: '0500000000',
      email: 'sarah@dwellbase.demo',
      propertyName: 'DwellBase Properties',
      propertyAddress: '123 Main Street, Accra',
    };
  });

  const [landlordPaymentSettings, setLandlordPaymentSettings] = useState<LandlordPaymentSettings>(() => {
    const saved = localStorage.getItem('db_landlordPayment');
    return saved ? JSON.parse(saved) : {
      momoNetwork: 'mtn',
      momoName: 'Sarah Landlord',
      momoNumber: '05440044',
      paymentInstructions: 'Please transfer using the provided Mobile Money details.',
    };
  });

  const [landlordNotificationPrefs, setLandlordNotificationPrefs] = useState<LandlordNotificationPreferences>(() => {
    const saved = localStorage.getItem('db_landlordNotifs');
    return saved ? JSON.parse(saved) : {
      newTenant: true,
      manualMomo: true,
      confirmedPayment: true,
      upcomingCharges: true,
      overdueCharges: true,
    };
  });

  // Sync to localStorage
  useEffect(() => { localStorage.setItem('db_rooms', JSON.stringify(rooms)); }, [rooms]);
  useEffect(() => { localStorage.setItem('db_tenants', JSON.stringify(tenants)); }, [tenants]);
  useEffect(() => { localStorage.setItem('db_roomSeq', JSON.stringify(roomSequence)); }, [roomSequence]);
  useEffect(() => { localStorage.setItem('db_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('db_charges', JSON.stringify(charges)); }, [charges]);
  useEffect(() => { localStorage.setItem('db_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('db_regulations', JSON.stringify(regulations)); }, [regulations]);
  useEffect(() => { localStorage.setItem('db_auditLogs', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('db_receiptSeq', JSON.stringify(nextReceiptSequence)); }, [nextReceiptSequence]);
  useEffect(() => { localStorage.setItem('db_landlordProfile', JSON.stringify(landlordProfile)); }, [landlordProfile]);
  useEffect(() => { localStorage.setItem('db_landlordPayment', JSON.stringify(landlordPaymentSettings)); }, [landlordPaymentSettings]);
  useEffect(() => { localStorage.setItem('db_landlordNotifs', JSON.stringify(landlordNotificationPrefs)); }, [landlordNotificationPrefs]);

  const generateReceiptNumber = useCallback(() => {
    const num = `DB-${new Date().getFullYear()}-${String(nextReceiptSequence).padStart(6, '0')}`;
    setNextReceiptSequence(prev => prev + 1);
    return num;
  }, [nextReceiptSequence]);

  // ── Audit Logs ───────────────────────────────────────────────────────────────

  const addAuditRecord = useCallback((record: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord => {
    const newRecord: AuditRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [newRecord, ...prev]);
    return newRecord;
  }, []);

  // ── Rooms ────────────────────────────────────────────────────────────────────

  const addRoom = useCallback((monthlyRent: number): Room => {
    const seq = roomSequence;
    const newRoom: Room = {
      id: crypto.randomUUID(),
      sequenceNumber: seq,
      roomNumber: `ROOM ${seq} (R${seq})`,
      roomCode: `R${seq}`,
      monthlyRent,
      status: 'Vacant',
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRooms(prev => [...prev, newRoom]);
    setRoomSequence(prev => prev + 1);
    return newRoom;
  }, [roomSequence]);

  const updateRoom = useCallback((roomId: string, updates: Partial<Pick<Room, 'monthlyRent' | 'status' | 'archived'>>) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
  }, []);

  const archiveRoom = useCallback((roomId: string): boolean => {
    const hasActive = tenants.some(t => t.roomId === roomId && (t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming'));
    if (hasActive) return false;
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, archived: true, updatedAt: new Date().toISOString() } : r));
    return true;
  }, [tenants]);

  // ── Tenants ──────────────────────────────────────────────────────────────────

  const addTenant = useCallback((tenantData: Omit<Tenant, 'id'>) => {
    const newTenant: Tenant = { id: crypto.randomUUID(), ...tenantData };
    setTenants(prev => [...prev, newTenant]);
    setRooms(prev => prev.map(r => r.id === tenantData.roomId ? { ...r, status: 'Occupied', updatedAt: new Date().toISOString() } : r));
    addAuditRecord({
      entityType: 'tenant',
      entityId: newTenant.id,
      field: 'registration',
      originalValue: 'None',
      correctedValue: `Registered ${newTenant.fullName} to Room ${newTenant.roomNumber}`,
      actor: 'Sarah Landlord',
      reason: 'New tenancy contract created',
    });
  }, [addAuditRecord]);

  const updateTenant = useCallback((id: string, updates: Partial<Tenant>) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const endTenancy = useCallback((tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, tenancyStatus: 'Ended' } : t));
    const otherActive = tenants.some(t =>
      t.id !== tenantId && t.roomId === tenant.roomId &&
      (t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming')
    );
    if (!otherActive) {
      setRooms(prev => prev.map(r =>
        r.id === tenant.roomId && r.status === 'Occupied'
          ? { ...r, status: 'Vacant', updatedAt: new Date().toISOString() }
          : r
      ));
    }
  }, [tenants]);

  const removeTenant = useCallback((tenantId: string, reason: string): { success: boolean; debtWarning?: string } => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return { success: false };

    const unpaidBalance = charges
      .filter(c => c.tenantId === tenantId && c.status !== 'paid')
      .reduce((sum, c) => sum + c.remainingBalance, 0);

    // End tenancy and revoke account, but preserve all charges, payments, and historical data!
    setTenants(prev => prev.map(t =>
      t.id === tenantId
        ? { ...t, tenancyStatus: 'Ended', accountStatus: 'Suspended' }
        : t
    ));

    // Release room if no other active tenancy remains
    const otherActive = tenants.some(t =>
      t.id !== tenantId && t.roomId === tenant.roomId &&
      (t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming')
    );
    if (!otherActive) {
      setRooms(prev => prev.map(r =>
        r.id === tenant.roomId && r.status === 'Occupied'
          ? { ...r, status: 'Vacant', updatedAt: new Date().toISOString() }
          : r
      ));
    }

    addAuditRecord({
      entityType: 'tenant',
      entityId: tenantId,
      field: 'status',
      originalValue: tenant.tenancyStatus,
      correctedValue: 'Ended (Login Access Revoked)',
      actor: 'Sarah Landlord',
      reason: reason || 'Tenant removed from active roster; all historical records and debt retained.',
    });

    return {
      success: true,
      debtWarning: unpaidBalance > 0
        ? `Tenant has an outstanding balance of GH₵${unpaidBalance.toFixed(2)}. Debt remains attached to their historical record.`
        : undefined,
    };
  }, [tenants, charges, addAuditRecord]);

  // ── Categories ───────────────────────────────────────────────────────────────

  const addCategory = useCallback((cat: Omit<BillingCategory, 'id' | 'createdAt' | 'isDefault'>) => {
    const newCat: BillingCategory = {
      ...cat,
      id: crypto.randomUUID(),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    setCategories(prev => [...prev, newCat]);
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<BillingCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const archiveCategory = useCallback((id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, status: 'archived' } : c));
  }, []);

  // ── Charges ──────────────────────────────────────────────────────────────────

  const issueCharge = useCallback((chargeData: Omit<Charge, 'id' | 'amountPaid' | 'remainingBalance' | 'status' | 'createdAt'>): Charge => {
    const status = computeChargeStatus({ ...chargeData, amountPaid: 0, remainingBalance: chargeData.amount });
    const newCharge: Charge = {
      ...chargeData,
      id: crypto.randomUUID(),
      amountPaid: 0,
      remainingBalance: chargeData.amount,
      status,
      createdAt: new Date().toISOString(),
    };
    setCharges(prev => [...prev, newCharge]);
    return newCharge;
  }, []);

  const recalculateChargeStatus = useCallback((chargeId: string) => {
    setCharges(prev => prev.map(c => {
      if (c.id !== chargeId) return c;
      const status = computeChargeStatus(c);
      return { ...c, status };
    }));
  }, []);

  const recordCorrection = useCallback((chargeId: string, newAmount: number, reason: string, actor: string) => {
    const charge = charges.find(c => c.id === chargeId);
    if (!charge) return;

    const oldAmount = charge.amount;
    const diff = newAmount - oldAmount;
    const newRemaining = Math.max(0, charge.remainingBalance + diff);
    const newStatus = computeChargeStatus({ ...charge, amount: newAmount, remainingBalance: newRemaining });

    setCharges(prev => prev.map(c =>
      c.id === chargeId ? { ...c, amount: newAmount, remainingBalance: newRemaining, status: newStatus } : c
    ));

    // Update tenant balance accordingly
    setTenants(prev => prev.map(t =>
      t.id === charge.tenantId
        ? { ...t, outstandingBalance: Math.max(0, t.outstandingBalance + diff) }
        : t
    ));

    addAuditRecord({
      entityType: 'charge',
      entityId: chargeId,
      field: 'amount',
      originalValue: `GH₵${oldAmount.toFixed(2)}`,
      correctedValue: `GH₵${newAmount.toFixed(2)}`,
      actor: actor || 'Sarah Landlord',
      reason,
    });
  }, [charges, addAuditRecord]);

  // ── Payments ─────────────────────────────────────────────────────────────────

  const recordCashPayment = useCallback((paymentData: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; paymentDate: string; notes?: string; receiptRef?: string;
    recordedBy: string;
  }): PaymentRecord | { error: string } => {
    const charge = charges.find(c => c.id === paymentData.chargeId);
    if (!charge) return { error: 'Charge not found.' };
    if (paymentData.amount <= 0) return { error: 'Amount must be greater than zero.' };
    if (paymentData.amount > charge.remainingBalance + 0.001) {
      return { error: `Amount exceeds remaining balance of GH₵${charge.remainingBalance.toFixed(2)}.` };
    }

    const newPayment: PaymentRecord = {
      id: crypto.randomUUID(),
      referenceNumber: generateRef('CASH'),
      receiptNumber: generateReceiptNumber(),
      ...paymentData,
      paymentMethod: 'cash',
      status: 'successful',
      createdAt: new Date().toISOString(),
    };

    setPayments(prev => [...prev, newPayment]);

    // Update the charge
    setCharges(prev => prev.map(c => {
      if (c.id !== paymentData.chargeId) return c;
      const newAmountPaid = c.amountPaid + paymentData.amount;
      const newRemaining = Math.max(0, c.remainingBalance - paymentData.amount);
      const status = computeChargeStatus({ ...c, amountPaid: newAmountPaid, remainingBalance: newRemaining });
      return { ...c, amountPaid: newAmountPaid, remainingBalance: newRemaining, status };
    }));

    // Update tenant outstanding balance
    setTenants(prev => prev.map(t => {
      if (t.id !== paymentData.tenantId) return t;
      return { ...t, amountPaid: t.amountPaid + paymentData.amount, outstandingBalance: Math.max(0, t.outstandingBalance - paymentData.amount) };
    }));

    addAuditRecord({
      entityType: 'payment',
      entityId: newPayment.id,
      field: 'payment',
      originalValue: 'None',
      correctedValue: `GH₵${paymentData.amount.toFixed(2)} recorded (${newPayment.referenceNumber})`,
      actor: paymentData.recordedBy || 'Sarah Landlord',
      reason: 'Cash payment confirmed and recorded',
    });

    return newPayment;
  }, [charges, generateReceiptNumber, addAuditRecord]);

  const initiateMoneyPayment = useCallback((paymentData: {
    tenantId: string; tenantName: string; roomId: string; roomNumber: string;
    chargeId: string; categoryId: string; categoryName: string; billingPeriod: string;
    amount: number; momoNetwork: MomoNetwork;
  }): PaymentRecord => {
    const pending: PaymentRecord = {
      id: crypto.randomUUID(),
      referenceNumber: generateRef('MOMO'),
      ...paymentData,
      paymentMethod: 'momo',
      status: 'pending',
      recordedBy: 'tenant',
      paymentDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    setPayments(prev => [...prev, pending]);
    return pending;
  }, []);

  const updatePaymentStatus = useCallback((paymentId: string, status: PaymentStatus, providerRef?: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    let receiptNum = payment.receiptNumber;
    if (status === 'successful' && !receiptNum) {
      receiptNum = generateReceiptNumber();
    }

    setPayments(prev => prev.map(p =>
      p.id === paymentId ? { ...p, status, receiptNumber: receiptNum, ...(providerRef ? { providerRef } : {}) } : p
    ));

    // Only apply to charge/tenant if confirmed successful
    if (status === 'successful') {
      setCharges(prev => prev.map(c => {
        if (c.id !== payment.chargeId) return c;
        const newAmountPaid = c.amountPaid + payment.amount;
        const newRemaining = Math.max(0, c.remainingBalance - payment.amount);
        const newStatus = computeChargeStatus({ ...c, amountPaid: newAmountPaid, remainingBalance: newRemaining });
        return { ...c, amountPaid: newAmountPaid, remainingBalance: newRemaining, status: newStatus };
      }));
      setTenants(prev => prev.map(t => {
        if (t.id !== payment.tenantId) return t;
        return { ...t, amountPaid: t.amountPaid + payment.amount, outstandingBalance: Math.max(0, t.outstandingBalance - payment.amount) };
      }));

      addAuditRecord({
        entityType: 'payment',
        entityId: paymentId,
        field: 'status',
        originalValue: payment.status,
        correctedValue: 'successful',
        actor: 'Sarah Landlord',
        reason: 'Payment verified and confirmed receipt generated',
      });
    }
  }, [payments, generateReceiptNumber, addAuditRecord]);

  const reversePayment = useCallback((paymentId: string, reason: string, actor: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment || payment.status === 'reversed') return;

    const oldStatus = payment.status;
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'reversed' } : p));

    // If it was successful, reverse the effect on charge and tenant balances!
    if (oldStatus === 'successful') {
      setCharges(prev => prev.map(c => {
        if (c.id !== payment.chargeId) return c;
        const newAmountPaid = Math.max(0, c.amountPaid - payment.amount);
        const newRemaining = c.remainingBalance + payment.amount;
        const newStatus = computeChargeStatus({ ...c, amountPaid: newAmountPaid, remainingBalance: newRemaining });
        return { ...c, amountPaid: newAmountPaid, remainingBalance: newRemaining, status: newStatus };
      }));
      setTenants(prev => prev.map(t => {
        if (t.id !== payment.tenantId) return t;
        return { ...t, amountPaid: Math.max(0, t.amountPaid - payment.amount), outstandingBalance: t.outstandingBalance + payment.amount };
      }));
    }

    addAuditRecord({
      entityType: 'payment',
      entityId: paymentId,
      field: 'status',
      originalValue: oldStatus,
      correctedValue: 'reversed',
      actor: actor || 'Sarah Landlord',
      reason,
    });
  }, [payments, addAuditRecord]);

  // ── Regulations ───────────────────────────────────────────────────────────────

  const addRegulation = useCallback((text: string): Regulation => {
    const newRegulation: Regulation = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    setRegulations(prev => [newRegulation, ...prev]);
    return newRegulation;
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────────

  const updateLandlordProfile = useCallback((updates: Partial<LandlordProfile>) => {
    setLandlordProfile(prev => ({ ...prev, ...updates }));
  }, []);

  const updateLandlordPaymentSettings = useCallback((updates: Partial<LandlordPaymentSettings>) => {
    setLandlordPaymentSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateLandlordNotificationPrefs = useCallback((updates: Partial<LandlordNotificationPreferences>) => {
    setLandlordNotificationPrefs(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Derived helpers ───────────────────────────────────────────────────────────

  const getTenantCharges = useCallback((tenantId: string) =>
    charges.filter(c => c.tenantId === tenantId), [charges]);

  const getTenantPayments = useCallback((tenantId: string) =>
    payments.filter(p => p.tenantId === tenantId && (p.status === 'successful' || p.status === 'pending' || p.status === 'processing' || p.status === 'reversed')), [payments]);

  const getTenantOutstandingBalance = useCallback((tenantId: string) =>
    charges.filter(c => c.tenantId === tenantId && c.status !== 'paid').reduce((sum, c) => sum + c.remainingBalance, 0), [charges]);

  const getTenantTotalPaid = useCallback((tenantId: string) =>
    payments.filter(p => p.tenantId === tenantId && p.status === 'successful').reduce((sum, p) => sum + p.amount, 0), [payments]);

  return (
    <AppDataContext.Provider value={{
      rooms, nextRoomSequence: roomSequence, addRoom, updateRoom, archiveRoom,
      tenants, addTenant, updateTenant, endTenancy, removeTenant,
      categories, addCategory, updateCategory, archiveCategory,
      charges, issueCharge, recalculateChargeStatus, recordCorrection,
      payments, recordCashPayment, initiateMoneyPayment, updatePaymentStatus, reversePayment,
      getTenantCharges, getTenantPayments, getTenantOutstandingBalance, getTenantTotalPaid,
      regulations, addRegulation,
      auditLogs, addAuditRecord,
      landlordProfile, updateLandlordProfile,
      landlordPaymentSettings, updateLandlordPaymentSettings,
      landlordNotificationPrefs, updateLandlordNotificationPrefs,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
};
