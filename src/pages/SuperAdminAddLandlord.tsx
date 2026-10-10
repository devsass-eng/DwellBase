import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, CheckCircle2, Copy, Check, AlertCircle, 
  CreditCard, DollarSign, Building2, Phone, Mail, 
  MapPin, ShieldCheck, ArrowRight, Sparkles, Loader2 
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi, auth } from '../api/client';

const SuperAdminAddLandlord = () => {
  const navigate = useNavigate();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [oneTimeFee, setOneTimeFee] = useState<number>(500);

  // One-time payment receipt section
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'direct_momo'>('cash');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [externalReference, setExternalReference] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [notes, setNotes] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    landlordName: string;
    landlordEmail: string;
    landlordCode?: string;
    accountStatus: string;
    paymentApproved: boolean;
    activationLink?: string;
    token?: string;
    expiresAt?: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await auth.getPublicSettings();
        if (settings.one_time_fee) {
          const fee = parseFloat(settings.one_time_fee);
          if (!isNaN(fee)) setOneTimeFee(fee);
        }
      } catch (err) {
        console.error('Failed to load platform settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim()) {
      setError('Full Name and Email Address are required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await superAdminApi.createLandlord({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        propertyName: propertyName.trim() || undefined,
        propertyAddress: propertyAddress.trim() || undefined,
        oneTimeFee: Number(oneTimeFee) || 500,
        paymentReceived,
        paymentMethod: paymentReceived ? paymentMethod : undefined,
        dateReceived: paymentReceived ? dateReceived : undefined,
        externalReference: paymentReceived && externalReference.trim() ? externalReference.trim() : undefined,
        receiptNumber: paymentReceived && receiptNumber.trim() ? receiptNumber.trim() : undefined,
        notes: notes.trim() || undefined,
        autoApprove: paymentReceived ? autoApprove : false,
      });

      setCreatedResult({
        landlordName: res.landlord.full_name,
        landlordEmail: res.landlord.email,
        landlordCode: res.landlord.landlord_code,
        accountStatus: res.landlord.account_status,
        paymentApproved: !!res.landlord.is_paid,
        activationLink: res.activation?.activationLink,
        token: res.activation?.token,
        expiresAt: res.activation?.expiresAt,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create landlord account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (createdResult?.activationLink) {
      navigator.clipboard.writeText(createdResult.activationLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleResetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPropertyName('');
    setPropertyAddress('');
    setPaymentReceived(false);
    setPaymentMethod('cash');
    setExternalReference('');
    setReceiptNumber('');
    setNotes('');
    setCreatedResult(null);
    setError(null);
  };

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-navy-900 text-teal-400 rounded-xl shadow-sm">
                <UserPlus className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Add New Landlord</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Create a landlord account manually after collecting their details and receiving their one-time access fee.
            </p>
          </div>
          <button
            onClick={() => navigate('/superadmin/landlords')}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            View All Landlords
          </button>
        </div>

        {/* Success Modal / Result View */}
        {createdResult && (
          <div className="bg-white rounded-2xl border-2 border-teal-500/30 p-6 md:p-8 shadow-xl space-y-6 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Landlord Created Successfully
                </div>
                <h2 className="text-xl font-bold text-slate-900">{createdResult.landlordName}</h2>
                <p className="text-sm text-slate-500">{createdResult.landlordEmail} {createdResult.landlordCode ? `• ID: ${createdResult.landlordCode}` : ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-sm">
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">Account Status</span>
                <p className="font-bold text-slate-800 mt-0.5">{createdResult.accountStatus}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase font-semibold">One-Time Payment</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {createdResult.paymentApproved ? 'Approved (Permanent Access Enabled)' : 'Pending Verification'}
                </p>
              </div>
            </div>

            {createdResult.activationLink ? (
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Secure Single-Use Activation Link
                  </span>
                  <span className="text-[11px] text-teal-700 font-medium">Valid for 72 hours</span>
                </div>
                <p className="text-xs text-slate-600">
                  Send this one-time link directly to the landlord. They will open it to set their private password and access their permanent workspace.
                </p>
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-teal-200 shadow-sm">
                  <input
                    type="text"
                    readOnly
                    value={createdResult.activationLink}
                    className="flex-1 bg-transparent text-xs text-slate-800 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      copiedLink 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-navy-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <strong>Pending Payment Verification:</strong> An activation link will be generated automatically as soon as you record and approve the landlord's one-time payment.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleResetForm}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Add Another Landlord
              </button>
              <button
                onClick={() => navigate('/superadmin/landlords')}
                className="px-5 py-2 text-sm font-bold text-white bg-navy-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                Go to Landlords List
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Creation Form */}
        {!createdResult && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Section 1: Landlord Profile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">1. Landlord Profile & Contact Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kwame Mensah"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. kwame@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. +233 24 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Property Name / Housing Block
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mensah Villa Apartments"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Property Address / Location
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Plot 14 Block B, East Legon, Accra"
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: One-Time Access Fee & Policy */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <DollarSign className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">2. One-Time Account Access Fee</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Access Fee Amount (GH₵)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={oneTimeFee}
                    onChange={(e) => setOneTimeFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-900"
                  />
                </div>
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-800">
                  <strong>Permanent Access Policy:</strong> This is a single, one-time payment. Once approved, the landlord will never be asked to pay renewal or subscription fees.
                </div>
              </div>
            </div>

            {/* Section 3: Payment Record Verification */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-teal-600" />
                  <h2 className="text-base font-bold text-slate-800">3. External Payment Verification</h2>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentReceived}
                    onChange={(e) => setPaymentReceived(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Payment Already Received Outside App</span>
                </label>
              </div>

              {paymentReceived ? (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'direct_momo')}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-900"
                      >
                        <option value="cash">Direct Cash Received</option>
                        <option value="direct_momo">Direct Mobile Money Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date Received
                      </label>
                      <input
                        type="date"
                        value={dateReceived}
                        onChange={(e) => setDateReceived(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        External Reference / MoMo Transaction ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2489201928"
                        value={externalReference}
                        onChange={(e) => setExternalReference(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Physical Receipt Number (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. RCP-2026-081"
                        value={receiptNumber}
                        onChange={(e) => setReceiptNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-900"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoApprove}
                        onChange={(e) => setAutoApprove(e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Approve payment now and generate instant activation link
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5 ml-6">
                      If unchecked, payment will be saved as "Pending Verification" and can be approved later.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  The landlord will be saved with <strong>Pending Payment</strong> status. You can record and approve their one-time cash or Mobile Money payment at any time from the Landlords or One-Time Payments page.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Administrative Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Met landlord in person at East Legon office. Approved after verifying GH₵500 MoMo payment to MTN wallet."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/superadmin/landlords')}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-bold text-white bg-navy-900 hover:bg-slate-800 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Landlord...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Landlord Account
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

export default SuperAdminAddLandlord;
