import { useState, useEffect } from 'react';
import { 
  History, Search, Filter, CreditCard, 
  CheckCircle2, XCircle, RotateCcw, AlertCircle,
  Loader2
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';
import type { OneTimePaymentRecord } from '../api/client';

const SuperAdminPaymentHistory = () => {
  const [payments, setPayments] = useState<OneTimePaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const data = await superAdminApi.getPayments();
        setPayments(data);
      } catch (err) {
        console.error('Failed to fetch payment history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

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

  const totalApproved = filteredPayments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'pending_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Pending Verification
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
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
                <History className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">One-Time Payment History</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Complete historical ledger of all one-time account-access transactions, approvals, and audit records.
            </p>
          </div>
        </div>

        {/* Top Summary Banner */}
        <div className="bg-gradient-to-r from-navy-900 via-slate-900 to-navy-800 p-6 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase font-bold text-teal-400 tracking-wider">
              Total Approved Account Collections
            </div>
            <div className="text-3xl font-extrabold text-white mt-1">
              GH₵{totalApproved.toLocaleString()}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Reflects verified, permanent access fees across {filteredPayments.filter(p => p.status === 'approved').length} landlords.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 text-xs">
            <div className="text-center px-3 border-r border-white/10">
              <div className="font-bold text-white text-base">{payments.filter(p => p.status === 'approved').length}</div>
              <div className="text-slate-300 text-[10px]">Approved</div>
            </div>
            <div className="text-center px-3 border-r border-white/10">
              <div className="font-bold text-amber-400 text-base">{payments.filter(p => p.status === 'pending_verification').length}</div>
              <div className="text-slate-300 text-[10px]">Pending</div>
            </div>
            <div className="text-center px-3">
              <div className="font-bold text-rose-400 text-base">{payments.filter(p => p.status === 'rejected' || p.status === 'reversed').length}</div>
              <div className="text-slate-300 text-[10px]">Rej / Rev</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search historical records by landlord, payment ID, ref, or memo..."
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
                <option value="approved">Approved</option>
                <option value="pending_verification">Pending Verification</option>
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

        {/* History Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">Loading ledger...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              No payment history records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Internal ID</th>
                    <th className="py-3 px-4">Landlord</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Date Received</th>
                    <th className="py-3 px-4">External Reference</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4">Approval Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {p.payment_id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {p.landlord_name}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        GH₵{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-medium text-slate-700">
                        {p.payment_method === 'direct_momo' ? 'Direct Mobile Money' : 'Cash'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(p.date_received).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {p.external_reference || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {p.recorded_by}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {p.approved_by ? (
                          <div>
                            <span className="font-semibold text-slate-700">{p.approved_by}</span>
                            <div className="text-[10px] text-slate-400">
                              {p.approval_date ? new Date(p.approval_date).toLocaleDateString() : ''}
                            </div>
                          </div>
                        ) : p.rejection_reason ? (
                          <div className="text-rose-600 font-medium">Rej: {p.rejection_reason}</div>
                        ) : p.reversal_reason ? (
                          <div className="text-purple-600 font-medium">Rev: {p.reversal_reason}</div>
                        ) : (
                          <span className="text-slate-400 italic">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminPaymentHistory;
