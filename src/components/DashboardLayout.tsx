import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, DoorOpen, 
  CreditCard, FileText, Settings, LogOut, 
  Menu, X, Bell, Cloud, User as UserIcon, CheckCheck,
  ClipboardList, Building2, ShieldCheck, UserPlus, 
  History, CheckCircle2
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

interface DashboardLayoutProps {
  children: ReactNode;
  userType: 'landlord' | 'tenant' | 'super_admin';
  userName: string;
  tenantId?: string; // pass for tenant portal for scoped notifications
}

const DashboardLayout = ({ children, userType, userName, tenantId }: DashboardLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const location = useLocation();

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const recipientType = userType === 'landlord' ? 'landlord' : 'tenant';
  const unread = userType === 'super_admin' ? 0 : unreadCount(recipientType, tenantId);

  // Filter notifications relevant to this user
  const myNotifications = userType === 'super_admin' ? [] : notifications.filter(n => {
    if (n.recipientType !== recipientType) return false;
    if (tenantId && n.recipientId && n.recipientId !== tenantId) return false;
    return true;
  }).slice(0, 20);

  const superAdminNav: NavItem[] = [
    { name: 'Overview', path: '/superadmin/dashboard', icon: LayoutDashboard },
    { name: 'Landlords', path: '/superadmin/landlords', icon: Building2 },
    { name: 'Add Landlord', path: '/superadmin/add-landlord', icon: UserPlus },
    { name: 'One-Time Payments', path: '/superadmin/payments', icon: CreditCard },
    { name: 'Payment History', path: '/superadmin/payment-history', icon: History },
    { name: 'Account Status', path: '/superadmin/account-status', icon: CheckCircle2 },
    { name: 'Audit Logs', path: '/superadmin/audit-logs', icon: ShieldCheck },
    { name: 'Platform Settings', path: '/superadmin/settings', icon: Settings },
  ];

  const landlordNav: NavItem[] = [
    { name: 'Dashboard', path: '/landlord/dashboard', icon: LayoutDashboard },
    { name: 'Tenants', path: '/landlord/tenants', icon: Users },
    { name: 'Rooms', path: '/landlord/rooms', icon: DoorOpen },
    { name: 'Payments', path: '/landlord/payments', icon: CreditCard },
    { name: 'Regulations', path: '/landlord/regulations', icon: ClipboardList },
    { name: 'History & Reports', path: '/landlord/reports', icon: FileText },
    { name: 'Settings', path: '/landlord/settings', icon: Settings },
  ];

  const tenantNav: NavItem[] = [
    { name: 'Dashboard', path: '/tenant/dashboard', icon: LayoutDashboard },
    { name: 'Payments', path: '/tenant/payments', icon: CreditCard },
    { name: 'Regulations', path: '/tenant/regulations', icon: ClipboardList },
    { name: 'History & Reports', path: '/tenant/reports', icon: FileText },
    { name: 'Settings', path: '/tenant/settings', icon: Settings },
  ];

  const navItems = userType === 'super_admin' 
    ? superAdminNav 
    : userType === 'landlord' 
      ? landlordNav 
      : tenantNav;

  const getPageTitle = () => {
    const item = navItems.find(nav => location.pathname.startsWith(nav.path));
    return item ? item.name : 'Dashboard';
  };

  const typeColors: Record<string, string> = {
    success: 'bg-emerald-50 border-l-4 border-emerald-400',
    info: 'bg-blue-50 border-l-4 border-blue-400',
    warning: 'bg-amber-50 border-l-4 border-amber-400',
    error: 'bg-red-50 border-l-4 border-red-400',
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden print:h-auto print:overflow-visible">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 text-white transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:block print:hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-navy-800">
            <img src="/logo.svg" alt="DwellBase" className="h-8 object-contain" />
            <button 
              className="lg:hidden ml-auto text-gray-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-navy-800 text-teal-400' 
                      : 'text-navy-100 hover:bg-navy-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-navy-800">
            <Link 
              to={userType === 'super_admin' ? '/superadmin-login' : '/'}
              onClick={() => {
                localStorage.removeItem('dwellbase_auth');
                localStorage.removeItem('dwellbase_token');
                localStorage.removeItem('dwellbase_role');
                localStorage.removeItem('dwellbase_user');
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-navy-200 hover:bg-navy-800 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 print:block">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-10 relative print:hidden">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-sm font-medium">
              <Cloud className="w-4 h-4" />
              <span>Synced</span>
            </div>
            
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => { setIsNotificationMenuOpen(!isNotificationMenuOpen); setIsProfileMenuOpen(false); }}
                onBlur={() => setTimeout(() => setIsNotificationMenuOpen(false), 200)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full relative focus:outline-none"
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800">Notifications</h4>
                    {unread > 0 && (
                      <button
                        onClick={() => markAllRead(recipientType, tenantId)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {myNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-slate-400 text-center">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No notifications yet.
                      </div>
                    ) : (
                      myNotifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${typeColors[n.type]} ${!n.read ? 'bg-opacity-40' : 'opacity-60'}`}
                        >
                          <p className={`text-sm font-semibold text-slate-800 ${n.read ? 'font-normal' : ''}`}>{n.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Profile Menu */}
            <div className="relative">
              <button 
                onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsNotificationMenuOpen(false); }}
                onBlur={() => setTimeout(() => setIsProfileMenuOpen(false), 200)}
                className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-200 focus:outline-none"
              >
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium text-gray-700">{userName}</div>
                  <div className="text-xs text-gray-500 font-medium">
                    {userType === 'super_admin' ? 'Super Admin' : userType.charAt(0).toUpperCase() + userType.slice(1)}
                  </div>
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  userType === 'super_admin' ? 'bg-amber-100 text-amber-800' : 'bg-navy-100 text-navy-700'
                }`}>
                  <UserIcon className="w-5 h-5" />
                </div>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <Link 
                    to={userType === 'super_admin' ? '/superadmin/settings' : `/${userType}/settings`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <Link 
                    to={userType === 'super_admin' ? '/superadmin-login' : '/'}
                    onClick={() => {
                      localStorage.removeItem('dwellbase_auth');
                      localStorage.removeItem('dwellbase_token');
                      localStorage.removeItem('dwellbase_role');
                      localStorage.removeItem('dwellbase_user');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main padding area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
