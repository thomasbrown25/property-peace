import { useState, useEffect, useMemo } from 'react';
import { Box, Fade } from '@mui/material';
import TenantsHeader from 'sections/landlord/tenants/TenantsHeader';
import TenantsContent from 'sections/landlord/tenants/TenantsContent';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import AnimateIn from 'components/AnimateIn';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import useFetchTenants from 'hooks/useFetchTenants';

// ==============================|| TENANTS PAGE ||============================== //

export default function Tenants() {
  const [fadeIn, setFadeIn] = useState(false);
  
  // Get loading state from hook
  const { isLoading: tenantsLoading } = useFetchTenants();
  
  // Get context to update tenants page loading state
  const { setTenantsLoading } = useDashboardLoading();
  
  // Comprehensive loading state - tracks when ALL tenants page components are loaded
  const isTenantsPageLoading = useMemo(() => {
    return tenantsLoading;
  }, [tenantsLoading]);
  
  // Update the context whenever the tenants page loading state changes
  useEffect(() => {
    setTenantsLoading(isTenantsPageLoading);
  }, [isTenantsPageLoading, setTenantsLoading]);

  // Trigger fade-in animation on mount
  useEffect(() => {
    setFadeIn(true);
  }, []);

  return (
    <>
      <Fade in={fadeIn} timeout={600}>
        <Box sx={{ overflow: 'visible' }}>
          {/* Header */}
          <AnimateIn direction="bottom" delay={100} distance={120}>
            <TenantsHeader />
          </AnimateIn>

          {/* Tenants Content */}
          <TenantsContent />
        </Box>
      </Fade>

      <TenantAddDrawer />
    </>
  );
}
