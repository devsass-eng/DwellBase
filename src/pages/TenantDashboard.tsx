import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData, useCurrentTenant } from '../context/AppDataContext';
import { formatReadableDate, formatGHS } from '../utils/reportUtils';
import { 
  AlertCircle, DollarSign, Calendar,
  ArrowRight, Home, CreditCard,
  CheckCircle2, Shield
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

const TenantDashboard = () => {
  const { charges, payments, landlordProfile, getTenantOutstandingBalance } = useAppData();

  // Scoped to active logged-in tenant
  const myTenant = useCurrentTenant();

  // Tenant's personal charges and payments
  const myCharges = useMemo(() => {
    if (!myTenant) return [];
    return charges.filter(c => c.tenantId === myTenant.id);
  }, [charges, myTenant]);

  const myPayments = useMemo(() => {
    if (!myTenant) return [];
    return payments.filter(p => p.tenantId === myTenant.id);
  }, [payments, myTenant]);

  const unpaidCharges = useMemo(() => {
    return myCharges.filter(c => c.status !== 'paid' && c.remainingBalance > 0);
  }, [myCharges]);

  const outstandingBalance = myTenant ? getTenantOutstandingBalance(myTenant.id) : 0;

  // Next due payment
  const nextPaymentDue = useMemo(() => {
    if (unpaidCharges.length === 0) return null;
    const sorted = [...unpaidCharges].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return sorted[0];
  }, [unpaidCharges]);

  // Last confirmed payment
  const lastConfirmedPayment = useMemo(() => {
    const confirmed = myPayments.filter(p => p.status === 'successful');
    if (confirmed.length === 0) return null;
    return [...confirmed].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
  }, [myPayments]);

  if (!myTenant) {
    return (
      <DashboardLayout userType="tenant" userName="Tenant Portal">
        <div className="max-w-4xl mx-auto py-16 text-center bg-white rounded-2xl border border-gray-100 p-8">
          <Shield className="w-16 h-16 text-teal-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Tenancy Found</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Your tenant login is not currently linked to an active tenancy. Please contact {landlordProfile.propertyName} for registration assistance.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userType="tenant" userName={myTenant.fullName} tenantId={myTenant.id}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
              Welcome back, {myTenant.fullName}
            </h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Resident in <strong>{myTenant.roomNumber}</strong> • {landlordProfile.propertyName}
            </p>
          </div>
          <Link
            to="/tenant/payments"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold text-sm transition-colors shadow-sm"
          >
            <CreditCard className="w-4 h-4" /> Pay Rent / Bills
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Outstanding Balance" 
            value={formatGHS(outstandingBalance)} 
            icon={AlertCircle} 
            colorClass="bg-amber-50 text-amber-600" 
            subtitle={
              outstandingBalance > 0 
                ? `${unpaidCharges.length} unpaid bill(s) pending`
                : 'All issued bills are completely settled!'
            }
          />
          <StatCard 
            title="Monthly Agreed Rent" 
            value={formatGHS(myTenant.monthlyRent)} 
            icon={Home} 
            colorClass="bg-blue-50 text-blue-600" 
            subtitle={`Contract: ${myTenant.durationMonths} months`}
          />
          <StatCard 
            title="Next Payment Due" 
            value={nextPaymentDue ? formatReadableDate(nextPaymentDue.dueDate) : 'None Due'} 
            icon={Calendar} 
            colorClass="bg-purple-50 text-purple-600" 
            subtitle={nextPaymentDue ? `${nextPaymentDue.categoryName} (${formatGHS(nextPaymentDue.remainingBalance)})` : 'Up to date'}
          />
          <StatCard 
            title="Last Confirmed Payment" 
            value={lastConfirmedPayment ? formatGHS(lastConfirmedPayment.amount) : 'GH₵0.00'} 
            icon={CheckCircle2} 
            colorClass="bg-emerald-50 text-emerald-600" 
            subtitle={lastConfirmedPayment ? `Paid on ${formatReadableDate(lastConfirmedPayment.paymentDate)}` : 'No payments yet'}
          />
        </div>

        {/* Tenancy Contract Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600">Active Tenancy Agreement</span>
            <h3 className="text-lg font-bold text-slate-800">Room {myTenant.roomNumber} ({myTenant.roomCode})</h3>
            <p className="text-xs text-slate-500">
              Valid from <strong>{formatReadableDate(myTenant.startDate)}</strong> to <strong>{formatReadableDate(myTenant.endDate)}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/tenant/regulations"
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-slate-700 text-xs font-semibold rounded-xl border border-gray-200 transition-colors"
            >
              Property Rules
            </Link>
            <Link
              to="/tenant/reports"
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Personal Statement
            </Link>
          </div>
        </div>

        {/* Bills & Payment Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unpaid Bills */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-slate-900 text-base">Bills Awaiting Payment</h3>
              <Link to="/tenant/payments" className="text-teal-600 hover:text-teal-700 text-xs font-bold flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-4 sm:p-6 flex-1">
              {unpaidCharges.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-medium">No outstanding bills at this time.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {unpaidCharges.map(c => (
                    <div key={c.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.categoryName}</p>
                        <p className="text-xs text-slate-400">
                          {c.billingPeriod} • Due {formatReadableDate(c.dueDate)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 text-sm">{formatGHS(c.remainingBalance)}</p>
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

          {/* Recent Payment History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-slate-900 text-base">Recent Payments</h3>
              <Link to="/tenant/reports" className="text-teal-600 hover:text-teal-700 text-xs font-bold flex items-center gap-1">
                Receipts <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-4 sm:p-6 flex-1">
              {myPayments.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No payment transactions recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myPayments.slice(0, 5).map(p => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{p.categoryName}</p>
                        <p className="text-xs text-slate-400">
                          {formatReadableDate(p.paymentDate)} • Ref: {p.referenceNumber}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-600 text-sm">{formatGHS(p.amount)}</p>
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          p.status === 'successful' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
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
        </div>

      </div>
    </DashboardLayout>
  );
};

export default TenantDashboard;
