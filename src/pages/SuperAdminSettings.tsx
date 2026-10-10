import { useState } from 'react';
import { ShieldCheck, Lock, User, Check, AlertCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const SuperAdminSettings = () => {
  const [saved, setSaved] = useState(false);

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="max-w-3xl space-y-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-amber-400 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Super Admin Settings</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Manage your Super Admin credentials and platform security parameters.
          </p>
        </div>

        {saved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" />
            Settings saved successfully.
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            Super Administrator Account
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                readOnly
                value="System Super Administrator"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Super Admin Email</label>
              <input
                type="email"
                readOnly
                value="superadmin@dwellbase.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <strong>Security Governance:</strong> Super Admin accounts are private and isolated from all landlord data. Platform modifications and status changes are permanently logged to the audit repository.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminSettings;
