import { useState, useEffect } from 'react';
import { 
  ShieldCheck, DollarSign, Building2, Phone, Mail, 
  Smartphone, Check, AlertCircle, Loader2,
  Save
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';

const SuperAdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [oneTimeFee, setOneTimeFee] = useState('500.00');
  const [platformName, setPlatformName] = useState('DwellBase');
  const [tagline, setTagline] = useState('Property Management Made Simple.');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMomoNumber, setContactMomoNumber] = useState('');
  const [contactMomoName, setContactMomoName] = useState('');
  const [contactInstructions, setContactInstructions] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await superAdminApi.getSettings();
        if (data.one_time_fee) setOneTimeFee(data.one_time_fee);
        if (data.platform_name) setPlatformName(data.platform_name);
        if (data.tagline) setTagline(data.tagline);
        if (data.contact_phone) setContactPhone(data.contact_phone);
        if (data.contact_email) setContactEmail(data.contact_email);
        if (data.contact_momo_number) setContactMomoNumber(data.contact_momo_number);
        if (data.contact_momo_name) setContactMomoName(data.contact_momo_name);
        if (data.contact_instructions) setContactInstructions(data.contact_instructions);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    try {
      setSaving(true);
      await superAdminApi.updateSettings({
        one_time_fee: String(oneTimeFee),
        platform_name: platformName.trim(),
        tagline: tagline.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        contact_momo_number: contactMomoNumber.trim(),
        contact_momo_name: contactMomoName.trim(),
        contact_instructions: contactInstructions.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout userType="super_admin" userName="Admin">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-navy-900 text-teal-400 rounded-xl shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Platform Configuration & Settings</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Configure platform fees, official contact details, Mobile Money payment numbers, and security policies.
          </p>
        </div>

        {saved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            Platform settings saved and applied across public pages and onboarding flows.
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium">Loading settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Section 1: One-Time Access Fee */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <DollarSign className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">1. One-Time Account Access Fee</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Landlord Access Fee (GH₵)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={oneTimeFee}
                    onChange={(e) => setOneTimeFee(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>
                <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-800">
                  <strong>Fee Policy:</strong> Changing this fee applies to future landlord registrations. It does not alter past recorded payments or demand additional fees from existing landlords.
                </div>
              </div>
            </div>

            {/* Section 2: Platform Identity */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">2. Platform Identity & Branding</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platform Name
                  </label>
                  <input
                    type="text"
                    required
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Official Admin Contact & MoMo */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Phone className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">3. Official Contact & Mobile Money Details</h2>
              </div>
              <p className="text-xs text-slate-500">
                These contact details are shown on the public landing page for new landlords inquiring about registration and offline payment.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. +233 24 000 0000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="e.g. admin@dwellbase.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Direct Mobile Money Number
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. 024 123 4567 (MTN MoMo)"
                      value={contactMomoNumber}
                      onChange={(e) => setContactMomoNumber(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Money Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DwellBase Admin"
                    value={contactMomoName}
                    onChange={(e) => setContactMomoName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Public Contact & Payment Instructions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Contact the platform administrator directly via phone or WhatsApp to arrange your one-time payment. After verification, your account will be activated immediately."
                    value={contactInstructions}
                    onChange={(e) => setContactInstructions(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>
              </div>
            </div>

            {/* Save Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-sm font-bold text-white bg-navy-900 hover:bg-slate-800 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminSettings;
