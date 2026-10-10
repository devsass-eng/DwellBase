import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Users, DoorOpen, DollarSign, AlertCircle, 
  Clock, PlusCircle, FileText, ArrowRight, Activity 
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
      <div className="mt-auto pt-4 border-t border-gray-50 text-sm text-slate-500">
        {subtitle}
      </div>
    )}
  </div>
);

const LandlordDashboard = () => {
  // Using empty real data for now per instructions (no fake data)
  const [data] = useState({
    totalTenants: 0,
    totalRooms: 0,
    occupiedRooms: 0,
    vacantRooms: 0,
    rentCollected: 0,
    outstandingBalance: 0,
    overdueBills: 0,
    upcomingDeadlines: 0,
    recentPayments: [],
    outstandingBills: [],
    recentActivity: []
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
      <DashboardLayout userType="landlord" userName="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  const isEmpty = data.totalRooms === 0;

  return (
    <DashboardLayout userType="landlord" userName="Sarah Landlord">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Welcome back, Sarah Landlord</h2>
          <p className="text-slate-500 mt-1">Here is an overview of your property and rent activity.</p>
        </div>

        {/* Empty State Help */}
        {isEmpty && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 flex items-start gap-4">
            <div className="p-3 bg-teal-100 rounded-full text-teal-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-teal-800">Your dashboard is ready</h3>
              <p className="text-teal-700 mt-1">Start by adding your first tenant or room to see your property overview.</p>
            </div>
          </div>
        )}

        {/* Dashboard Filters (Visual only for now) */}
        <div className="flex justify-end">
          <select className="bg-white border border-gray-200 text-slate-700 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block p-2.5 outline-none">
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Year</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Total Tenants" 
            value={data.totalTenants} 
            icon={Users} 
            colorClass="bg-blue-50 text-blue-600" 
          />
          <StatCard 
            title="Total Rooms" 
            value={data.totalRooms} 
            icon={DoorOpen} 
            colorClass="bg-indigo-50 text-indigo-600" 
            subtitle={
              <div className="flex justify-between w-full">
                <span>{data.occupiedRooms} Occupied</span>
                <span>{data.vacantRooms} Vacant</span>
              </div>
            }
          />
          <StatCard 
            title="Rent Collected" 
            value={`GH₵${data.rentCollected.toLocaleString()}`} 
            icon={DollarSign} 
            colorClass="bg-emerald-50 text-emerald-600" 
          />
          <StatCard 
            title="Outstanding Balance" 
            value={`GH₵${data.outstandingBalance.toLocaleString()}`} 
            icon={AlertCircle} 
            colorClass="bg-orange-50 text-orange-600" 
            subtitle={`${data.overdueBills} Overdue, ${data.upcomingDeadlines} Upcoming`}
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors text-sm font-medium">
              <PlusCircle className="w-4 h-4" /> Add Tenant
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <PlusCircle className="w-4 h-4" /> Add Room
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <FileText className="w-4 h-4" /> Create Bill
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors text-sm font-medium">
              <Clock className="w-4 h-4" /> View Payments
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">* Full management features coming in the next development stage.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payment Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">Recent Payment Activity</h3>
              <button className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center items-center text-center">
              {data.recentPayments.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <p className="text-slate-500">No payments recorded yet.</p>
                </>
              ) : (
                <div className="w-full text-left">
                  {/* Table goes here when data exists */}
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Bills Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">Outstanding Bills</h3>
              <button className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center items-center text-center">
              {data.outstandingBills.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-slate-500">No outstanding bills.</p>
                </>
              ) : (
                <div className="w-full text-left">
                   {/* Table goes here when data exists */}
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
