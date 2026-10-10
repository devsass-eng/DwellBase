import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import { User, Shield, Bell, CreditCard, Building, Key, Info } from 'lucide-react';

const TenantSettings = () => {
  const { tenants, updateTenant, landlordProfile, landlordPaymentSettings } = useAppData();
  const { notify } = useNotifications();

  const myTenant = tenants.find(t => t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming');

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'payment_info'>('profile');

  const [profileForm, setProfileForm] = useState({
    fullName: myTenant?.fullName || '',
    phone: myTenant?.phone || '',
    email: myTenant?.email || '',
  });

  const [notifForm, setNotifForm] = useState({
    paymentConfirmations: myTenant?.notificationPreferences?.paymentConfirmations ?? true,
    manualMomo: myTenant?.notificationPreferences?.manualMomo ?? true,
    upcomingBills: myTenant?.notificationPreferences?.upcomingBills ?? true,
    overdueCharges: myTenant?.notificationPreferences?.overdueCharges ?? true,
    newRegulations: myTenant?.notificationPreferences?.newRegulations ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);

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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateTenant(myTenant.id, profileForm);
      setIsSaving(false);
      notify({ recipientType: 'tenant', recipientId: myTenant.id, title: 'Profile Updated', message: 'Your personal details have been updated securely.', type: 'success' });
    }, 600);
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateTenant(myTenant.id, { notificationPreferences: notifForm });
      setIsSaving(false);
      notify({ recipientType: 'tenant', recipientId: myTenant.id, title: 'Preferences Saved', message: 'Your notification preferences have been saved.', type: 'success' });
    }, 600);
  };

  return (
    <DashboardLayout userType="tenant" userName={myTenant.fullName} tenantId={myTenant.id}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-slate-500 mt-1">Manage your profile, security, and view landlord payment instructions.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="w-full lg:w-64 shrink-0 space-y-2">
            {[
              { id: 'profile', icon: User, label: 'Personal Profile' },
              { id: 'security', icon: Shield, label: 'Security' },
              { id: 'notifications', icon: Bell, label: 'Notifications' },
              { id: 'payment_info', icon: CreditCard, label: 'Payment Info' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-slate-600 hover:bg-gray-100 hover:text-slate-800'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            
            {/* ═══ PROFILE ═══════════════════════════════════════════════════════════ */}
            {activeTab === 'profile' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Personal Profile</h3>
                
                {/* Read-Only Tenancy Info */}
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Tenant ID</p>
                    <p className="font-medium text-slate-800">{myTenant.tenantId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Room Assignment</p>
                    <p className="font-medium text-slate-800">{myTenant.roomNumber}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Property</p>
                    <p className="font-medium text-slate-800 flex items-center gap-2">
                      <Building className="w-4 h-4 text-teal-600" /> {landlordProfile.propertyName}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input type="text" required value={profileForm.fullName} onChange={e => setProfileForm(f => ({ ...f, fullName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-xs text-amber-600 font-normal ml-2">(Verification Required)</span></label>
                    <input type="tel" required value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                    <p className="text-xs text-slate-400 mt-1.5">Changing your phone number requires verifying the new number via SMS before it becomes active for payment tracking.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input type="email" required value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  
                  <div className="pt-4 flex justify-end gap-3">
                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors">
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ═══ SECURITY ═══════════════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Security</h3>
                <form className="space-y-6 max-w-md" onSubmit={e => { e.preventDefault(); notify({ recipientType: 'tenant', recipientId: myTenant.id, title: 'Password Changed', message: 'Your password has been securely updated.', type: 'success' }); }}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="password" required className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="password" required className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="password" required className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors">
                      Update Password
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ═══ NOTIFICATIONS ═════════════════════════════════════════════════════ */}
            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Notifications</h3>
                <form onSubmit={handleSaveNotifications} className="space-y-6 max-w-2xl">
                  <div className="space-y-4">
                    {[
                      { key: 'paymentConfirmations', label: 'Payment Confirmations & Receipts', desc: 'Alerts when the landlord confirms your payment and issues a receipt.' },
                      { key: 'manualMomo', label: 'Manual Verification Updates', desc: 'Alerts regarding your pending MoMo submissions.' },
                      { key: 'upcomingBills', label: 'Upcoming Bills', desc: 'Alerts before a new charge is due.' },
                      { key: 'overdueCharges', label: 'Overdue Charges', desc: 'Alerts when you have an outstanding overdue balance.' },
                      { key: 'newRegulations', label: 'New Regulations', desc: 'Alerts when the landlord posts new property rules.' },
                    ].map(item => (
                      <label key={item.key} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                        <div className="pt-0.5">
                          <input 
                            type="checkbox" 
                            checked={notifForm[item.key as keyof typeof notifForm]} 
                            onChange={e => setNotifForm(f => ({ ...f, [item.key]: e.target.checked }))}
                            className="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 cursor-pointer"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{item.label}</p>
                          <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-start gap-2 mt-4">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    Essential security and account alerts cannot be disabled.
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors">
                      {isSaving ? 'Saving...' : 'Save Preferences'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ═══ PAYMENT INFO ═══════════════════════════════════════════════════════ */}
            {activeTab === 'payment_info' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Landlord Payment Instructions</h3>
                
                <div className="space-y-6 max-w-2xl text-sm">
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Property Manager</p>
                      <p className="font-bold text-slate-800">{landlordProfile.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact Phone</p>
                      <p className="font-medium text-slate-800">{landlordProfile.phone}</p>
                    </div>
                  </div>

                  {landlordPaymentSettings.momoNumber ? (
                    <div className="p-5 border border-teal-100 bg-teal-50/30 rounded-xl space-y-4">
                      <h4 className="font-bold text-teal-800 flex items-center gap-2">
                        <CreditCard className="w-5 h-5" /> Verified Mobile Money Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Network</p>
                          <p className="font-medium text-slate-800 capitalize">{landlordPaymentSettings.momoNetwork} Mobile Money</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Account Name</p>
                          <p className="font-medium text-slate-800">{landlordPaymentSettings.momoName}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 mb-1">MoMo Number</p>
                          <p className="font-black text-2xl text-slate-900 tracking-wider">{landlordPaymentSettings.momoNumber}</p>
                        </div>
                      </div>
                      
                      {landlordPaymentSettings.paymentInstructions && (
                        <div className="pt-4 border-t border-teal-100/50">
                          <p className="text-xs text-slate-500 mb-1">Instructions from Landlord</p>
                          <p className="font-medium text-slate-800 italic">"{landlordPaymentSettings.paymentInstructions}"</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5 border border-amber-200 bg-amber-50 rounded-xl">
                      <h4 className="font-bold text-amber-800">No Mobile Money Details Configured</h4>
                      <p className="text-amber-700 mt-1">Your landlord has not yet configured their Mobile Money details. Please contact them for payment instructions.</p>
                    </div>
                  )}

                  <div className="p-4 bg-navy-50 border border-navy-100 rounded-xl">
                    <p className="font-semibold text-navy-800">Automatic Checkout</p>
                    <p className="text-navy-700 mt-1">Automatic checkout via Hubtel/Paystack is currently <span className="font-bold">unavailable</span> for this property. Please use the Manual Mobile Money details provided above when paying your bills.</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TenantSettings;
