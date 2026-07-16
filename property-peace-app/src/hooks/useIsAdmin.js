import { useMemo } from 'react';
import useAuth from './useAuth';

/**
 * Hook to check if the current user is an admin
 * @returns {boolean} True if user has Admin role
 */
export default function useIsAdmin() {
  const auth = useAuth();
  
  const isAdmin = useMemo(() => {
    if (!auth?.user) return false;
    
    // Get roles from user - handle both Roles and roles
    const userRoles = Array.isArray(auth.user.Roles) 
      ? auth.user.Roles 
      : Array.isArray(auth.user.roles) 
      ? auth.user.roles 
      : [];
    
    // Normalize roles to lowercase for case-insensitive comparison
    const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
    
    return normalizedRoles.includes('admin');
  }, [auth?.user]);
  
  return isAdmin;
}

