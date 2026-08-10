import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getRentCollection } from 'store/rent-collection/rent-collection.action';
import useAuth from './useAuth';
import { selectProperty } from 'store/property/property.selector';

// period: "current" | "6months" | "lifetime"
// propertyId: number | null
export default function useFetchRentCollection(propertyId = null, lifetime = false, ignoreSelectedProperty = false) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { summary, rentRecords, lifetimeSummary, lifetimeRentRecords, loading, error } = useSelector((state) => state.rentCollection);

  const selectedProperty = useSelector(selectProperty);

  // Get user roles - check if user is a tenant (and not a landlord or admin)
  const isTenantOnly = useMemo(() => {
    const userRoles = Array.isArray(user?.Roles) 
      ? user?.Roles 
      : Array.isArray(user?.roles) 
      ? user?.roles 
      : [];
    const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
    const hasTenantRole = normalizedRoles.includes('tenant');
    const hasLandlordRole = normalizedRoles.includes('landlord');
    const hasAdminRole = normalizedRoles.includes('admin');
    
    // Skip API call for tenants (they don't have rent collection data via this endpoint)
    return hasTenantRole && !hasLandlordRole && !hasAdminRole;
  }, [user?.Roles, user?.roles]);

  // build query payload
  const refetch = useCallback(() => {
    if (!user?.id || isTenantOnly) return;

    // OrganizationId is sent via X-Organization-Id header
    const effectivePropertyId = ignoreSelectedProperty ? propertyId : selectedProperty?.id || propertyId;
    dispatch(getRentCollection(effectivePropertyId, lifetime));
  }, [dispatch, user?.id, selectedProperty?.id, propertyId, lifetime, ignoreSelectedProperty, isTenantOnly]);

  // fetch on mount + whenever landlordId, propertyId, or period changes
  useEffect(() => {
    if (isTenantOnly) return;
    refetch();
  }, [refetch, isTenantOnly]);

  // Return the correct data based on lifetime flag
  return {
    summary: lifetime ? lifetimeSummary : summary,
    rentRecords: lifetime ? lifetimeRentRecords : rentRecords,
    loading,
    error,
    refetch
  };
}
