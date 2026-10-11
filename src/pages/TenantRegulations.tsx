import DashboardLayout from '../components/DashboardLayout';
import { useAppData, useCurrentTenant } from '../context/AppDataContext';
import { ClipboardList, Shield } from 'lucide-react';

const TenantRegulations = () => {
  const { regulations } = useAppData();
  const myTenant = useCurrentTenant();

  if (!myTenant) {
    return (
      <DashboardLayout userType="tenant" userName="Tenant">
        <div className="max-w-2xl mx-auto py-16 text-center">
          <Shield className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Tenancy Found</h2>
          <p className="text-slate-500">Your tenant account is not yet linked to an active tenancy. Please contact your landlord.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Reverse the array to show oldest first or keep newest first (currently newest first based on addRegulation)
  // According to standard lists, chronological order might be expected, but we'll stick to the array order (newest first).
  // Actually let's flip it so Regulation 1 is at the top if we want chronological, but newest-first is also fine.
  // Let's just display them in the order they are stored (newest first).

  return (
    <DashboardLayout userType="tenant" userName={myTenant.fullName} tenantId={myTenant.id}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Property Regulations</h2>
          <p className="text-slate-500 mt-1">Please review the rules and regulations for this property.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <ClipboardList className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-800">Regulations</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {regulations.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p>No regulations have been posted yet.</p>
              </div>
            ) : (
              regulations.map((reg, index) => (
                <div key={reg.id} className="p-5 flex gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
                    {regulations.length - index}
                  </div>
                  <div>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{reg.text}</p>
                    <p className="text-xs text-slate-400 mt-3">
                      Posted on {new Date(reg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TenantRegulations;
