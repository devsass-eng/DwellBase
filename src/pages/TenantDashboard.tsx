import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { 
  AlertCircle, DollarSign, Calendar, Clock,
  FileText, ArrowRight, Home, CreditCard
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
  <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl sm:text-3xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    {subtitle && (
      <div className="mt-auto pt-4 border-t border-gray-50 text-sm text-slate-500 font-medium">
        {subtitle}
      </div>
    )}
  </div>
);

const TenantDashboard = () => {
  // Using empty real data for now per instructions
  const [data] = useState<any>({
    outstandingBalance: 0,
    monthlyRent: 0,
    nextPaymentDue: null,
    lastConfirmedPayment: null,
    tenancyInfo: null, // no tenancy recorded yet
    outstandingBills: [],
    recentHistory: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return (
      <DashboardLayout userType="tenant" userName="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  const noTenancy = !data.tenancyInfo;

  return (
    <DashboardLayout userType="tenant" userName="John Doe">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Welcome back, John Doe</h2>
          <p className="text-slate-500 mt-1">Here is an overview of your rent, bills, and payments.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Outstanding Balance" 
            value={`GH₵${data.outstandingBalance.toLocaleString()}`} 
            icon={AlertCircle} 
            colorClass={data.outstandingBalance > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} 
          />
          <StatCard 
            title="Monthly Rent" 
            value={`GH₵${data.monthlyRent.toLocaleString()}`} 
            icon={DollarSign} 
            colorClass="bg-blue-50 text-blue-600" 
          />
          <StatCard 
            title="Next Payment Due" 
            value={data.nextPaymentDue ? data.nextPaymentDue : "No upcoming"} 
            icon={Calendar} 
            colorClass="bg-indigo-50 text-indigo-600" 
          />
          <StatCard 
            title="Last Confirmed Payment" 
            value={data.lastConfirmedPayment ? data.lastConfirmedPayment.amount : "No payments"} 
            icon={Clock} 
            colorClass="bg-teal-50 text-teal-600" 
            subtitle={data.lastConfirmedPayment ? data.lastConfirmedPayment.date : "Yet to record a payment"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Outstanding Bills */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-800">Outstanding Bills</h3>
              </div>
              <div className="p-6 text-center">
                {data.outstandingBills.length === 0 ? (
                  <div className="py-8">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mx-auto mb-3">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 font-medium">You have no outstanding bills.</p>
                  </div>
                ) : (
                  <div className="text-left">
                    {/* Bills Table */}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Payment History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-800">Recent Payment History</h3>
                <button className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1">
                  View All <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 text-center">
                {data.recentHistory.length === 0 ? (
                  <div className="py-8">
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mx-auto mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 font-medium">No payment history yet.</p>
                  </div>
                ) : (
                  <div className="text-left">
                    {/* History Table */}
                  </div>
                )}
              </div>
            </div>
            
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            
            {/* Tenancy Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-slate-800">Tenancy Information</h3>
              </div>
              <div className="p-5 sm:p-6">
                {noTenancy ? (
                  <div className="text-center py-4">
                    <Home className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Your landlord has not yet assigned a room or rent amount to your account.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                     {/* Tenancy details */}
                  </div>
                )}
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-slate-800">Notifications</h3>
              </div>
              <div className="p-5 sm:p-6">
                {data.notifications.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center">You have no new notifications.</p>
                ) : (
                  <div className="space-y-3">
                     {/* Notifications list */}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default TenantDashboard;
