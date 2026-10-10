import { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ReceiptModal from '../components/ReceiptModal';
import { useAppData } from '../context/AppDataContext';
import type { PaymentRecord, BillingFrequency } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import {
  CreditCard, Plus, Search, X, AlertCircle,
  CheckCircle2, AlertTriangle, DollarSign,
  Receipt, LayoutList,
  RotateCcw, Tag, Banknote, Phone
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatGHS = (n: number) => `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const statusStyles: Record<string, string> = {
  successful: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  processing: 'bg-blue-50 text-blue-700 border border-blue-100',
  failed: 'bg-red-50 text-red-700 border border-red-100',
  reversed: 'bg-gray-100 text-gray-600',
  pending_sync: 'bg-purple-50 text-purple-700 border border-purple-100',
};

const chargeStatusStyles: Record<string, string> = {
  upcoming: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  paid: 'bg-emerald-50 text-emerald-700',
  partially_paid: 'bg-orange-50 text-orange-700',
};

const StatCard = ({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string
}) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'cash' | 'momo' | 'charges' | 'categories';

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminPayments = () => {
  const {
    tenants, payments, charges, categories, landlordProfile,
    recordCashPayment, issueCharge, addCategory, archiveCategory,
    updatePaymentStatus
  } = useAppData();
  const { notify } = useNotifications();

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter] = useState('all');

  // ── Add Cash Payment modal ────────────────────────────────────────────────────
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashForm, setCashForm] = useState({
    tenantId: '', chargeId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0],
    receiptRef: '', notes: ''
  });
  const [cashFormError, setCashFormError] = useState('');
  const [isCashSubmitting, setIsCashSubmitting] = useState(false);
  const [cashConfirmStep, setCashConfirmStep] = useState(false);

  // ── Issue Charge modal ────────────────────────────────────────────────────────
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    tenantId: '', categoryId: '', amount: '', dueDate: '', billingPeriod: '',
  });
  const [chargeFormError, setChargeFormError] = useState('');
  const [isChargeSubmitting, setIsChargeSubmitting] = useState(false);

  // ── Add Category modal ────────────────────────────────────────────────────────
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({
    name: '', description: '', billingFrequency: 'monthly' as BillingFrequency,
    customIntervalMonths: '', gracePeriodDays: '7', defaultAmount: '',
  });
  const [catFormError, setCatFormError] = useState('');
  const [isCatSubmitting, setIsCatSubmitting] = useState(false);

  // ── Detail / Receipt modal ────────────────────────────────────────────────────
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const confirmed = payments.filter(p => p.status === 'successful');
    const totalCollected = confirmed.reduce((s, p) => s + p.amount, 0);
    const successCount = confirmed.length;
    const outstanding = charges.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remainingBalance, 0);
    const overdueCharges = charges.filter(c => c.status === 'overdue');
    const overdueTotal = overdueCharges.reduce((s, c) => s + c.remainingBalance, 0);
    return { totalCollected, successCount, outstanding, overdueCount: overdueCharges.length, overdueTotal };
  }, [payments, charges]);

  // ── Filtered payments ─────────────────────────────────────────────────────────

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.tenantName.toLowerCase().includes(q) ||
        p.tenantId.toLowerCase().includes(q) || p.referenceNumber.toLowerCase().includes(q) ||
        p.roomNumber.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchMethod = methodFilter === 'all' || p.paymentMethod === methodFilter;
      const matchTab = activeTab === 'all' || (activeTab === 'cash' && p.paymentMethod === 'cash') ||
        (activeTab === 'momo' && p.paymentMethod === 'momo');
      return matchSearch && matchStatus && matchMethod && matchTab;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments, searchQuery, statusFilter, methodFilter, activeTab]);

  // ── Derived helpers ───────────────────────────────────────────────────────────

  const selectedTenant = tenants.find(t => t.id === cashForm.tenantId);
  const tenantOpenCharges = charges.filter(c => c.tenantId === cashForm.tenantId && c.status !== 'paid' && c.remainingBalance > 0);
  const selectedCharge = charges.find(c => c.id === cashForm.chargeId);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCashSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setCashFormError('');
    if (!cashForm.tenantId) return setCashFormError('Please select a tenant.');
    if (!cashForm.chargeId) return setCashFormError('Please select a charge.');
    const amount = parseFloat(cashForm.amount);
    if (isNaN(amount) || amount <= 0) return setCashFormError('Enter a valid amount greater than GH₵0.');
    if (!cashForm.paymentDate) return setCashFormError('Payment date is required.');
    if (selectedCharge && amount > selectedCharge.remainingBalance + 0.001)
      return setCashFormError(`Amount exceeds remaining balance of ${formatGHS(selectedCharge.remainingBalance)}.`);
    setCashConfirmStep(true);
  }, [cashForm, selectedCharge]);

  const handleCashConfirm = useCallback(() => {
    if (!selectedTenant || !selectedCharge) return;
    setIsCashSubmitting(true);
    setTimeout(() => {
      const result = recordCashPayment({
        tenantId: selectedTenant.id,
        tenantName: selectedTenant.fullName,
        roomId: selectedTenant.roomId,
        roomNumber: selectedTenant.roomNumber,
        chargeId: selectedCharge.id,
        categoryId: selectedCharge.categoryId,
        categoryName: selectedCharge.categoryName,
        billingPeriod: selectedCharge.billingPeriod,
        amount: parseFloat(cashForm.amount),
        paymentDate: cashForm.paymentDate,
        receiptRef: cashForm.receiptRef || undefined,
        notes: cashForm.notes || undefined,
        recordedBy: 'Admin',
      });
      setIsCashSubmitting(false);
      if ('error' in result) {
        setCashFormError(result.error);
        setCashConfirmStep(false);
        return;
      }
      // Notify landlord + tenant
      notify({ recipientType: 'landlord', title: 'Cash Payment Recorded', message: `${formatGHS(parseFloat(cashForm.amount))} received from ${selectedTenant.fullName}.`, type: 'success' });
      notify({ recipientType: 'tenant', recipientId: selectedTenant.id, title: 'Cash Payment Recorded', message: `Your landlord recorded a cash payment of ${formatGHS(parseFloat(cashForm.amount))} for ${selectedCharge.categoryName}.`, type: 'info' });

      setCashForm({ tenantId: '', chargeId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], receiptRef: '', notes: '' });
      setCashConfirmStep(false);
      setIsCashModalOpen(false);
    }, 700);
  }, [cashForm, selectedTenant, selectedCharge, recordCashPayment, notify]);

  const handleIssueCharge = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setChargeFormError('');
    const tenant = tenants.find(t => t.id === chargeForm.tenantId);
    if (!tenant) return setChargeFormError('Please select a tenant.');
    if (!chargeForm.categoryId) return setChargeFormError('Please select a category.');
    const amount = parseFloat(chargeForm.amount);
    if (isNaN(amount) || amount <= 0) return setChargeFormError('Enter a valid amount.');
    if (!chargeForm.dueDate) return setChargeFormError('Due date is required.');
    if (!chargeForm.billingPeriod.trim()) return setChargeFormError('Billing period is required.');

    setIsChargeSubmitting(true);
    const cat = categories.find(c => c.id === chargeForm.categoryId);
    setTimeout(() => {
      issueCharge({
        categoryId: chargeForm.categoryId,
        categoryName: cat?.name || '',
        tenantId: tenant.id,
        tenantName: tenant.fullName,
        roomId: tenant.roomId,
        roomNumber: tenant.roomNumber,
        amount,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: chargeForm.dueDate,
        billingPeriod: chargeForm.billingPeriod,
        issuedBy: 'Admin',
      });
      notify({ recipientType: 'landlord', title: 'Charge Issued', message: `${cat?.name} bill of ${formatGHS(amount)} issued to ${tenant.fullName}.`, type: 'info' });
      notify({ recipientType: 'tenant', recipientId: tenant.id, title: 'New Bill Issued', message: `A new ${cat?.name} bill of ${formatGHS(amount)} has been issued. Due: ${new Date(chargeForm.dueDate).toLocaleDateString()}.`, type: 'warning' });
      setIsChargeSubmitting(false);
      setChargeForm({ tenantId: '', categoryId: '', amount: '', dueDate: '', billingPeriod: '' });
      setIsChargeModalOpen(false);
    }, 500);
  }, [chargeForm, tenants, categories, issueCharge, notify]);

  const handleAddCategory = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setCatFormError('');
    if (!catForm.name.trim()) return setCatFormError('Category name is required.');
    const dup = categories.find(c => c.name.toLowerCase() === catForm.name.toLowerCase() && c.status === 'active');
    if (dup) return setCatFormError('A category with that name already exists.');
    setIsCatSubmitting(true);
    setTimeout(() => {
      addCategory({
        name: catForm.name.trim(),
        description: catForm.description,
        billingFrequency: catForm.billingFrequency,
        customIntervalMonths: catForm.billingFrequency === 'custom' ? parseInt(catForm.customIntervalMonths) : undefined,
        gracePeriodDays: parseInt(catForm.gracePeriodDays) || 7,
        defaultAmount: catForm.defaultAmount ? parseFloat(catForm.defaultAmount) : undefined,
        status: 'active',
      });
      notify({ recipientType: 'landlord', title: 'Category Added', message: `"${catForm.name}" billing category created successfully.`, type: 'success' });
      setIsCatSubmitting(false);
      setCatForm({ name: '', description: '', billingFrequency: 'monthly', customIntervalMonths: '', gracePeriodDays: '7', defaultAmount: '' });
      setIsCategoryModalOpen(false);
    }, 400);
  }, [catForm, categories, addCategory, notify]);

  // ─────────────────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All Payments' },
    { id: 'cash', label: 'Cash' },
    { id: 'momo', label: 'Mobile Money' },
    { id: 'charges', label: 'Charges & Bills' },
    { id: 'categories', label: 'Categories' },
  ];

  return (
    <DashboardLayout userType="landlord" userName={landlordProfile.fullName}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Payments</h2>
            <p className="text-slate-500 mt-1">Track rent, bills, and payment records for all tenants.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setIsChargeModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-colors font-medium text-sm">
              <Plus className="w-4 h-4" /> Issue Charge
            </button>
            <button onClick={() => setIsCashModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium text-sm">
              <Banknote className="w-4 h-4" /> Record Cash
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Collected" value={formatGHS(stats.totalCollected)} sub="Confirmed payments only" icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
          <StatCard title="Outstanding Balance" value={formatGHS(stats.outstanding)} sub="All issued unpaid charges" icon={DollarSign} color="bg-blue-50 text-blue-600" />
          <StatCard title="Successful Payments" value={`${stats.successCount}`} icon={CreditCard} color="bg-teal-50 text-teal-600" />
          <StatCard title="Overdue Charges" value={`${stats.overdueCount}`} sub={stats.overdueTotal > 0 ? formatGHS(stats.overdueTotal) : undefined} icon={AlertTriangle} color="bg-red-50 text-red-600" />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id ? 'border-teal-500 text-teal-700 bg-teal-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Payments Tab Content */}
          {(activeTab === 'all' || activeTab === 'cash' || activeTab === 'momo') && (
            <div>
              {/* Filters */}
              <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search tenant, ID, reference, room…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none text-sm" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-50 border border-gray-200 text-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="all">All Statuses</option>
                  <option value="successful">Successful</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="reversed">Reversed</option>
                </select>
                {(searchQuery || statusFilter !== 'all') && (
                  <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
                )}
              </div>

              {filteredPayments.length === 0 ? (
                <div className="py-16 text-center">
                  <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No payment records yet.</p>
                  <p className="text-slate-400 text-sm mt-1">Record a cash payment or issue a charge to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-gray-50 text-xs text-slate-500 uppercase tracking-wide border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3">Reference</th>
                        <th className="px-5 py-3">Tenant</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">Method</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredPayments.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.referenceNumber}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{p.tenantName}</div>
                            <div className="text-xs text-slate-400">Room {p.roomNumber}</div>
                          </td>
                          <td className="px-5 py-3">
                            <div>{p.categoryName}</div>
                            <div className="text-xs text-slate-400">{p.billingPeriod}</div>
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800">{formatGHS(p.amount)}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.paymentMethod === 'cash' ? 'bg-navy-50 text-navy-700' : 'bg-yellow-50 text-yellow-700'}`}>
                              {p.paymentMethod === 'cash' ? <Banknote className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                              {p.paymentMethod === 'cash' ? 'Cash' : 'MoMo'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[p.status] || 'bg-gray-100 text-gray-600'}`}>
                              {p.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                            {(p.status === 'pending' || p.status === 'processing') && (
                              <>
                                <button 
                                  onClick={() => {
                                    updatePaymentStatus(p.id, 'successful');
                                    notify({
                                      recipientType: 'landlord',
                                      title: 'Payment Verified & Confirmed',
                                      message: `Payment of ${formatGHS(p.amount)} for ${p.tenantName} confirmed. Official receipt generated.`,
                                      type: 'success',
                                    });
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                >
                                  Verify & Approve
                                </button>
                                <button 
                                  onClick={() => {
                                    updatePaymentStatus(p.id, 'failed');
                                    notify({
                                      recipientType: 'landlord',
                                      title: 'Payment Rejected',
                                      message: `Payment submission of ${formatGHS(p.amount)} for ${p.tenantName} rejected.`,
                                      type: 'warning',
                                    });
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {p.status === 'successful' && (
                              <button onClick={() => setSelectedPayment(p)} className="p-1.5 px-2.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-semibold">
                                <Receipt className="w-4 h-4" /> Receipt
                              </button>
                            )}
                            {(p.status === 'failed' || p.status === 'reversed') && (
                              <span className="text-xs text-slate-400 italic">No receipt</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Charges Tab */}
          {activeTab === 'charges' && (
            <div>
              {charges.length === 0 ? (
                <div className="py-16 text-center">
                  <LayoutList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No charges issued yet.</p>
                  <button onClick={() => setIsChargeModalOpen(true)} className="mt-3 text-sm text-teal-600 hover:underline">Issue your first charge</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-gray-50 text-xs text-slate-500 uppercase tracking-wide border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3">Tenant / Room</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Period</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">Paid</th>
                        <th className="px-5 py-3">Balance</th>
                        <th className="px-5 py-3">Due Date</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...charges].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => (
                        <tr key={c.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{c.tenantName}</div>
                            <div className="text-xs text-slate-400">Room {c.roomNumber}</div>
                          </td>
                          <td className="px-5 py-3">{c.categoryName}</td>
                          <td className="px-5 py-3 text-slate-500">{c.billingPeriod}</td>
                          <td className="px-5 py-3 font-medium">{formatGHS(c.amount)}</td>
                          <td className="px-5 py-3 text-emerald-600 font-medium">{formatGHS(c.amountPaid)}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800">{formatGHS(c.remainingBalance)}</td>
                          <td className="px-5 py-3 text-slate-500">{new Date(c.dueDate).toLocaleDateString()}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${chargeStatusStyles[c.status] || 'bg-gray-100 text-gray-600'}`}>
                              {c.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div>
              <div className="p-4 border-b border-gray-50 flex justify-end">
                <button onClick={() => setIsCategoryModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {categories.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">No categories configured.</div>
                ) : (
                  categories.map(cat => {
                    const catCharges = charges.filter(c => c.categoryId === cat.id);
                    const catTotal = catCharges.reduce((s, c) => s + c.amount, 0);
                    const catPaid = catCharges.reduce((s, c) => s + c.amountPaid, 0);
                    const catBalance = catCharges.reduce((s, c) => s + c.remainingBalance, 0);
                    return (
                      <div key={cat.id} className="px-5 py-4 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-teal-50 text-teal-600 mt-0.5">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{cat.name}</span>
                              {cat.isDefault && <span className="text-xs bg-navy-50 text-navy-600 px-2 py-0.5 rounded-full">Default</span>}
                              {cat.status === 'archived' && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Archived</span>}
                            </div>
                            {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
                            <p className="text-xs text-slate-400 mt-1 capitalize">{cat.billingFrequency} · {cat.gracePeriodDays}-day grace period</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right text-sm shrink-0">
                          <div>
                            <p className="text-xs text-slate-400">Charged</p>
                            <p className="font-semibold text-slate-700">{formatGHS(catTotal)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Collected</p>
                            <p className="font-semibold text-emerald-600">{formatGHS(catPaid)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Balance</p>
                            <p className="font-semibold text-slate-800">{formatGHS(catBalance)}</p>
                          </div>
                          {!cat.isDefault && cat.status === 'active' && (
                            <button onClick={() => archiveCategory(cat.id)} className="text-xs text-red-500 hover:underline">Archive</button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RECORD CASH PAYMENT MODAL ══════════════════════════════════════════ */}
        {isCashModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => { setIsCashModalOpen(false); setCashConfirmStep(false); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60 shrink-0">
                <h3 className="text-lg font-bold text-slate-800">{cashConfirmStep ? 'Confirm Payment' : 'Record Cash Payment'}</h3>
                <button onClick={() => { setIsCashModalOpen(false); setCashConfirmStep(false); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {!cashConfirmStep ? (
                  <form id="cash-form" onSubmit={handleCashSubmit} className="space-y-4">
                    {cashFormError && (
                      <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 border border-red-100 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{cashFormError}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tenant <span className="text-red-500">*</span></label>
                      <select required value={cashForm.tenantId} onChange={e => setCashForm(f => ({ ...f, tenantId: e.target.value, chargeId: '' }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                        <option value="">Select tenant</option>
                        {tenants.filter(t => t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming').map(t => (
                          <option key={t.id} value={t.id}>{t.fullName} — {t.tenantId}</option>
                        ))}
                      </select>
                      {selectedTenant && <p className="text-xs text-slate-400 mt-1">Room {selectedTenant.roomNumber} · {selectedTenant.tenantId}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Outstanding Charge <span className="text-red-500">*</span></label>
                      {!cashForm.tenantId ? (
                        <p className="text-xs text-slate-400 italic">Select a tenant first.</p>
                      ) : tenantOpenCharges.length === 0 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">No outstanding charges for this tenant. Issue a charge first.</p>
                      ) : (
                        <select required value={cashForm.chargeId} onChange={e => setCashForm(f => ({ ...f, chargeId: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                          <option value="">Select charge</option>
                          {tenantOpenCharges.map(c => (
                            <option key={c.id} value={c.id}>{c.categoryName} — {c.billingPeriod} (Balance: {formatGHS(c.remainingBalance)})</option>
                          ))}
                        </select>
                      )}
                      {selectedCharge && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-1 text-slate-600">
                          <div className="flex justify-between"><span>Original:</span><span className="font-medium">{formatGHS(selectedCharge.amount)}</span></div>
                          <div className="flex justify-between"><span>Paid:</span><span className="font-medium text-emerald-600">{formatGHS(selectedCharge.amountPaid)}</span></div>
                          <div className="flex justify-between"><span>Remaining:</span><span className="font-bold text-slate-800">{formatGHS(selectedCharge.remainingBalance)}</span></div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received (GH₵) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">GH₵</span>
                          <input type="number" required min="0.01" step="0.01" value={cashForm.amount} onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))} className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0.00" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date Received <span className="text-red-500">*</span></label>
                        <input type="date" required value={cashForm.paymentDate} onChange={e => setCashForm(f => ({ ...f, paymentDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Receipt / Reference <span className="text-slate-400 text-xs font-normal">(Optional)</span></label>
                      <input type="text" value={cashForm.receiptRef} onChange={e => setCashForm(f => ({ ...f, receiptRef: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. RCP-001" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes <span className="text-slate-400 text-xs font-normal">(Optional)</span></label>
                      <textarea value={cashForm.notes} onChange={e => setCashForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none resize-none" placeholder="Any additional notes…" />
                    </div>
                  </form>
                ) : (
                  // Confirmation screen
                  <div className="space-y-4">
                    <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                      <p className="text-sm font-semibold text-teal-800 mb-3">Please confirm this payment:</p>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="flex justify-between"><span className="text-slate-500">Tenant:</span><span className="font-medium">{selectedTenant?.fullName}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Room:</span><span className="font-medium">{selectedTenant?.roomNumber}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Category:</span><span className="font-medium">{selectedCharge?.categoryName}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Period:</span><span className="font-medium">{selectedCharge?.billingPeriod}</span></div>
                        <div className="flex justify-between border-t border-teal-200 pt-2 mt-2"><span className="font-bold text-slate-700">Amount Received:</span><span className="font-bold text-teal-700 text-lg">{formatGHS(parseFloat(cashForm.amount))}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Date:</span><span className="font-medium">{new Date(cashForm.paymentDate).toLocaleDateString()}</span></div>
                        {cashForm.receiptRef && <div className="flex justify-between"><span className="text-slate-500">Receipt Ref:</span><span className="font-medium">{cashForm.receiptRef}</span></div>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      ⚠ By confirming, you certify that you have physically received this cash from the tenant. This action will update the charge balance and appear in both portals.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
                <button type="button" onClick={() => cashConfirmStep ? setCashConfirmStep(false) : setIsCashModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                  {cashConfirmStep ? 'Back' : 'Cancel'}
                </button>
                {!cashConfirmStep ? (
                  <button type="submit" form="cash-form" className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
                    Review Payment
                  </button>
                ) : (
                  <button onClick={handleCashConfirm} disabled={isCashSubmitting} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2 transition-colors">
                    {isCashSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Confirm & Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ISSUE CHARGE MODAL ═════════════════════════════════════════════════ */}
        {isChargeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsChargeModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60 shrink-0">
                <h3 className="text-lg font-bold text-slate-800">Issue New Charge</h3>
                <button onClick={() => setIsChargeModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleIssueCharge} className="p-6 space-y-4">
                {chargeFormError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 border border-red-100 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{chargeFormError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tenant <span className="text-red-500">*</span></label>
                  <select required value={chargeForm.tenantId} onChange={e => setChargeForm(f => ({ ...f, tenantId: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                    <option value="">Select tenant</option>
                    {tenants.filter(t => t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming').map(t => (
                      <option key={t.id} value={t.id}>{t.fullName} — Room {t.roomNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select required value={chargeForm.categoryId} onChange={e => setChargeForm(f => ({ ...f, categoryId: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                    <option value="">Select category</option>
                    {categories.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (GH₵) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">GH₵</span>
                      <input type="number" required min="0.01" step="0.01" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                    <input type="date" required value={chargeForm.dueDate} onChange={e => setChargeForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing Period <span className="text-red-500">*</span></label>
                  <input type="text" required value={chargeForm.billingPeriod} onChange={e => setChargeForm(f => ({ ...f, billingPeriod: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. October 2026" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsChargeModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={isChargeSubmitting} className="px-6 py-2.5 text-sm font-medium text-white bg-navy-900 rounded-xl hover:bg-navy-800 disabled:opacity-60 flex items-center gap-2">
                    {isChargeSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Issuing…</> : 'Issue Charge'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══ ADD CATEGORY MODAL ═════════════════════════════════════════════════ */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsCategoryModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                <h3 className="text-lg font-bold text-slate-800">Add Billing Category</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                {catFormError && <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 border border-red-100 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{catFormError}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. Security Fee" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 text-xs">(Optional)</span></label>
                  <input type="text" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Billing Frequency</label>
                    <select value={catForm.billingFrequency} onChange={e => setCatForm(f => ({ ...f, billingFrequency: e.target.value as BillingFrequency }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom</option>
                    </select>
                    {catForm.billingFrequency === 'custom' && (
                      <input type="number" min="1" placeholder="Months" value={catForm.customIntervalMonths} onChange={e => setCatForm(f => ({ ...f, customIntervalMonths: e.target.value }))} className="mt-2 w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grace Period (days)</label>
                    <input type="number" min="0" value={catForm.gracePeriodDays} onChange={e => setCatForm(f => ({ ...f, gracePeriodDays: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={isCatSubmitting} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2">
                    {isCatSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══ PAYMENT DETAIL / RECEIPT MODAL ════════════════════════════════════ */}
        {selectedPayment && (
          <ReceiptModal 
            payment={selectedPayment} 
            onClose={() => setSelectedPayment(null)} 
            landlordName={landlordProfile.propertyName}
          />
        )}

      </div>
    </DashboardLayout>
  );
};

export default AdminPayments;
