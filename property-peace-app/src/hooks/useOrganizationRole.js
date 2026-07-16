import { useMemo, useCallback } from 'react';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';

export default function useOrganizationRole() {
  const { currentOrganization } = useOrganization();
  const auth = useAuth();

  const role = useMemo(() => {
    if (!currentOrganization || !auth?.user) {
      return null;
    }

    // Find user's role in current organization
    // This would need to be populated from the API
    // For now, we'll need to get it from the organization member data
    return currentOrganization.userRole || null;
  }, [currentOrganization, auth?.user]);

  const hasRole = useCallback((requiredRole) => {
    if (!role) return false;
    const roleHierarchy = { Owner: 3, Manager: 2, Viewer: 1 };
    const userRoleLevel = roleHierarchy[role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    return userRoleLevel >= requiredRoleLevel;
  }, [role]);

  const hasPermission = useCallback((permission) => {
    if (!currentOrganization || !auth?.user) return false;
    // This would need to check the member's permissions
    // For now, return based on role
    if (role === 'Owner') return true;
    if (role === 'Manager') {
      return ['CanManageProperties', 'CanManageTenants', 'CanManageLeases', 'CanManageMaintenance'].includes(permission);
    }
    return false;
  }, [currentOrganization, auth?.user, role]);

  return {
    role,
    hasRole,
    hasPermission,
    isOwner: role === 'Owner',
    isManager: role === 'Manager' || role === 'Owner',
    isViewer: role === 'Viewer'
  };
}

