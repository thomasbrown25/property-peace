import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { organizationAPI } from 'api';
import useAuth from 'hooks/useAuth';

const OrganizationContext = createContext(null);

export const OrganizationProvider = ({ children }) => {
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { mutate: swrMutate } = useSWRConfig();
  const auth = useAuth();

  const switchOrganization = useCallback(async (organizationId) => {
    try {
      const response = await organizationAPI.switchOrganization(organizationId);
      if (response.success) {
        setOrganizations((currentOrgs) => {
          const org = currentOrgs.find(o => o.id === organizationId);
          if (org) {
            setCurrentOrganization(org);
            localStorage.setItem('currentOrganizationId', organizationId.toString());
            // Invalidate all SWR cache to refetch data with new organization context
            swrMutate(() => true, undefined, { revalidate: true });
            // Trigger a page reload to refresh all data with new organization context
            // This ensures Redux store and all components get updated data
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
          return currentOrgs;
        });
        return { success: true };
      }
      return { success: false, error: response.message };
    } catch (error) {
      console.error('Error switching organization:', error);
      return { success: false, error: error.message };
    }
  }, [swrMutate]);

  const loadOrganizations = useCallback(async () => {
    if (!auth?.isLoggedIn || !auth?.user) {
      setLoading(false);
      return;
    }

    // Check if user is a tenant - tenants don't require organizations
    const userRoles = Array.isArray(auth.user?.Roles)
      ? auth.user.Roles
      : Array.isArray(auth.user?.roles)
        ? auth.user.roles
        : [];
    const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
    const isTenant = normalizedRoles.includes('tenant');
    const isLandlord = normalizedRoles.includes('landlord') || normalizedRoles.includes('admin');
    const isAdminOnly = normalizedRoles.includes('admin') && !normalizedRoles.includes('landlord');

    // Admin portal does not use organization or subscription context - skip loading to avoid 400s
    if (isAdminOnly) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // For tenants, organizations are optional (they might belong to landlord's org if invited)
      // Only load organizations if they exist - don't treat missing org as error
      if (isTenant) {
        try {
          const response = await organizationAPI.getUserOrganizations();
          if (response.success && response.data && response.data.length > 0) {
            setOrganizations(response.data);
            
            // Try to get current organization, but don't fail if not found
            try {
              const currentOrgResponse = await organizationAPI.getCurrentOrganization();
              if (currentOrgResponse.success && currentOrgResponse.data) {
                setCurrentOrganization(currentOrgResponse.data);
                localStorage.setItem('currentOrganizationId', currentOrgResponse.data.id.toString());
              } else if (response.data.length > 0) {
                // If no current org but user has organizations, use the first one
                const firstOrg = response.data[0];
                setCurrentOrganization(firstOrg);
                try {
                  await organizationAPI.switchOrganization(firstOrg.id);
                  localStorage.setItem('currentOrganizationId', firstOrg.id.toString());
                  swrMutate(() => true, undefined, { revalidate: true });
                } catch (error) {
                  console.error('Error switching to first organization:', error);
                }
              } else {
              }
            } catch (orgError) {
              // For tenants, missing current organization is not an error
              if (orgError?.response?.status === 400 || orgError?.response?.status === 404) {
                // Expected - tenant doesn't have an organization yet
              } else {
              }
            }
          } else {
            setOrganizations([]);
          }
        } catch (error) {
          // For tenants, organization errors are not fatal
          setOrganizations([]);
        }
      } else if (isLandlord) {
        // For landlords, organizations are expected but not required - handle gracefully
        try {
          const response = await organizationAPI.getUserOrganizations();
          if (response.success && response.data) {
            setOrganizations(response.data);
            
            // Set current organization if user has one
            try {
              const currentOrgResponse = await organizationAPI.getCurrentOrganization();
              if (currentOrgResponse.success && currentOrgResponse.data) {
                setCurrentOrganization(currentOrgResponse.data);
                localStorage.setItem('currentOrganizationId', currentOrgResponse.data.id.toString());
              } else if (response.data.length > 0) {
                // If no current org but user has organizations, use the first one
                const firstOrg = response.data[0];
                setCurrentOrganization(firstOrg);
                // Call switchOrganization API directly to avoid circular dependency
                try {
                  await organizationAPI.switchOrganization(firstOrg.id);
                  localStorage.setItem('currentOrganizationId', firstOrg.id.toString());
                  swrMutate(() => true, undefined, { revalidate: true });
                } catch (error) {
                  console.error('Error switching to first organization:', error);
                }
              } else {
                // Landlord has no organizations - this is OK, they can create one
                setCurrentOrganization(null);
                localStorage.removeItem('currentOrganizationId');
              }
            } catch (orgError) {
              // For landlords, missing current organization is OK if they have no orgs
              if (orgError?.response?.status === 400 || orgError?.response?.status === 404) {
                // Expected - landlord doesn't have an organization yet
                setCurrentOrganization(null);
                localStorage.removeItem('currentOrganizationId');
              } else {
              }
            }
          } else {
            // No organizations found - this is OK for landlords
            setOrganizations([]);
            setCurrentOrganization(null);
            localStorage.removeItem('currentOrganizationId');
          }
        } catch (error) {
          // For landlords, organization errors should be handled gracefully
          setOrganizations([]);
          setCurrentOrganization(null);
          localStorage.removeItem('currentOrganizationId');
        }
      }
    } catch (error) {
      // Only log as error for landlords, tenants can work without organizations
      if (isLandlord) {
      } else {
      }
    } finally {
      setLoading(false);
    }
  }, [auth?.isLoggedIn, auth?.user, swrMutate]);

  const refreshOrganizations = useCallback(() => {
    return loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (auth?.isLoggedIn) {
      loadOrganizations();
    } else {
      setCurrentOrganization(null);
      setOrganizations([]);
      localStorage.removeItem('currentOrganizationId');
      setLoading(false);
    }
  }, [auth?.isLoggedIn, loadOrganizations]);

  const value = {
    currentOrganization,
    organizations,
    loading,
    switchOrganization,
    refreshOrganizations
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};

export default OrganizationContext;

