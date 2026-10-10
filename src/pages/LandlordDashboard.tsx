import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import { formatReadableDate, formatGHS, getDatePresetRange } from '../utils/reportUtils';
import { 
  Users, DoorOpen, DollarSign, AlertCircle, 
  Clock, PlusCircle, FileText, ArrowRight, Activity,
  CheckCircle2, Banknote, Phone
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: {
  title: string; value: string | number; icon: React.ElementType; colorClass: string; subtitle?: React.ReactNode;
}) => (
  <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    {subtitle && (
      <div className="mt-auto pt-3 border-t border-gray-50 text-xs text-slate-500 font-medium">
        {subtitle}
      </div>
    )}
  </div>
);

const LandlordDashboard = () => {
  const { rooms, tenants, charges, payments, landlordProfile } = useAppData();
  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'last_month' | 'this_year' | 'all'>('this_month');

  // Compute date range for filter
  const { startDate, endDate } = useMemo(() => {
    return getDatePresetRange(periodFilter);
  }, [periodFilter]);

  // Active rooms & counts
  const activeRooms = useMemo(() => rooms.filter(r => !r.archived), [rooms]);
  const occupiedRoomsCount = useMemo(() => activeRooms.filter(r => r.status === 'Occupied').length, [activeRooms]);
  const vacantRoomsCount = useMemo(() => activeRooms.filter(r => r.status === 'Vacant').length, [activeRooms]);

  // Active tenants
  const activeTenants = useMemo(() => {
    return tenants.filter(t => t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming');
  }, [tenants]);

  // Filtered payments by selected period
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (!startDate && !endDate) return true;
      const d = p.paymentDate.split('T')[0];
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }, [payments, startDate, endDate]);

  // Confirmed rent collections
  const rentCollected = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'successful')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  // Outstanding charges & status counts
  const unpaidCharges = useMemo(() => {
    return charges.filter(c => c.status !== 'paid' && c.remainingBalance > 0);
  }, [charges]);

  const outstandingBalance = useMemo(() => {
    return unpaidCharges.reduce((sum, c) => sum + c.remainingBalance, 0);
  }, [unpaidCharges]);

  const overdueBillsCount = useMemo(() => {
    return charges.filter(c => c.status === 'overdue').length;
  }, [charges]);

  const upcomingBillsCount = useMemo(() => {
    return charges.filter(c => c.status === 'upcoming' || c.status === 'pending').length;
  }, [charges]);

  // Recent payments (last 5)
  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => new Date(b.createdAt || b.paymentDate).getTime() - new Date(a.createdAt || a.paymentDate).getTime())
      .slice(0, 5);
  }, [payments]);

  // Outstanding bills (top 5 sorted by due date)
  const topOutstandingBills = useMemo(() => {
    return [...unpaidCharges]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [unpaidCharges]);

  const isEmpty = activeRooms.length === 0 && activeTenants.length === 0;

  return (
    <DashboardLayout userType="landlord" userName={landlordProfile.fullName}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
              Welcome back, {landlordProfile.fullName}
            </h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Property Overview for <strong>{landlordProfile.propertyName}</strong>
            </p>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Period:</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="bg-white border border-gray-200 text-slate-700 text-xs font-semibold rounded-xl focus:ring-2 focus:ring-teal-500 block p-2.5 outline-none shadow-sm"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Empty State Help */}
        {isEmpty && (
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-3 bg-teal-100 rounded-xl text-teal-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-teal-900">Your property management dashboard is ready</h3>
              <p className="text-teal-700 text-sm mt-1">
                Start by creating your first room or adding a tenant to unlock live financial tracking and automated billing.
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Total Active Tenants" 
            value={activeTenants.length} 
            icon={Users} 
            colorClass="bg-blue-50 text-blue-600" 
            subtitle={`${tenants.filter(t => t.tenancyStatus === 'Ended').length} historical records preserved`}
          />
          <StatCard 
            title="Total Rooms" 
            value={activeRooms.length} 
            icon={DoorOpen} 
            colorClass="bg-indigo-50 text-indigo-600" 
            subtitle={
              <div className="flex justify-between w-full">
                <span>{occupiedRoomsCount} Occupied</span>
                <span>{vacantRoomsCount} Vacant</span>
              </div>
            }
          />
          <StatCard 
            title="Collections" 
            value={formatGHS(rentCollected)} 
            icon={DollarSign} 
            colorClass="bg-emerald-50 text-emerald-600" 
            subtitle="Confirmed payments in selected period"
          />
          <StatCard 
            title="Outstanding Balance" 
            value={formatGHS(outstandingBalance)} 
            icon={AlertCircle} 
            colorClass="bg-amber-50 text-amber-600" 
            subtitle={`${overdueBillsCount} Overdue, ${upcomingBillsCount} Pending/Upcoming`}
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Quick Management Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link 
              to="/landlord/tenants"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-colors text-sm font-semibold shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-teal-400" /> Manage Tenants
            </Link>
            <Link 
              to="/landlord/rooms"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-slate-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold shadow-sm"
            >
              <DoorOpen className="w-4 h-4 text-slate-500" /> Manage Rooms
            </Link>
            <Link 
              to="/landlord/payments"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-slate-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-500" /> Issue Charge / Record Cash
            </Link>
            <Link 
              to="/landlord/reports"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 rounded-xl hover:bg-teal-100 transition-colors text-sm font-semibold border border-teal-200"
            >
              <Clock className="w-4 h-4" /> Comprehensive Reports
            </Link>
          </div>
        </div>

        {/* Recent Activity and Outstanding Bills Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payment Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-slate-900 text-base">Recent Payment Activity</h3>
              <Link to="/landlord/payments" className="text-teal-600 hover:text-teal-700 text-xs font-bold flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-4 sm:p-6 flex-1">
              {recentPayments.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No payment transactions recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentPayments.map(p => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${p.paymentMethod === 'cash' ? 'bg-navy-50 text-navy-800' : 'bg-yellow-50 text-yellow-700'}`}>
                          {p.paymentMethod === 'cash' ? <Banknote className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{p.tenantName}</p>
                          <p className="text-xs text-slate-400">
                            Room {p.roomNumber} • {p.categoryName} • {formatReadableDate(p.paymentDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 text-sm">{formatGHS(p.amount)}</p>
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          p.status === 'successful' ? 'bg-emerald-50 text-emerald-700' :
                          p.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-100 text-slate-600'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Bills Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-slate-900 text-base">Top Outstanding Bills</h3>
              <Link to="/landlord/payments" className="text-teal-600 hover:text-teal-700 text-xs font-bold flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-4 sm:p-6 flex-1">
              {topOutstandingBills.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-medium">All issued charges are completely paid up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {topOutstandingBills.map(c => (
                    <div key={c.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.tenantName}</p>
                        <p className="text-xs text-slate-400">
                          {c.categoryName} ({c.billingPeriod}) • Due {formatReadableDate(c.dueDate)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-rose-600 text-sm">{formatGHS(c.remainingBalance)}</p>
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          c.status === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default LandlordDashboard;
