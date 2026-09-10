import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

/**
 * PrivateRoute — protects routes from unauthorised access.
 * Supports role-based protection.
 */
export default function PrivateRoute({ children, roles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  if (roles && !roles.includes(user?.role)) {
    // If user doesn't have the right role, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
