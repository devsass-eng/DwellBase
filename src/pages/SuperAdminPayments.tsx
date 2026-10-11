import { useState, useEffect } from 'react';
import { 
  CreditCard, Search, Filter, Plus, CheckCircle2, 
  XCircle, RotateCcw, AlertCircle, Loader2, DollarSign,
  Check, FileText
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';
import type { OneTimePaymentRecord, SuperAdminLandlord } from '../api/client';

const SuperAdminPayments = () => {
  const [payments, setPayments] = useState<OneTimePaymentRecord[]>([]);
  const [landlords, setLandlords] = useState<SuperAdminLandlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<OneTimePaymentRecord | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'reverse' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Record payment form fields
  const [selectedLandlordId, setSelectedLandlordId] = useState('');
  const [amount, setAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'direct_momo'>('cash');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [externalReference, setExternalReference] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [recordLoading, setRecordLoading] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [paymentsData, landlordsData] = await Promise.all([
        superAdminApi.getPayments(),
        superAdminApi.getLandlords(),
      ]);
      setPayments(paymentsData);
      setLandlords(landlordsData);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Filtered payments
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      (p.landlord_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.payment_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.external_reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.receipt_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesMethod = methodFilter === 'ALL' || p.payment_method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  // Calculate stats from actual DB records
  const totalApprovedCollections = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingCount = payments.filter((p) => p.status === 'pending_verification').length;
  const approvedCount = payments.filter((p) => p.status === 'approved').length;
  const rejectedCount = payments.filter((p) => p.status === 'rejected').length;
  const reversedCount = payments.filter((p) => p.status === 'reversed').length;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLandlordId) {
      setActionError('Please select a landlord.');
      return;
    }

    try {
      setRecordLoading(true);
      setActionError(null);
      await superAdminApi.recordPayment({
        landlordId: selectedLandlordId,
        amount: Number(amount) || 500,
        paymentMethod,
        dateReceived,
        externalReference: externalReference.trim() || undefined,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: recordNotes.trim() || undefined,
        autoApprove,
      });

      setIsRecordModalOpen(false);
      setSelectedLandlordId('');
      setExternalReference('');
      setReceiptNumber('');
      setRecordNotes('');
      setActionSuccess('Payment recorded and updated successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchAll();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setRecordLoading(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!selectedPayment || !actionType) return;
    setActionError(null);

    if ((actionType === 'reject' || actionType === 'reverse') && !actionReason.trim()) {
      setActionError(`A specific reason is required to ${actionType} this payment.`);
      return;
    }

    try {
      setActionLoading(true);
      if (actionType === 'approve') {
        await superAdminApi.approvePayment(selectedPayment.id, actionNotes.trim() || undefined);
        setActionSuccess(`Payment #${selectedPayment.payment_id} approved. Landlord account activated.`);
      } else if (actionType === 'reject') {
        await superAdminApi.rejectPayment(selectedPayment.id, actionReason.trim(), actionNotes.trim() || undefined);
        setActionSuccess(`Payment #${selectedPayment.payment_id} rejected.`);
      } else if (actionType === 'reverse') {
        await superAdminApi.reversePayment(selectedPayment.id, actionReason.trim(), actionNotes.trim() || undefined);
        setActionSuccess(`Payment #${selectedPayment.payment_id} reversed. Account flagged for review.`);
      }

      setActionType(null);
      setSelectedPayment(null);
      setActionReason('');
      setActionNotes('');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchAll();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${actionType} payment`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'pending_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Pending Verification
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            Reversed
          </span>
        );
      default:
        return <span className="text-xs text-slate-600 font-semibold">{status}</span>;
    }
  };

  return (
    <DashboardLayout userType="super_admin" userName="Admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-navy-900 text-teal-400 rounded-xl shadow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">One-Time Payments</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Record, independently verify, and approve single account-access fees collected outside DwellBase.
            </p>
          </div>

          <button
            onClick={() => {
              setIsRecordModalOpen(true);
              setActionError(null);
            }}
            className="px-4 py-2.5 bg-navy-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>

        {/* Global Action Notifications */}
        {actionSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {actionSuccess}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Collections</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">
              GH₵{totalApprovedCollections.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">{approvedCount} approved account access fees</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Verification</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting independent verification</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Recorded</span>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">{payments.length}</div>
            <p className="text-xs text-slate-500 mt-1">All historical payment entries</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected / Reversed</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">{rejectedCount + reversedCount}</div>
            <p className="text-xs text-slate-500 mt-1">{rejectedCount} rejected, {reversedCount} reversed</p>
          </div>
        </div>

        {/* Filters and Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search payments by landlord, payment ID, MoMo reference, or receipt #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-600 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-600 font-medium">Method:</span>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none"
              >
                <option value="ALL">All Methods</option>
                <option value="cash">Cash</option>
                <option value="direct_momo">Direct Mobile Money</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">Loading payment records...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              No one-time payment records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4">Landlord</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method & Date</th>
                    <th className="py-3 px-4">Reference / Receipt</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Approver</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {p.payment_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{p.landlord_name}</div>
                        <div className="text-[11px] text-slate-500">{p.landlord_email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        GH₵{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 capitalize">
                          {p.payment_method === 'direct_momo' ? 'Direct Mobile Money' : 'Cash'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(p.date_received).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.external_reference ? (
                          <div className="font-mono text-slate-700 font-semibold">{p.external_reference}</div>
                        ) : (
                          <span className="text-slate-400 italic">No external ref</span>
                        )}
                        {p.receipt_number && (
                          <div className="text-[10px] text-slate-500">RCP: {p.receipt_number}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>
                      <td className="py-3.5 px-4">
                        {p.approved_by ? (
                          <div>
                            <div className="font-semibold text-slate-700">{p.approved_by}</div>
                            <div className="text-[10px] text-slate-400">
                              {p.approval_date ? new Date(p.approval_date).toLocaleDateString() : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unapproved</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === 'pending_verification' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setActionType('approve');
                                  setActionError(null);
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setActionType('reject');
                                  setActionError(null);
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {p.status === 'approved' && (
                            <button
                              onClick={() => {
                                setSelectedPayment(p);
                                setActionType('reverse');
                                setActionError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                            >
                              Reverse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Record Payment Modal */}
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-scaleUp">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-navy-900 text-teal-400 rounded-xl">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">Record One-Time Payment</h3>
                </div>
                <button
                  onClick={() => setIsRecordModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              {actionError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {actionError}
                </div>
              )}

              <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Landlord <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedLandlordId}
                    onChange={(e) => {
                      setSelectedLandlordId(e.target.value);
                      const l = landlords.find((item) => item.id === e.target.value);
                      if (l) setAmount(l.one_time_fee || 500);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                  >
                    <option value="">-- Choose a Landlord --</option>
                    {landlords.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name} ({l.email}) — Status: {l.account_status} {l.is_paid ? '✓ Paid' : '⏳ Unpaid'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Amount Received (GH₵) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'direct_momo')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    >
                      <option value="cash">Direct Cash Received</option>
                      <option value="direct_momo">Direct Mobile Money Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Date Received <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dateReceived}
                      onChange={(e) => setDateReceived(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      External MoMo / Bank Ref
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2938201928"
                      value={externalReference}
                      onChange={(e) => setExternalReference(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Physical Receipt Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RCP-2026-004"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Administrative Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Cash handed over at platform office."
                    value={recordNotes}
                    onChange={(e) => setRecordNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded border-slate-300"
                    />
                    <span className="font-bold text-teal-900">
                      Approve and activate landlord account immediately
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recordLoading}
                    className="px-5 py-2 font-bold text-white bg-navy-900 hover:bg-slate-800 rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {recordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Payment Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Action Modal (Approve / Reject / Reverse) */}
        {actionType && selectedPayment && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-scaleUp text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  {actionType === 'approve' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {actionType === 'reject' && <XCircle className="w-5 h-5 text-rose-600" />}
                  {actionType === 'reverse' && <RotateCcw className="w-5 h-5 text-purple-600" />}
                  {actionType === 'approve' && 'Approve One-Time Payment'}
                  {actionType === 'reject' && 'Reject Payment Record'}
                  {actionType === 'reverse' && 'Reverse Payment Record'}
                </h3>
                <button
                  onClick={() => {
                    setActionType(null);
                    setSelectedPayment(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {actionError}
                </div>
              )}

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Landlord:</span>
                  <span className="font-bold text-slate-800">{selectedPayment.landlord_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold text-slate-900">GH₵{Number(selectedPayment.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="font-semibold text-slate-700 capitalize">
                    {selectedPayment.payment_method === 'direct_momo' ? 'Direct Mobile Money' : 'Cash'}
                  </span>
                </div>
                {selectedPayment.external_reference && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reference:</span>
                    <span className="font-mono font-semibold text-slate-700">{selectedPayment.external_reference}</span>
                  </div>
                )}
              </div>

              {(actionType === 'reject' || actionType === 'reverse') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reason for {actionType} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`e.g. ${actionType === 'reject' ? 'External transfer was not received or failed confirmation' : 'Duplicate transaction entry'}`}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Administrative Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional audit trail remarks..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                />
              </div>

              {actionType === 'approve' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <strong>Approval Effect:</strong> This will mark the landlord as paid, set their account to Active, and activate their permanent workspace.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setSelectedPayment(null);
                  }}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={actionLoading}
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50 ${
                    actionType === 'approve' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : actionType === 'reject' 
                        ? 'bg-rose-600 hover:bg-rose-700' 
                        : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminPayments;
