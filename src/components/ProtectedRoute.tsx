import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: 'landlord' | 'tenant' | 'super_admin';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const authRaw = localStorage.getItem('dwellbase_auth');

  if (!authRaw) {
    // Redirect unauthenticated user to the appropriate login page
    if (requiredRole === 'super_admin') {
      return <Navigate to="/superadmin-login" replace />;
    }
    return <Navigate to={requiredRole === 'landlord' ? '/admin-login' : '/tenant-login'} replace />;
  }

  try {
    const auth = JSON.parse(authRaw);

    // If role doesn't match, redirect to the user's authorised portal
    if (auth.role !== requiredRole) {
      if (auth.role === 'super_admin') {
        return <Navigate to="/superadmin/dashboard" replace />;
      }
      return <Navigate to={auth.role === 'landlord' ? '/landlord/dashboard' : '/tenant/dashboard'} replace />;
    }

    return <>{children}</>;
  } catch {
    localStorage.removeItem('dwellbase_auth');
    return <Navigate to="/" replace />;
  }
}
