import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CreditCard, ShieldCheck, 
  ArrowRight, UserPlus
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';
import type { SuperAdminStats } from '../api/client';

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);

  useEffect(() => {
    superAdminApi.getStats()
      .then(data => setStats(data))
      .catch(err => console.error('Failed to load stats:', err));
  }, []);

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="space-y-6">
        
        {/* Welcome Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold mb-3 border border-amber-500/30">
              <ShieldCheck className="w-4 h-4" />
              <span>Platform Owner Supervision</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Super Admin Overview</h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Governance center for DwellBase landlord provisioning, one-time payment verification, permanent workspace activations, and immutable audit logs.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/superadmin/landlords"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-semibold text-xs transition-colors shadow-sm"
              >
                <Building2 className="w-4 h-4" />
                <span>Manage Landlords</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/superadmin/add-landlord"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs transition-colors border border-slate-700"
              >
                <UserPlus className="w-4 h-4 text-teal-400" />
                <span>Add Landlord</span>
              </Link>
              <Link
                to="/superadmin/payments"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs transition-colors border border-slate-700"
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>One-Time Payments</span>
              </Link>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Operational Overview Cards (Calculated directly from Database) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Landlords */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Landlords</span>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{stats?.totalLandlords ?? 0}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Registered accounts</span>
          </div>

          {/* Active Landlords */}
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Active</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{stats?.activeLandlords ?? 0}</div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Permanent access</span>
          </div>

          {/* Pending Payment */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Pending Payment</span>
            <div className="text-2xl font-extrabold text-slate-700 mt-1">{stats?.pendingPayment ?? 0}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Awaiting fee</span>
          </div>

          {/* Pending Activation */}
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/20">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Pending Activation</span>
            <div className="text-2xl font-extrabold text-blue-700 mt-1">{stats?.pendingActivation ?? 0}</div>
            <span className="text-[11px] text-blue-600 font-medium mt-1 block">Awaiting approval</span>
          </div>

          {/* Suspended */}
          <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm bg-red-50/20">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block">Suspended</span>
            <div className="text-2xl font-extrabold text-red-700 mt-1">{stats?.suspendedAccounts ?? 0}</div>
            <span className="text-[11px] text-red-600 font-medium mt-1 block">Restricted access</span>
          </div>

          {/* Total Collections (Approved Only) */}
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Approved Collections</span>
            <div className="text-xl font-extrabold text-amber-900 mt-1">
              GH₵{stats?.totalApprovedCollections?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <span className="text-[10px] text-amber-700 font-semibold mt-1 block">Excludes pending/rejected</span>
          </div>
        </div>

        {/* 2-Column Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Recently Created Landlords */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Recent Landlord Accounts</h3>
                <p className="text-xs text-slate-500">Recently registered property managers</p>
              </div>
              <Link to="/superadmin/landlords" className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1">
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 flex-1">
              {!stats?.recentLandlords || stats.recentLandlords.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No landlord records yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {stats.recentLandlords.map((l) => (
                    <div key={l.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{l.full_name}</span>
                        <span className="text-slate-500 text-[11px]">{l.email} &bull; {l.landlord_code || 'LL'}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        l.account_status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : l.account_status === 'Suspended'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : l.account_status === 'Pending Activation'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {l.account_status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent One-Time Payments */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Recent Payment Records</h3>
                <p className="text-xs text-slate-500">One-time account access fee transactions</p>
              </div>
              <Link to="/superadmin/payments" className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1">
                <span>Manage Payments</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 flex-1">
              {!stats?.recentPayments || stats.recentPayments.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No payment records yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {stats.recentPayments.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{p.landlord_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({p.payment_id})</span>
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          {p.payment_method === 'cash' ? 'Cash Payment' : 'Direct Mobile Money'} &bull; {p.date_received}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800">GH₵{p.amount}</div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.status === 'approved'
                            ? 'text-emerald-700 bg-emerald-50'
                            : p.status === 'rejected'
                            ? 'text-red-700 bg-red-50'
                            : p.status === 'reversed'
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-blue-700 bg-blue-50'
                        }`}>
                          {p.status === 'pending_verification' ? 'Pending' : p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Recent Platform Audit Trail */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Recent Administrative Activity</h3>
              <p className="text-xs text-slate-500">Immutable governance audit log</p>
            </div>
            <Link to="/superadmin/audit-logs" className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1">
              <span>View Full Audit Log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4">
            {!stats?.recentAudit || stats.recentAudit.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">No audit logs recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {stats.recentAudit.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                        {a.action}
                      </span>
                      <span className="text-slate-800 font-medium">{a.landlord_name || 'Platform'}</span>
                      <span className="text-slate-500 text-[11px] hidden sm:inline">&bull; {a.notes || 'Action performed'}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
