import { Navigate, useLocation } from 'react-router-dom';
import useIsAdmin from 'hooks/useIsAdmin';
import useAuth from 'hooks/useAuth';
import Loader from 'components/Loader';

/**
 * Protected route component that only allows admin users
 * Redirects non-admin users to their appropriate dashboard
 */
export default function AdminRoute({ children }) {
  const isAdmin = useIsAdmin();
  const auth = useAuth();
  const location = useLocation();
  
  // Show loader while checking auth
  if (!auth?.isInitialized) {
    return <Loader />;
  }
  
  // Redirect to login if not authenticated
  if (!auth?.isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Redirect non-admin users to their dashboard
  if (!isAdmin) {
    // Get user roles to determine redirect
    const userRoles = Array.isArray(auth?.user?.Roles) 
      ? auth.user.Roles 
      : Array.isArray(auth?.user?.roles) 
      ? auth.user.roles 
      : [];
    
    const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
    
    if (normalizedRoles.includes('tenant')) {
      return <Navigate to="/tenant/dashboard" replace />;
    } else if (normalizedRoles.includes('landlord')) {
      return <Navigate to="/landlord/dashboard" replace />;
    } else {
      return <Navigate to="/unauthorized" replace />;
    }
  }
  
  // User is admin, render the protected content
  return children;
}

