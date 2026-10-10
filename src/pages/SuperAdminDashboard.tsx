import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Users, DoorOpen, CreditCard, 
  ShieldCheck, AlertTriangle, ArrowRight, 
  Activity, CheckCircle2, UserX, Clock,
  Layers, Plus
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi, SuperAdminStats, SuperAdminLandlord } from '../api/client';

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [recentLandlords, setRecentLandlords] = useState<SuperAdminLandlord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [statsData, landlordsData] = await Promise.all([
          superAdminApi.getStats(),
          superAdminApi.getLandlords(),
        ]);
        setStats(statsData);
        setRecentLandlords(landlordsData.slice(0, 5));
      } catch (err) {
        console.error('Failed to load Super Admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="space-y-6">
        
        {/* Welcome Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold mb-3 border border-amber-500/30">
              <ShieldCheck className="w-4 h-4" />
              <span>Platform Administration &amp; Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Real-time platform overview across all managed landlords, tenant tenancies, subscription tiers, and administrative audit trails.
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
                to="/superadmin/audit-logs"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs transition-colors border border-slate-700"
              >
                <Activity className="w-4 h-4" />
                <span>View Platform Audit Logs</span>
              </Link>
            </div>
          </div>
          {/* Background decoration */}
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Total Landlords</span>
              <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">{stats?.totalLandlords ?? 0}</div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
              <span className="text-emerald-600 font-semibold">{stats?.activeLandlords ?? 0} Active</span>
              <span>&bull;</span>
              <span className="text-amber-600 font-semibold">{stats?.pendingLandlords ?? 0} Pending</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Total Tenants</span>
              <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">{stats?.totalTenants ?? 0}</div>
            <div className="text-xs text-slate-500 mt-2">
              Across {stats?.totalRooms ?? 0} managed rooms
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Total Rent Billed</span>
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">GH₵{stats?.totalCharged?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}</div>
            <div className="text-xs text-emerald-600 font-semibold mt-2">
              GH₵{stats?.totalCollected?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'} collected
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Attention Required</span>
              <div className="p-2 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600">{(stats?.suspendedLandlords ?? 0) + (stats?.expiredLandlords ?? 0)}</div>
            <div className="text-xs text-slate-500 mt-2">
              {stats?.suspendedLandlords ?? 0} Suspended &bull; {stats?.expiredLandlords ?? 0} Expired
            </div>
          </div>
        </div>

        {/* Recent Landlords Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Recent Landlord Accounts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Recently provisioned landlord portal accounts</p>
            </div>
            <Link
              to="/superadmin/landlords"
              className="text-xs font-semibold text-slate-900 hover:text-amber-600 flex items-center gap-1"
            >
              <span>View All Landlords</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">Landlord</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Rooms / Tenants</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLandlords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No landlord records found.
                    </td>
                  </tr>
                ) : (
                  recentLandlords.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition-colors text-xs">
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {l.full_name}
                        <span className="text-[11px] text-slate-400 block font-normal">{l.property_name || 'DwellBase Property'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{l.email}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{l.subscription_plan}</td>
                      <td className="py-3.5 px-4 text-slate-600">{l.room_count} Rooms &bull; {l.tenant_count} Tenants</td>
                      <td className="py-3.5 px-4 text-slate-600">{l.subscription_end_date || 'N/A'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          (l.computedStatus || l.account_status) === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : (l.computedStatus || l.account_status) === 'Suspended'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {l.computedStatus || l.account_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
