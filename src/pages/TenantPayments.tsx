import { useState, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ReceiptModal from '../components/ReceiptModal';
import { useAppData, useCurrentTenant } from '../context/AppDataContext';
import type { Charge, MomoNetwork, PaymentRecord } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import {
  CreditCard, AlertTriangle, CheckCircle2,
  Clock, X, AlertCircle, Phone, ChevronRight,
  Banknote, Info, Receipt
} from 'lucide-react';

const formatGHS = (n: number) => `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const statusStyles: Record<string, string> = {
  successful: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  failed: 'bg-red-50 text-red-700',
  reversed: 'bg-gray-100 text-gray-600',
};

const chargeStatusStyles: Record<string, string> = {
  upcoming: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  paid: 'bg-emerald-50 text-emerald-700',
  partially_paid: 'bg-orange-50 text-orange-700',
};

type MomoStep = 'select_charge' | 'enter_amount' | 'select_network' | 'confirm' | 'processing' | 'result';

const NETWORKS: { id: MomoNetwork; label: string; color: string }[] = [
  { id: 'mtn', label: 'MTN MoMo', color: 'bg-yellow-400' },
  { id: 'telecel', label: 'Telecel Cash', color: 'bg-red-500' },
  { id: 'at', label: 'AT Money', color: 'bg-blue-600' },
];

const TenantPayments = () => {
  const { charges, payments, categories, getTenantOutstandingBalance, getTenantTotalPaid, initiateMoneyPayment, landlordProfile } = useAppData();
  const { notify } = useNotifications();

  // Scoped to active logged-in tenant
  const myTenant = useCurrentTenant();

  const myCharges = useMemo(() => myTenant ? charges.filter(c => c.tenantId === myTenant.id) : [], [charges, myTenant]);
  const myPayments = useMemo(() => myTenant ? payments.filter(p => p.tenantId === myTenant.id) : [], [payments, myTenant]);
  const outstandingCharges = useMemo(() => myCharges.filter(c => c.status !== 'paid' && c.remainingBalance > 0), [myCharges]);
  const overdueCharges = useMemo(() => myCharges.filter(c => c.status === 'overdue'), [myCharges]);
  const outstandingBalance = myTenant ? getTenantOutstandingBalance(myTenant.id) : 0;
  const totalPaid = myTenant ? getTenantTotalPaid(myTenant.id) : 0;

  // ── MoMo flow state ───────────────────────────────────────────────────────────
  const [isMomoOpen, setIsMomoOpen] = useState(false);
  const [momoStep, setMomoStep] = useState<MomoStep>('select_charge');
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<MomoNetwork | null>(null);
  const [momoRef, setMomoRef] = useState('');
  const [momoResult, setMomoResult] = useState<'pending' | 'failed' | null>(null);

  // ── Receipt state ─────────────────────────────────────────────────────────────
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  const remainingAfterPay = selectedCharge
    ? Math.max(0, selectedCharge.remainingBalance - parseFloat(payAmount || '0'))
    : 0;

  const resetMomo = () => {
    setIsMomoOpen(false);
    setMomoStep('select_charge');
    setSelectedCharge(null);
    setPayAmount('');
    setSelectedNetwork(null);
    setMomoRef('');
    setMomoResult(null);
  };

  const handleInitiateMomo = async () => {
    if (!myTenant || !selectedCharge || !selectedNetwork) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedCharge.remainingBalance + 0.001) return;

    setMomoStep('processing');
    const pending = await initiateMoneyPayment({
      tenantId: myTenant.id,
      tenantName: myTenant.fullName,
      roomId: myTenant.roomId,
      roomNumber: myTenant.roomNumber,
      chargeId: selectedCharge.id,
      categoryId: selectedCharge.categoryId,
      categoryName: selectedCharge.categoryName,
      billingPeriod: selectedCharge.billingPeriod,
      amount,
      momoNetwork: selectedNetwork,
    });
    setMomoRef(pending.referenceNumber);

    // Simulate: provider not configured → show pending/failed state
    setTimeout(() => {
      setMomoResult('pending');
      setMomoStep('result');
      notify({
        recipientType: 'tenant',
        recipientId: myTenant.id,
        title: 'Payment Verification Pending',
        message: `Your ${formatGHS(amount)} MoMo payment is awaiting provider verification. Reference: ${pending.referenceNumber}.`,
        type: 'info',
      });
    }, 2000);
  };

  // ── Category summaries ────────────────────────────────────────────────────────

  const categorySummaries = useMemo(() => {
    return categories.filter(c => c.status === 'active').map(cat => {
      const catCharges = myCharges.filter(c => c.categoryId === cat.id);
      return {
        cat,
        total: catCharges.reduce((s, c) => s + c.amount, 0),
        paid: catCharges.reduce((s, c) => s + c.amountPaid, 0),
        balance: catCharges.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remainingBalance, 0),
        hasCharges: catCharges.length > 0,
      };
    }).filter(s => s.hasCharges);
  }, [categories, myCharges]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (!myTenant) {
    return (
      <DashboardLayout userType="tenant" userName="Tenant">
        <div className="max-w-2xl mx-auto py-16 text-center">
          <CreditCard className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Tenancy Found</h2>
          <p className="text-slate-500">Your tenant account is not yet linked to an active tenancy. Please contact your landlord.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userType="tenant" userName={myTenant.fullName} tenantId={myTenant.id}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Payments</h2>
          <p className="text-slate-500 mt-1">View your charges, outstanding balance, and payment history.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Outstanding</p>
            <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatGHS(outstandingBalance)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{formatGHS(totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Overdue</p>
            <p className={`text-2xl font-bold ${overdueCharges.length > 0 ? 'text-red-600' : 'text-slate-300'}`}>
              {overdueCharges.length} {overdueCharges.length === 1 ? 'charge' : 'charges'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Monthly Rent</p>
            <p className="text-2xl font-bold text-slate-800">{formatGHS(myTenant.monthlyRent)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Room {myTenant.roomNumber}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        {categorySummaries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-slate-700 text-sm">Balance by Category</div>
            <div className="divide-y divide-gray-50">
              {categorySummaries.map(({ cat, total, paid, balance }) => (
                <div key={cat.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{cat.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">{cat.billingFrequency}</p>
                  </div>
                  <div className="flex gap-6 text-right text-sm">
                    <div><p className="text-xs text-slate-400">Charged</p><p className="font-medium">{formatGHS(total)}</p></div>
                    <div><p className="text-xs text-slate-400">Paid</p><p className="font-medium text-emerald-600">{formatGHS(paid)}</p></div>
                    <div><p className="text-xs text-slate-400">Balance</p><p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatGHS(balance)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outstanding Charges */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700 text-sm">Outstanding Charges</span>
            {outstandingCharges.length > 0 && (
              <button
                onClick={() => { setMomoStep('select_charge'); setIsMomoOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <Phone className="w-4 h-4" /> Pay via MoMo
              </button>
            )}
          </div>
          {outstandingCharges.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
              <p className="text-slate-500">No outstanding charges. You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {outstandingCharges.map(c => (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{c.categoryName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${chargeStatusStyles[c.status]}`}>{c.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.billingPeriod} · Due {new Date(c.dueDate).toLocaleDateString()}</p>
                      <div className="mt-2 flex gap-4 text-xs text-slate-600">
                        <span>Charged: <span className="font-medium">{formatGHS(c.amount)}</span></span>
                        <span>Paid: <span className="font-medium text-emerald-600">{formatGHS(c.amountPaid)}</span></span>
                        <span>Balance: <span className="font-bold text-slate-800">{formatGHS(c.remainingBalance)}</span></span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedCharge(c); setPayAmount(c.remainingBalance.toFixed(2)); setMomoStep('enter_amount'); setIsMomoOpen(true); }}
                      className="shrink-0 px-3 py-2 text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors font-medium"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 font-semibold text-slate-700 text-sm">Payment History</div>
          {myPayments.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              No payment records yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="bg-gray-50 text-xs text-slate-500 uppercase tracking-wide border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Method</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...myPayments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.referenceNumber}</td>
                      <td className="px-5 py-3">
                        <div>{p.categoryName}</div>
                        <div className="text-xs text-slate-400">{p.billingPeriod}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{formatGHS(p.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.paymentMethod === 'cash' ? 'bg-navy-50 text-navy-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {p.paymentMethod === 'cash' ? <><Banknote className="w-3 h-3" /> Cash — Admin</> : <><Phone className="w-3 h-3" /> MoMo</>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[p.status] || 'bg-gray-100 text-gray-600'}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.status === 'successful' && (
                          <button onClick={() => setSelectedPayment(p)} className="p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors flex items-center justify-end gap-1.5 ml-auto text-xs font-medium">
                            <Receipt className="w-4 h-4" /> View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══ MOMO PAYMENT MODAL ══════════════════════════════════════════════════ */}
        {isMomoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={momoStep !== 'processing' ? resetMomo : undefined} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-yellow-500" /> Mobile Money Payment
                </h3>
                {momoStep !== 'processing' && (
                  <button onClick={resetMomo} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
                )}
              </div>

              {/* Step indicator */}
              {(momoStep === 'select_charge' || momoStep === 'enter_amount' || momoStep === 'select_network' || momoStep === 'confirm') && (
                <div className="px-6 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {['Select Charge', 'Amount', 'Network', 'Confirm'].map((s, i) => {
                      const steps = ['select_charge', 'enter_amount', 'select_network', 'confirm'];
                      const stepIdx = steps.indexOf(momoStep);
                      return (
                        <span key={s} className={`${i <= stepIdx ? 'text-teal-600 font-semibold' : ''}`}>
                          {i > 0 && <ChevronRight className="inline w-3 h-3 mx-1" />}{s}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Step 1: Select Charge */}
                {momoStep === 'select_charge' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Select the charge you want to pay:</p>
                    {outstandingCharges.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No outstanding charges.</p>
                    ) : (
                      outstandingCharges.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCharge(c); setPayAmount(c.remainingBalance.toFixed(2)); setMomoStep('enter_amount'); }}
                          className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-teal-500 hover:bg-teal-50/20 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-slate-800">{c.categoryName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{c.billingPeriod}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-800">{formatGHS(c.remainingBalance)}</p>
                              <p className="text-xs text-slate-400">remaining</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Step 2: Enter Amount */}
                {momoStep === 'enter_amount' && selectedCharge && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium">{selectedCharge.categoryName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Period</span><span className="font-medium">{selectedCharge.billingPeriod}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Remaining Balance</span><span className="font-bold text-slate-800">{formatGHS(selectedCharge.remainingBalance)}</span></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Pay (GH₵)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">GH₵</span>
                        <input
                          type="number" min="0.01" step="0.01"
                          max={selectedCharge.remainingBalance}
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none text-lg font-semibold"
                        />
                      </div>
                      {parseFloat(payAmount) > 0 && parseFloat(payAmount) <= selectedCharge.remainingBalance && (
                        <p className="text-xs text-slate-500 mt-1.5">Remaining after this payment: <span className="font-semibold text-slate-700">{formatGHS(remainingAfterPay)}</span></p>
                      )}
                      {parseFloat(payAmount) > selectedCharge.remainingBalance + 0.001 && (
                        <p className="text-xs text-red-600 mt-1.5">Amount exceeds the remaining balance of {formatGHS(selectedCharge.remainingBalance)}.</p>
                      )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Money Number</label>
                        <input
                            type="tel"
                            placeholder="e.g. 05440044"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                    </div>
                  </div>
                )}

                {/* Step 3: Select Network */}
                {momoStep === 'select_network' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Select your Mobile Money network:</p>
                    {NETWORKS.map(net => (
                      <button
                        key={net.id}
                        onClick={() => setSelectedNetwork(net.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${selectedNetwork === net.id ? 'border-teal-500 bg-teal-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className={`w-10 h-10 rounded-full ${net.color} flex items-center justify-center`}>
                          <Phone className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-semibold text-slate-800">{net.label}</span>
                        {selectedNetwork === net.id && <CheckCircle2 className="w-5 h-5 text-teal-600 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 4: Confirm */}
                {momoStep === 'confirm' && selectedCharge && selectedNetwork && (
                  <div className="space-y-4">
                    <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl space-y-2 text-sm">
                      <p className="font-bold text-teal-800 mb-2">Payment Summary</p>
                      {[
                        ['Category', selectedCharge.categoryName],
                        ['Period', selectedCharge.billingPeriod],
                        ['Network', NETWORKS.find(n => n.id === selectedNetwork)?.label || ''],
                        ['Amount', formatGHS(parseFloat(payAmount))],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-slate-500">{k}</span>
                          <span className="font-semibold text-slate-800">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Provider not configured notice */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Payment Provider Not Configured</p>
                        <p className="text-xs text-amber-700 mt-1">A real Mobile Money provider (e.g. Hubtel or Paystack) must be configured with valid API credentials before live payments can be processed. Your payment will be submitted as <strong>Pending Verification</strong> until the provider confirms it.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing */}
                {momoStep === 'processing' && (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
                    <p className="font-semibold text-slate-700">Initiating payment…</p>
                    <p className="text-sm text-slate-400">Please wait while we contact the payment provider.</p>
                  </div>
                )}

                {/* Result */}
                {momoStep === 'result' && (
                  <div className="py-4 text-center space-y-4">
                    {momoResult === 'pending' ? (
                      <>
                        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                          <Clock className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-lg">Payment Pending Verification</p>
                          <p className="text-sm text-slate-500 mt-1">Your payment reference has been generated and submitted. It will be confirmed once the provider verifies the transaction.</p>
                          <p className="text-xs font-mono bg-gray-100 text-slate-600 px-3 py-2 rounded-lg mt-3">{momoRef}</p>
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 text-left flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                          Your outstanding balance has <strong>not been reduced</strong>. It will update only after the payment provider confirms the transaction.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle className="w-8 h-8" />
                        </div>
                        <p className="font-bold text-slate-800">Payment Failed</p>
                        <p className="text-sm text-slate-500">The payment could not be processed. Your outstanding balance is unchanged.</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              {momoStep !== 'processing' && momoStep !== 'result' && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                  <button onClick={momoStep === 'select_charge' ? resetMomo : () => setMomoStep(s => {
                    const steps: MomoStep[] = ['select_charge', 'enter_amount', 'select_network', 'confirm'];
                    return steps[Math.max(0, steps.indexOf(s) - 1)];
                  })} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                    {momoStep === 'select_charge' ? 'Cancel' : 'Back'}
                  </button>
                  {momoStep !== 'select_charge' && (
                    <button
                      onClick={() => {
                        if (momoStep === 'enter_amount') {
                          const amt = parseFloat(payAmount);
                          if (!selectedCharge || isNaN(amt) || amt <= 0 || amt > selectedCharge.remainingBalance + 0.001) return;
                          setMomoStep('select_network');
                        } else if (momoStep === 'select_network') {
                          if (!selectedNetwork) return;
                          setMomoStep('confirm');
                        } else if (momoStep === 'confirm') {
                          handleInitiateMomo();
                        }
                      }}
                      className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
                    >
                      {momoStep === 'confirm' ? 'Submit Payment' : 'Continue'}
                    </button>
                  )}
                </div>
              )}
              {momoStep === 'result' && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
                  <button onClick={resetMomo} className="px-6 py-2.5 text-sm font-medium text-white bg-navy-900 rounded-xl hover:bg-navy-800 transition-colors">Done</button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ═══ RECEIPT MODAL ══════════════════════════════════════════════════════ */}
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

export default TenantPayments;
