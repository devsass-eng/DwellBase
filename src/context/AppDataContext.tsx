import { createContext, useContext, useState, useCallback } from 'react';
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

  // Billing Categories
  categories: BillingCategory[];
  addCategory: (cat: Omit<BillingCategory, 'id' | 'createdAt' | 'isDefault'>) => void;
  updateCategory: (id: string, updates: Partial<BillingCategory>) => void;
  archiveCategory: (id: string) => void;

  // Charges
  charges: Charge[];
  issueCharge: (charge: Omit<Charge, 'id' | 'amountPaid' | 'remainingBalance' | 'status' | 'createdAt'>) => Charge;
  recalculateChargeStatus: (chargeId: string) => void;

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

  // Derived helpers
  getTenantCharges: (tenantId: string) => Charge[];
  getTenantPayments: (tenantId: string) => PaymentRecord[];
  getTenantOutstandingBalance: (tenantId: string) => number;
  getTenantTotalPaid: (tenantId: string) => number;

  // Regulations
  regulations: Regulation[];
  addRegulation: (text: string) => Regulation;

  // Settings
  landlordProfile: LandlordProfile;
  updateLandlordProfile: (updates: Partial<LandlordProfile>) => void;
  landlordPaymentSettings: LandlordPaymentSettings;
  updateLandlordPaymentSettings: (updates: Partial<LandlordPaymentSettings>) => void;
  landlordNotificationPrefs: LandlordNotificationPreferences;
  updateLandlordNotificationPrefs: (updates: Partial<LandlordNotificationPreferences>) => void;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─── Default categories ───────────────────────────────────────────────────────

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [roomSequence, setRoomSequence] = useState(1);
  const [categories, setCategories] = useState<BillingCategory[]>(DEFAULT_CATEGORIES);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [nextReceiptSequence, setNextReceiptSequence] = useState(1);

  const [landlordProfile, setLandlordProfile] = useState<LandlordProfile>({
    fullName: 'Sarah Landlord',
    phone: '0500000000',
    email: 'sarah@dwellbase.demo',
    propertyName: 'DwellBase Properties',
    propertyAddress: '123 Main Street, Accra',
  });

  const [landlordPaymentSettings, setLandlordPaymentSettings] = useState<LandlordPaymentSettings>({
    momoNetwork: '',
    momoName: '',
    momoNumber: '',
    paymentInstructions: 'Please transfer using the provided Mobile Money details.',
  });

  const [landlordNotificationPrefs, setLandlordNotificationPrefs] = useState<LandlordNotificationPreferences>({
    newTenant: true,
    manualMomo: true,
    confirmedPayment: true,
    upcomingCharges: true,
    overdueCharges: true,
  });

  const generateReceiptNumber = useCallback(() => {
    setNextReceiptSequence(prev => prev + 1);
    return `DB-${new Date().getFullYear()}-${String(nextReceiptSequence).padStart(6, '0')}`;
  }, [nextReceiptSequence]);

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
  }, []);

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

    return newPayment;
  }, [charges]);

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
    
    let newReceiptNumber = payment.receiptNumber;
    if (status === 'successful' && !newReceiptNumber) {
        newReceiptNumber = `DB-${new Date().getFullYear()}-${String(nextReceiptSequence).padStart(6, '0')}`;
        setNextReceiptSequence(prev => prev + 1);
    }

    setPayments(prev => prev.map(p =>
      p.id === paymentId ? { ...p, status, receiptNumber: newReceiptNumber, ...(providerRef ? { providerRef } : {}) } : p
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
    }
  }, [payments]);

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
    payments.filter(p => p.tenantId === tenantId && (p.status === 'successful' || p.status === 'pending' || p.status === 'processing')), [payments]);

  const getTenantOutstandingBalance = useCallback((tenantId: string) =>
    charges.filter(c => c.tenantId === tenantId && c.status !== 'paid').reduce((sum, c) => sum + c.remainingBalance, 0), [charges]);

  const getTenantTotalPaid = useCallback((tenantId: string) =>
    payments.filter(p => p.tenantId === tenantId && p.status === 'successful').reduce((sum, p) => sum + p.amount, 0), [payments]);

  return (
    <AppDataContext.Provider value={{
      rooms, nextRoomSequence: roomSequence, addRoom, updateRoom, archiveRoom,
      tenants, addTenant, updateTenant, endTenancy,
      categories, addCategory, updateCategory, archiveCategory,
      charges, issueCharge, recalculateChargeStatus,
      payments, recordCashPayment, initiateMoneyPayment, updatePaymentStatus,
      getTenantCharges, getTenantPayments, getTenantOutstandingBalance, getTenantTotalPaid,
      regulations, addRegulation,
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
