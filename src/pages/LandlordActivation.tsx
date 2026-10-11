import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { auth, setSession } from '../api/client';

const LandlordActivation = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [landlordInfo, setLandlordInfo] = useState<{ id: string; fullName: string; email: string; propertyName: string } | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError('No activation token provided. Please use the link provided by the platform owner.');
      return;
    }

    auth.verifyActivationToken(token)
      .then(res => {
        setLandlordInfo(res.landlord);
      })
      .catch(err => {
        setVerifyError(err instanceof Error ? err.message : 'Invalid or expired activation link.');
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await auth.completeActivation(token, password);
      setSession('landlord', res.token, res.landlord, { role: 'landlord', email: res.landlord?.email });

      setActivatedSuccess(true);
      setTimeout(() => {
        navigate('/landlord/dashboard');
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to activate account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Activate Landlord Account</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Permanent workspace access on DwellBase
          </p>
        </div>

        {verifying ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-400" />
            <p className="text-sm">Verifying your secure activation token...</p>
          </div>
        ) : verifyError ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs sm:text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold text-red-300">Activation Error</strong>
                <p className="mt-1">{verifyError}</p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold"
              >
                <span>Return to Home Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : activatedSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Account Activated!</h3>
            <p className="text-xs text-slate-400">
              Redirecting you to your private landlord dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleActivateSubmit} className="space-y-4">
            {/* Landlord Info Box */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Landlord Name:</span>
                <span className="font-semibold text-white">{landlordInfo?.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Email:</span>
                <span className="font-medium text-slate-300">{landlordInfo?.email}</span>
              </div>
              {landlordInfo?.propertyName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Property:</span>
                  <span className="font-medium text-teal-400">{landlordInfo.propertyName}</span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {submitError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Create Account Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-[11px] text-teal-300 leading-relaxed">
              <strong>Permanent Workspace:</strong> Setting your password will activate your account immediately with permanent access.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-500/20 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Activating Workspace...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Activate Permanent Access</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default LandlordActivation;
