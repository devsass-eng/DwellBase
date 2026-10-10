import { Link } from 'react-router-dom';
import { User, ShieldCheck } from 'lucide-react';

const WelcomePage = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Left Column: Brand & Info */}
      <div className="w-full md:w-1/2 bg-navy-900 text-white p-8 md:p-16 flex flex-col justify-center">
        <div className="flex items-center mb-8">
          <img src="/logo.svg" alt="DwellBase" className="h-12 object-contain" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          Welcome to DwellBase
        </h1>
        <h2 className="text-xl md:text-2xl text-teal-400 font-medium mb-6">
          Property Management Made Simple.
        </h2>
        <p className="text-navy-200 text-lg max-w-md mb-12">
          Manage your property, tenants, rent, and payments in one simple place.
        </p>

        {/* Abstract Illustration representation */}
        <div className="hidden md:flex justify-center items-center opacity-80 mt-auto">
           <svg width="300" height="200" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="80" width="200" height="120" rx="4" fill="#1e3a5f" />
            <polygon points="150,20 270,80 30,80" fill="#2cb1bc" />
            <rect x="130" y="140" width="40" height="60" fill="#38b2ac" />
            <rect x="80" y="100" width="30" height="30" fill="#e2e8f0" opacity="0.3" />
            <rect x="190" y="100" width="30" height="30" fill="#e2e8f0" opacity="0.3" />
          </svg>
        </div>
      </div>

      {/* Right Column: Login Options */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Access Your Account</h2>
            <p className="text-slate-500">Choose your account type to continue.</p>
          </div>

          <div className="space-y-6">
            {/* Admin Login Option */}
            <Link 
              to="/admin-login"
              className="block p-6 rounded-xl border border-gray-200 hover:border-teal-500 hover:shadow-lg transition-all duration-300 group bg-white"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-navy-50 rounded-lg group-hover:bg-navy-900 transition-colors">
                  <ShieldCheck className="w-8 h-8 text-navy-700 group-hover:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-1 group-hover:text-navy-700">Admin Login</h3>
                  <p className="text-slate-500 text-sm">For authorized landlords and property managers.</p>
                </div>
              </div>
            </Link>

            {/* Tenant Login Option */}
            <Link 
              to="/tenant-login"
              className="block p-6 rounded-xl border border-gray-200 hover:border-teal-500 hover:shadow-lg transition-all duration-300 group bg-white"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-50 rounded-lg group-hover:bg-teal-500 transition-colors">
                  <User className="w-8 h-8 text-teal-600 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-1 group-hover:text-teal-600">Tenant Login</h3>
                  <p className="text-slate-500 text-sm">For tenants who want to view their rent, bills, and payment history.</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
