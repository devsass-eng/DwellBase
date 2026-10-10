import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import { Shield, Bell, Smartphone, CreditCard, Building, Key, Palette } from 'lucide-react';

const AdminSettings = () => {
  const { 
    landlordProfile, updateLandlordProfile,
    landlordPaymentSettings, updateLandlordPaymentSettings,
    landlordNotificationPrefs, updateLandlordNotificationPrefs 
  } = useAppData();
  const { notify } = useNotifications();

  const [activeTab, setActiveTab] = useState<'profile' | 'payment' | 'security' | 'notifications' | 'preferences'>('profile');

  // Form states
  const [profileForm, setProfileForm] = useState(landlordProfile);
  const [paymentForm, setPaymentForm] = useState(landlordPaymentSettings);
  const [notifForm, setNotifForm] = useState(landlordNotificationPrefs);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateLandlordProfile(profileForm);
      setIsSaving(false);
      notify({ recipientType: 'landlord', title: 'Profile Updated', message: 'Your landlord and property details have been saved.', type: 'success' });
    }, 600);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateLandlordPaymentSettings(paymentForm);
      setIsSaving(false);
      notify({ recipientType: 'landlord', title: 'Payment Settings Updated', message: 'Your manual Mobile Money configuration has been saved.', type: 'success' });
    }, 600);
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateLandlordNotificationPrefs(notifForm);
      setIsSaving(false);
      notify({ recipientType: 'landlord', title: 'Notifications Updated', message: 'Your notification preferences have been saved.', type: 'success' });
    }, 600);
  };

  return (
    <DashboardLayout userType="landlord" userName={landlordProfile.fullName}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-slate-500 mt-1">Manage your account, property identity, payments, and security.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="w-full lg:w-64 shrink-0 space-y-2">
            {[
              { id: 'profile', icon: Building, label: 'Profile & Property' },
              { id: 'payment', icon: CreditCard, label: 'Payment Settings' },
              { id: 'security', icon: Shield, label: 'Security' },
              { id: 'notifications', icon: Bell, label: 'Notifications' },
              { id: 'preferences', icon: Palette, label: 'App Preferences' },
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
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Landlord & Property Profile</h3>
                <form onSubmit={handleSaveProfile} className="space-y-6 max-w-2xl">
                  
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Personal Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input type="text" required value={profileForm.fullName} onChange={e => setProfileForm(f => ({ ...f, fullName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <input type="tel" required value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input type="email" required value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Property Identity</h4>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Property Name</label>
                      <input type="text" required value={profileForm.propertyName} onChange={e => setProfileForm(f => ({ ...f, propertyName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                      <p className="text-xs text-slate-500 mt-1.5">This name will appear on tenant portals and official payment receipts.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Property Address</label>
                      <input type="text" value={profileForm.propertyAddress} onChange={e => setProfileForm(f => ({ ...f, propertyAddress: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end gap-3">
                    <button type="button" onClick={() => setProfileForm(landlordProfile)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors">
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ═══ PAYMENT ═══════════════════════════════════════════════════════════ */}
            {activeTab === 'payment' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Payment Settings</h3>
                
                <div className="space-y-8 max-w-2xl">
                  {/* Automatic Checkout config note */}
                  <div className="p-5 bg-navy-50 border border-navy-100 rounded-xl">
                    <h4 className="font-bold text-navy-900 flex items-center gap-2"><Smartphone className="w-5 h-5" /> Automatic MoMo Checkout</h4>
                    <p className="text-sm text-navy-700 mt-2">DwellBase supports automatic checkout via Hubtel or Paystack. <strong>A trusted server integration is required</strong> to verify these transactions automatically. Currently, you are using the <span className="font-semibold text-navy-800">Manual Verification Workflow</span> below.</p>
                  </div>

                  <form onSubmit={handleSavePayment} className="space-y-5">
                    <div>
                      <h4 className="font-bold text-slate-800">Manual Mobile Money Details</h4>
                      <p className="text-sm text-slate-500 mt-1 mb-4">Provide the account details tenants should use to send rent. Tenants will upload their transaction reference for you to confirm manually.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Money Network</label>
                        <select required value={paymentForm.momoNetwork} onChange={e => setPaymentForm(f => ({ ...f, momoNetwork: e.target.value as any }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                          <option value="">Select Network</option>
                          <option value="mtn">MTN Mobile Money</option>
                          <option value="telecel">Telecel Cash</option>
                          <option value="at">AT Money</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                        <input type="text" required value={paymentForm.momoName} onChange={e => setPaymentForm(f => ({ ...f, momoName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. Adam Alhassan" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Money Number</label>
                        <input type="tel" required value={paymentForm.momoNumber} onChange={e => setPaymentForm(f => ({ ...f, momoNumber: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. 0540000000" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Instructions to Tenants</label>
                        <textarea value={paymentForm.paymentInstructions} onChange={e => setPaymentForm(f => ({ ...f, paymentInstructions: e.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none resize-none" placeholder="Add any special instructions (e.g. 'Use your room number as the reference')." />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                      <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors">
                        {isSaving ? 'Saving...' : 'Save Payment Details'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ═══ SECURITY ═══════════════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">Security</h3>
                <form className="space-y-6 max-w-md" onSubmit={e => { e.preventDefault(); notify({ recipientType: 'landlord', title: 'Password Changed', message: 'Your password has been securely updated.', type: 'success' }); }}>
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
                      { key: 'newTenant', label: 'New Tenant Activity', desc: 'Alerts when tenants sign up or accept invitations.' },
                      { key: 'manualMomo', label: 'Manual MoMo Submissions', desc: 'Alerts when a tenant submits a manual MoMo payment awaiting verification.' },
                      { key: 'confirmedPayment', label: 'Confirmed & Rejected Payments', desc: 'Alerts for payment status changes and successful cash recordings.' },
                      { key: 'upcomingCharges', label: 'Upcoming Charges', desc: 'Alerts before bills are due.' },
                      { key: 'overdueCharges', label: 'Overdue Charges', desc: 'Alerts when a charge becomes overdue.' },
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

                  <div className="pt-4 flex justify-end gap-3">
                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors">
                      {isSaving ? 'Saving...' : 'Save Preferences'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ═══ PREFERENCES ════════════════════════════════════════════════════════ */}
            {activeTab === 'preferences' && (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4">App Preferences</h3>
                <div className="max-w-md space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                    <select disabled className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-slate-500 outline-none">
                      <option>Ghanaian Cedi (GH₵)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Currency is locked for this deployment.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date Format</label>
                    <select className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div className="pt-2">
                    <button type="button" onClick={() => notify({ recipientType: 'landlord', title: 'Preferences Saved', message: 'Your app preferences have been updated.', type: 'success' })} className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
                      Save Preferences
                    </button>
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

export default AdminSettings;
