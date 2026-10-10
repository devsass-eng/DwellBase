import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, ArrowLeft, Loader2, Lock } from 'lucide-react';
import { auth, setToken } from '../api/client';

const SuperAdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.superAdminLogin(email.trim(), password);
      setToken(res.token);
      localStorage.setItem('dwellbase_role', 'super_admin');
      localStorage.setItem('dwellbase_user', JSON.stringify(res.superAdmin));
      localStorage.setItem('dwellbase_auth', JSON.stringify({ role: 'super_admin', email: email.trim() }));
      navigate('/superadmin/landlords');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid Super Admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row text-slate-100">
      {/* Left side brand */}
      <div className="hidden md:flex w-1/3 bg-slate-950 p-8 flex-col justify-between border-r border-slate-800">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-opacity">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">DwellBase</h1>
              <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">Platform Super Admin</span>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Restricted gateway for platform governance, landlord provisioning, and system audit supervision.
          </p>
        </div>
        <div className="text-xs text-slate-600">
          DwellBase Platform Security &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* Right side login form */}
      <div className="w-full md:w-2/3 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 p-8 rounded-2xl shadow-2xl backdrop-blur-sm">
          
          <div className="md:hidden flex items-center mb-8 justify-between">
            <Link to="/" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Shield className="w-5 h-5" />
              <span>Super Admin</span>
            </div>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Super Admin Sign In</h2>
            <p className="text-slate-400 text-sm mt-1">Authenticate to access landlord governance and system tools.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-start gap-3">
              <span className="font-semibold text-red-300">Error:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Super Admin Email
              </label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors outline-none text-sm"
                placeholder="superadmin@dwellbase.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors outline-none pr-10 text-sm"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center mt-2 disabled:opacity-70 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                'Access Super Admin Portal'
              )}
            </button>
          </form>

          {/* Demo Super Admin Box */}
          <div className="mt-6 p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-400">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Super Admin Demo Access
              </span>
              <button
                type="button"
                onClick={() => {
                  setEmail('superadmin@dwellbase.com');
                  setPassword('SuperAdmin@1234');
                  setError('');
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline text-xs"
              >
                Auto-fill
              </button>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-slate-300">
              <p><span className="text-slate-500">Email:</span> superadmin@dwellbase.com</p>
              <p><span className="text-slate-500">Password:</span> SuperAdmin@1234</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
