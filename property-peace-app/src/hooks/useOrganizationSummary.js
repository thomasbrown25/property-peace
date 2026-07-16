import { useState, useEffect, useCallback } from 'react';
import axiosServices from 'utils/axios';
import useAuth from 'hooks/useAuth';

/**
 * Hook to fetch organization summary data for AI Copilot
 * @returns {Object} - { data, loading, error, refetch }
 */
export default function useOrganizationSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const auth = useAuth();

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axiosServices.get('/api/ai-copilot/organization-summary');
      
      if (response.data?.success && response.data?.data) {
        setData(response.data.data);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch organization summary');
      }
    } catch (err) {
      console.error('Error fetching organization summary:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load organization summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Get user roles - check if user is a tenant (and not a landlord or admin)
    const userRoles = Array.isArray(auth?.user?.Roles) 
      ? auth?.user?.Roles 
      : Array.isArray(auth?.user?.roles) 
      ? auth?.user?.roles 
      : [];
    const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
    const hasTenantRole = normalizedRoles.includes('tenant');
    const hasLandlordRole = normalizedRoles.includes('landlord');
    const hasAdminRole = normalizedRoles.includes('admin');
    
    // Skip API call for tenants (they don't have organization summaries)
    const isTenantOnly = hasTenantRole && !hasLandlordRole && !hasAdminRole;

    if (isTenantOnly) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    
    fetchSummary();
  }, [auth?.user?.Roles, auth?.user?.roles, fetchSummary]);

  return {
    data,
    loading,
    error,
    refetch: fetchSummary
  };
}

