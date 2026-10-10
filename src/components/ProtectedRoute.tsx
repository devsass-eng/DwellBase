import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: 'landlord' | 'tenant';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const authRaw = localStorage.getItem('dwellbase_auth');

  if (!authRaw) {
    // Redirect unauthenticated user to the appropriate login page
    return <Navigate to={requiredRole === 'landlord' ? '/admin-login' : '/tenant-login'} replace />;
  }

  try {
    const auth = JSON.parse(authRaw);

    // If role doesn't match, redirect to the user's authorised portal
    if (auth.role !== requiredRole) {
      return <Navigate to={auth.role === 'landlord' ? '/landlord/dashboard' : '/tenant/dashboard'} replace />;
    }

    return <>{children}</>;
  } catch {
    localStorage.removeItem('dwellbase_auth');
    return <Navigate to="/" replace />;
  }
}
