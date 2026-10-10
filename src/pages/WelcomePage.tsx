import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const WelcomePage = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 5000; // 5 seconds
    const intervalTime = 50; // Update every 50ms for smooth 60fps fill
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          navigate('/login');
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [navigate]);

  const handleProceed = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden selection:bg-teal-500 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Centered Content */}
      <div className="w-full max-w-lg text-center relative z-10 space-y-8 animate-fadeIn">
        {/* App Logo Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="bg-white/95 p-4 sm:p-5 rounded-3xl shadow-2xl border border-white/20 inline-flex items-center justify-center mb-6 backdrop-blur-md hover:scale-105 transition-transform duration-300">
            <img 
              src="/logo.svg" 
              alt="DwellBase Logo" 
              className="h-12 sm:h-14 object-contain"
            />
          </div>
        </div>

        {/* Text Content Below Logo */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <span>DwellBase</span>
            <Sparkles className="w-5 h-5 text-teal-400 shrink-0" />
          </h1>
          <p className="text-lg sm:text-xl font-medium text-teal-300">
            Property Management Made Simple.
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            Welcome to DwellBase. Sign in to access your administrative, landlord, or tenant workspace.
          </p>
        </div>

        {/* Button with 5s Left-to-Right Loading Progress */}
        <div className="pt-2 max-w-xs mx-auto">
          <button
            type="button"
            onClick={handleProceed}
            className="w-full relative overflow-hidden group py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-teal-500/40 text-white font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {/* Animated Loading Bar that fills from left to right over 5 seconds */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 opacity-90 transition-all duration-75 ease-linear pointer-events-none"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />

            {/* Button text overlay */}
            <span className="relative z-10 flex items-center justify-center gap-2 text-slate-950 font-extrabold drop-shadow-sm">
              <span>Continue to Sign In</span>
              <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          {/* Subtext countdown hint */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
            <span>Auto-entering in {Math.max(1, Math.ceil((5000 - (progress / 100) * 5000) / 1000))}s...</span>
            <button 
              onClick={handleProceed}
              className="text-teal-400 hover:underline cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Bottom Notice */}
      <div className="absolute bottom-6 text-center text-[11px] text-slate-400">
        DwellBase &bull; Multi-Tenant Property Platform
      </div>
    </div>
  );
};

export default WelcomePage;
