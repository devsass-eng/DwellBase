import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, Building2, User, Eye, EyeOff, 
  ArrowLeft, Loader2, Lock, Mail
} from 'lucide-react';
import { auth, setSession } from '../api/client';

type RoleTab = 'admin' | 'landlord' | 'tenant';

const UnifiedLogin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialTab = (): RoleTab => {
    if (location.pathname === '/superadmin-login') return 'admin';
    if (location.pathname === '/admin-login') return 'landlord';
    if (location.pathname === '/tenant-login') return 'tenant';
    const roleParam = searchParams.get('role') as RoleTab;
    if (roleParam && ['admin', 'landlord', 'tenant'].includes(roleParam)) {
      return roleParam;
    }
    return 'admin';
  };

  const [activeTab, setActiveTab] = useState<RoleTab>(getInitialTab());

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Synchronize URL search params when tab changes
  const handleTabChange = (role: RoleTab) => {
    setActiveTab(role);
    setSearchParams({ role });
    setError('');
    setPassword('');
  };

  useEffect(() => {
    const tab = getInitialTab();
    if (tab !== activeTab) {
      setActiveTab(tab);
      setError('');
    }
  }, [location.pathname, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedId = identifier.trim();
    if (!trimmedId || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'admin') {
        // Super Admin (Admin) Login
        const res = await auth.superAdminLogin(trimmedId.toLowerCase(), password);
        setSession('super_admin', res.token, res.superAdmin, { role: 'super_admin', email: trimmedId });
        navigate('/superadmin/dashboard');
      } else if (activeTab === 'landlord') {
        // Landlord Login
        const res = await auth.landlordLogin(trimmedId.toLowerCase(), password);
        
        // If the user entered admin credentials while on landlord tab, seamlessly route them
        if (res.role === 'super_admin' || res.superAdmin) {
          setSession('super_admin', res.token, res.superAdmin, { role: 'super_admin', email: trimmedId });
          navigate('/superadmin/dashboard');
        } else {
          setSession('landlord', res.token, res.landlord, { role: 'landlord', email: trimmedId });
          navigate('/landlord/dashboard');
        }
      } else {
        // Tenant Login
        const res = await auth.tenantLogin(trimmedId, password.trim());
        setSession('tenant', res.token, res.tenant, { role: 'tenant', identifier: trimmedId });
        navigate('/tenant/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      if (msg.includes('revoked') || msg.includes('Suspended')) {
        setError('Your login access has been suspended or restricted. Please contact property administration.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-teal-500 selection:text-white">
      {/* Back button */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <img src="/logo.svg" alt="DwellBase" className="h-9 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign In</h1>
          <p className="text-xs text-slate-500">Access your DwellBase workspace</p>
        </div>

        {/* 3-Way Role Switcher Tab */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-100 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('landlord')}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'landlord'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Landlord</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('tenant')}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tenant'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Tenant</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 animate-fadeIn">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {activeTab === 'tenant' ? 'Tenant ID, Phone Number, or Email' : 'Email Address'}
            </label>
            <div className="relative">
              {activeTab === 'tenant' ? (
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              ) : (
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              )}
              <input
                type={activeTab === 'tenant' ? 'text' : 'email'}
                required
                placeholder={
                  activeTab === 'admin'
                    ? 'superadmin@dwellbase.com'
                    : activeTab === 'landlord'
                    ? 'admin@dwellbase.com'
                    : 'e.g. TENT-01 or 0241234567'
                }
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-navy-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In as {activeTab === 'admin' ? 'Admin' : activeTab === 'landlord' ? 'Landlord' : 'Tenant'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UnifiedLogin;
