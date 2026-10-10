import { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertCircle, Clock, ShieldAlert, 
  Search, Lock, Unlock, KeyRound, Loader2,
  Building2, Check, AlertTriangle,
  Copy, ShieldCheck
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';
import type { SuperAdminLandlord } from '../api/client';

const SuperAdminAccountStatus = () => {
  const [landlords, setLandlords] = useState<SuperAdminLandlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'Active' | 'Pending Activation' | 'Pending Payment' | 'Suspended'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal actions
  const [selectedLandlord, setSelectedLandlord] = useState<SuperAdminLandlord | null>(null);
  const [actionType, setActionType] = useState<'activate' | 'suspend' | 'reactivate' | 'reset-access' | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activationResult, setActivationResult] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchLandlords = async () => {
    try {
      setLoading(true);
      const data = await superAdminApi.getLandlords();
      setLandlords(data);
    } catch (err) {
      console.error('Failed to load landlords:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLandlords();
  }, []);

  const filteredLandlords = landlords.filter((l) => {
    const matchesTab = activeTab === 'ALL' || l.account_status === activeTab;
    const matchesSearch =
      (l.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.landlord_code || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const activeCount = landlords.filter((l) => l.account_status === 'Active').length;
  const pendingActCount = landlords.filter((l) => l.account_status === 'Pending Activation').length;
  const pendingPayCount = landlords.filter((l) => l.account_status === 'Pending Payment').length;
  const suspendedCount = landlords.filter((l) => l.account_status === 'Suspended').length;

  const handleExecuteAction = async () => {
    if (!selectedLandlord || !actionType) return;
    setActionError(null);

    if (actionType === 'suspend' && !suspensionReason.trim()) {
      setActionError('A specific administrative reason is required to suspend an account.');
      return;
    }

    try {
      setActionLoading(true);
      if (actionType === 'activate') {
        const res = await superAdminApi.activateLandlord(selectedLandlord.id, adminNotes.trim() || undefined);
        if (res.activation) {
          setActivationResult({ link: res.activation.activationLink, expiresAt: res.activation.expiresAt });
        }
        setActionSuccess(`Account for ${selectedLandlord.full_name} activated successfully.`);
      } else if (actionType === 'suspend') {
        await superAdminApi.suspendLandlord(selectedLandlord.id, suspensionReason.trim(), adminNotes.trim() || undefined);
        setActionSuccess(`Account for ${selectedLandlord.full_name} has been suspended.`);
        setActionType(null);
      } else if (actionType === 'reactivate') {
        await superAdminApi.reactivateLandlord(selectedLandlord.id, adminNotes.trim() || undefined);
        setActionSuccess(`Account for ${selectedLandlord.full_name} reactivated without additional charge.`);
        setActionType(null);
      } else if (actionType === 'reset-access') {
        const res = await superAdminApi.resetAccess(selectedLandlord.id, undefined, adminNotes.trim() || undefined);
        setActivationResult({ link: res.activationLink, expiresAt: res.expiresAt });
        setActionSuccess(`New access token generated for ${selectedLandlord.full_name}.`);
      }

      fetchLandlords();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${actionType} account`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (activationResult?.link) {
      navigator.clipboard.writeText(activationResult.link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-navy-900 text-teal-400 rounded-xl shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Landlord Account Status</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Manage landlord account states: Active (Permanent), Pending Activation, Pending Payment, and Suspended.
            </p>
          </div>
        </div>

        {/* Global Notifications */}
        {actionSuccess && !activationResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {actionSuccess}
          </div>
        )}

        {/* Activation Link Modal / Banner if generated */}
        {activationResult && (
          <div className="bg-white rounded-2xl border-2 border-teal-500/30 p-6 shadow-xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Secure Single-Use Activation / Reset Link
              </span>
              <button
                onClick={() => {
                  setActivationResult(null);
                  setActionType(null);
                  setSelectedLandlord(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Provide this link to the landlord. It allows them to securely set their password and log in immediately.
            </p>
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-teal-200">
              <input
                type="text"
                readOnly
                value={activationResult.link}
                className="flex-1 bg-transparent text-xs text-slate-800 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  copiedLink ? 'bg-emerald-600 text-white' : 'bg-navy-900 text-white hover:bg-slate-800'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Status Tab Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveTab('Active')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === 'Active'
                ? 'bg-emerald-50/80 border-emerald-500 shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">{activeCount}</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Permanent Access</p>
          </button>

          <button
            onClick={() => setActiveTab('Pending Activation')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === 'Pending Activation'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Pending Activation</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">{pendingActCount}</div>
            <p className="text-[11px] text-blue-700 font-medium mt-0.5">Payment Paid & Approved</p>
          </button>

          <button
            onClick={() => setActiveTab('Pending Payment')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === 'Pending Payment'
                ? 'bg-amber-50/80 border-amber-500 shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Pending Payment</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">{pendingPayCount}</div>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">Waiting for Fee</p>
          </button>

          <button
            onClick={() => setActiveTab('Suspended')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === 'Suspended'
                ? 'bg-rose-50/80 border-rose-500 shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Suspended</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">{suspendedCount}</div>
            <p className="text-[11px] text-rose-700 font-medium mt-0.5">Admin Hold</p>
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by landlord name, email, phone, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({landlords.length})
            </button>
          </div>
        </div>

        {/* Landlords Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">Loading landlord statuses...</p>
            </div>
          ) : filteredLandlords.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              No landlords match the selected status.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Landlord</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">One-Time Fee</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Suspension Reason</th>
                    <th className="py-3 px-4 text-right">Access Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLandlords.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{l.full_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{l.landlord_code || 'ID: ' + l.id.slice(0, 8)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700">{l.email}</div>
                        <div className="text-[11px] text-slate-400">{l.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">GH₵{l.one_time_fee || 500}</div>
                        <div className="text-[10px] text-slate-500">
                          {l.is_paid ? '✓ Approved' : '⏳ Unpaid'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {l.account_status === 'Active' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Active (Permanent)
                          </span>
                        )}
                        {l.account_status === 'Pending Activation' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            Pending Activation
                          </span>
                        )}
                        {l.account_status === 'Pending Payment' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Pending Payment
                          </span>
                        )}
                        {l.account_status === 'Suspended' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                        {l.suspension_reason ? (
                          <span className="text-rose-700 font-medium">{l.suspension_reason}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.account_status === 'Suspended' ? (
                            <button
                              onClick={() => {
                                setSelectedLandlord(l);
                                setActionType('reactivate');
                                setActionError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center gap-1"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedLandlord(l);
                                setActionType('suspend');
                                setActionError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Suspend
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedLandlord(l);
                              setActionType('reset-access');
                              setActionError(null);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                            Reset Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Confirmation Modal */}
        {actionType && selectedLandlord && !activationResult && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs animate-scaleUp">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base">
                  {actionType === 'suspend' && 'Suspend Landlord Account'}
                  {actionType === 'reactivate' && 'Reactivate Landlord Account'}
                  {actionType === 'reset-access' && 'Generate New Access Token'}
                  {actionType === 'activate' && 'Activate Landlord Account'}
                </h3>
                <button
                  onClick={() => {
                    setActionType(null);
                    setSelectedLandlord(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {actionError}
                </div>
              )}

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Landlord:</span>
                  <span className="font-bold text-slate-800">{selectedLandlord.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-700">{selectedLandlord.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold text-slate-800">{selectedLandlord.account_status}</span>
                </div>
              </div>

              {actionType === 'suspend' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Administrative Reason for Suspension <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Terms violation or landlord requested temporary hold"
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    All landlord data (rooms, tenants, financials) will be preserved safely.
                  </p>
                </div>
              )}

              {actionType === 'reactivate' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <strong>Permanent Access Guarantee:</strong> Reactivating this landlord will restore their access immediately without requiring another payment.
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Optional Audit Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional remarks for system audit trail..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setSelectedLandlord(null);
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
                    actionType === 'suspend'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-navy-900 hover:bg-slate-800'
                  }`}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminAccountStatus;
