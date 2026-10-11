import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth } from '../api/client';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: 'landlord' | 'tenant' | 'super_admin';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const auth = getAuth(requiredRole);

  if (!auth) {
    // Redirect unauthenticated user to the appropriate login page
    if (requiredRole === 'super_admin') {
      return <Navigate to="/superadmin-login" replace />;
    }
    return <Navigate to={requiredRole === 'landlord' ? '/admin-login' : '/tenant-login'} replace />;
  }

  // Ensure this tab's active session is isolated to this portal's role
  try {
    sessionStorage.setItem('dwellbase_active_role', requiredRole);
  } catch { /* ignore */ }

  return <>{children}</>;
}
