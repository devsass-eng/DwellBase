import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, ArrowLeft, Loader2 } from 'lucide-react';

const TenantLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!identifier || !password) {
      setError('Please enter your Tenant ID or email and password.');
      return;
    }
    
    setLoading(true);
    
    // Simulate authentication
    setTimeout(() => {
      setLoading(false);
      if (identifier === 'tenant@dwellbase.com' && password === 'password') {
         navigate('/tenant/dashboard');
      } else {
         setError('Invalid credentials. (Hint: use tenant@dwellbase.com / password)');
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Left side minimal brand */}
      <div className="hidden md:flex w-1/3 bg-teal-600 p-8 flex-col justify-between text-white">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Welcome</span>
        </Link>
        <div>
          <div className="flex items-center mb-4">
            <img src="/logo.svg" alt="DwellBase" className="h-10 object-contain" />
          </div>
          <p className="text-teal-100">Property Management Made Simple.</p>
        </div>
      </div>

      {/* Right side form */}
      <div className="w-full md:w-2/3 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          
          <div className="md:hidden flex items-center mb-8 text-navy-900">
            <Link to="/" className="text-slate-400 hover:text-slate-600 mr-auto">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <img src="/logo.svg" alt="DwellBase" className="h-8 object-contain" />
          </div>

          <div className="mb-8 text-center md:text-left">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-600 mb-4">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Tenant Login</h2>
            <p className="text-slate-500 mt-1">Sign in to view your rent and bills.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tenant ID or Email</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none"
                placeholder="tenant@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <a href="#" className="text-sm text-teal-600 hover:text-teal-700 font-medium">Forgot Password?</a>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center mt-2 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TenantLogin;
