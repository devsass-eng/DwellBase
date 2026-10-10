import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import UnifiedLogin from './pages/UnifiedLogin';
import LandlordDashboard from './pages/LandlordDashboard';
import TenantDashboard from './pages/TenantDashboard';
import TenantsManagement from './pages/TenantsManagement';
import RoomsManagement from './pages/RoomsManagement';
import AdminPayments from './pages/AdminPayments';
import TenantPayments from './pages/TenantPayments';
import AdminRegulations from './pages/AdminRegulations';
import TenantRegulations from './pages/TenantRegulations';
import AdminReports from './pages/AdminReports';
import TenantReports from './pages/TenantReports';
import AdminSettings from './pages/AdminSettings';
import TenantSettings from './pages/TenantSettings';
import LandlordActivation from './pages/LandlordActivation';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminLandlords from './pages/SuperAdminLandlords';
import SuperAdminAddLandlord from './pages/SuperAdminAddLandlord';
import SuperAdminPayments from './pages/SuperAdminPayments';
import SuperAdminPaymentHistory from './pages/SuperAdminPaymentHistory';
import SuperAdminAccountStatus from './pages/SuperAdminAccountStatus';
import SuperAdminAuditLogs from './pages/SuperAdminAuditLogs';
import SuperAdminSettings from './pages/SuperAdminSettings';
import ProtectedRoute from './components/ProtectedRoute';
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
            {/* Public Entry Routes */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<UnifiedLogin />} />
            <Route path="/admin-login" element={<UnifiedLogin />} />
            <Route path="/tenant-login" element={<UnifiedLogin />} />
            <Route path="/superadmin-login" element={<UnifiedLogin />} />
            <Route path="/activate" element={<LandlordActivation />} />

            {/* Protected Super Admin Portal Routes */}
            <Route path="/superadmin/dashboard" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminDashboard /></ProtectedRoute>} />
            <Route path="/superadmin/landlords" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminLandlords /></ProtectedRoute>} />
            <Route path="/superadmin/add-landlord" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminAddLandlord /></ProtectedRoute>} />
            <Route path="/superadmin/payments" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminPayments /></ProtectedRoute>} />
            <Route path="/superadmin/payment-history" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminPaymentHistory /></ProtectedRoute>} />
            <Route path="/superadmin/account-status" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminAccountStatus /></ProtectedRoute>} />
            <Route path="/superadmin/audit-logs" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminAuditLogs /></ProtectedRoute>} />
            <Route path="/superadmin/settings" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminSettings /></ProtectedRoute>} />
            <Route path="/superadmin/*" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminDashboard /></ProtectedRoute>} />

            {/* Protected Landlord Portal Routes */}
            <Route path="/landlord/dashboard" element={<ProtectedRoute requiredRole="landlord"><LandlordDashboard /></ProtectedRoute>} />
            <Route path="/landlord/tenants" element={<ProtectedRoute requiredRole="landlord"><TenantsManagement /></ProtectedRoute>} />
            <Route path="/landlord/rooms" element={<ProtectedRoute requiredRole="landlord"><RoomsManagement /></ProtectedRoute>} />
            <Route path="/landlord/payments" element={<ProtectedRoute requiredRole="landlord"><AdminPayments /></ProtectedRoute>} />
            <Route path="/landlord/regulations" element={<ProtectedRoute requiredRole="landlord"><AdminRegulations /></ProtectedRoute>} />
            <Route path="/landlord/reports" element={<ProtectedRoute requiredRole="landlord"><AdminReports /></ProtectedRoute>} />
            <Route path="/landlord/settings" element={<ProtectedRoute requiredRole="landlord"><AdminSettings /></ProtectedRoute>} />
            <Route path="/landlord/*" element={<ProtectedRoute requiredRole="landlord"><LandlordDashboard /></ProtectedRoute>} />

            {/* Protected Tenant Portal Routes */}
            <Route path="/tenant/dashboard" element={<ProtectedRoute requiredRole="tenant"><TenantDashboard /></ProtectedRoute>} />
            <Route path="/tenant/payments" element={<ProtectedRoute requiredRole="tenant"><TenantPayments /></ProtectedRoute>} />
            <Route path="/tenant/regulations" element={<ProtectedRoute requiredRole="tenant"><TenantRegulations /></ProtectedRoute>} />
            <Route path="/tenant/reports" element={<ProtectedRoute requiredRole="tenant"><TenantReports /></ProtectedRoute>} />
            <Route path="/tenant/settings" element={<ProtectedRoute requiredRole="tenant"><TenantSettings /></ProtectedRoute>} />
            <Route path="/tenant/*" element={<ProtectedRoute requiredRole="tenant"><TenantDashboard /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AppDataProvider>
    </NotificationProvider>
  );
}

export default App;
