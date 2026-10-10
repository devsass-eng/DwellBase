import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import AdminLogin from './pages/AdminLogin';
import TenantLogin from './pages/TenantLogin';
import LandlordDashboard from './pages/LandlordDashboard';
import TenantDashboard from './pages/TenantDashboard';
import TenantsManagement from './pages/TenantsManagement';
import RoomsManagement from './pages/RoomsManagement';
import AdminPayments from './pages/AdminPayments';
import TenantPayments from './pages/TenantPayments';
import AdminRegulations from './pages/AdminRegulations';
import TenantRegulations from './pages/TenantRegulations';
import AdminSettings from './pages/AdminSettings';
import TenantSettings from './pages/TenantSettings';
import { AppDataProvider } from './context/AppDataContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <NotificationProvider>
      <AppDataProvider>
        <BrowserRouter>
          <ToastContainer />
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/tenant-login" element={<TenantLogin />} />
            <Route path="/landlord/dashboard" element={<LandlordDashboard />} />
            <Route path="/landlord/tenants" element={<TenantsManagement />} />
            <Route path="/landlord/rooms" element={<RoomsManagement />} />
            <Route path="/landlord/payments" element={<AdminPayments />} />
            <Route path="/landlord/regulations" element={<AdminRegulations />} />
            <Route path="/landlord/settings" element={<AdminSettings />} />
            <Route path="/landlord/*" element={<LandlordDashboard />} />
            <Route path="/tenant/dashboard" element={<TenantDashboard />} />
            <Route path="/tenant/payments" element={<TenantPayments />} />
            <Route path="/tenant/regulations" element={<TenantRegulations />} />
            <Route path="/tenant/settings" element={<TenantSettings />} />
            <Route path="/tenant/*" element={<TenantDashboard />} />
          </Routes>
        </BrowserRouter>
      </AppDataProvider>
    </NotificationProvider>
  );
}

export default App;
