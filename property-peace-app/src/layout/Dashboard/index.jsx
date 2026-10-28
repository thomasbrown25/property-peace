import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NewMaintenancePanel from 'components/maintenance/NewMaintenancePanel';
import ExpenseAddDrawer from 'components/expense/ExpenseAddDrawer';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import RecordPaymentDrawer from 'components/drawers/RecordPaymentDrawer';
import PropertyAddWorkflowDrawer from 'components/drawers/PropertyAddWorkflowDrawer';
import ScheduleInspectionDrawer from 'components/drawers/ScheduleInspectionDrawer';

import { Container, Toolbar, Box, alpha } from '@mui/material';

// project imports
import Header from './Header';
import MainDrawer from './Drawer';
import { DRAWER_WIDTH } from 'config';
import Footer from './Footer';
import Loader from 'components/Loader';

import AuthGuard from 'utils/route-guard/AuthGuard';
import SuspensionBanner from 'components/account/SuspensionBanner';
import ImpersonationBanner from 'components/admin/ImpersonationBanner';
import PageTransition from 'components/PageTransition';
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import UnitLimitGate from 'components/subscription/UnitLimitGate';

import { useGetMenuMaster } from 'api/menu';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const isAdminPortal = pathname === '/admin' || pathname.startsWith('/admin/');
  const [adminMobileMenuOpen, setAdminMobileMenuOpen] = useState(false);
  // Standalone property onboarding supplies its own logo, Save & exit, and step footer.
  const isAddPropertyPage = pathname === '/landlord/properties/add' || pathname === '/landlord/property-add-workflow';
  const { menuMasterLoading, menuMaster } = useGetMenuMaster();
  const { user } = useAuth();
  const drawer = useDrawer();
  const userRoles = Array.isArray(user?.Roles) ? user?.Roles : Array.isArray(user?.roles) ? user?.roles : [];
  const hasLandlordRole = userRoles.map((r) => String(r).toLowerCase().trim()).includes('landlord');


  const [isLayoutLoading, setIsLayoutLoading] = useState(true);
  const { 
    isDashboardLoading, 
    isPropertyLoading, 
    isPropertiesLoading, 
    isLeasesLoading, 
    isLeaseLoading, 
    isMaintenancesLoading, 
    isTenantsLoading,
    isMessagesLoading,
    isReportsLoading,
    isSettingsLoading,
    isAccountingLoading
  } = useDashboardLoading();

  
  // Check if user is suspended
  const isSuspended = user?.isSuspended || user?.IsSuspended || false;

  // Hide loader once layout is ready (menu loaded)
  useEffect(() => {
    setAdminMobileMenuOpen(false);
  }, [pathname]);

  // Keep it visible longer to allow page components to start animating
  useEffect(() => {
    if (!menuMasterLoading && menuMaster) {
      // Delay to allow page components to start animating
      // Dashboard components start at 100ms delay and take 600ms to animate
      // So we need at least 700ms total, but add extra for smooth transition
      const isDashboardPage = pathname.includes('/dashboard');
      const delay = isDashboardPage ? 900 : 500; // Longer delay for dashboard page to allow components to start animating
      
      const timer = setTimeout(() => {
        setIsLayoutLoading(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [menuMasterLoading, menuMaster, pathname]);

  if (menuMasterLoading) return <Loader />;

  // Combined loading state: layout loading OR page-specific loading
  const isDashboardPage = pathname.includes('/dashboard');
  // Check if it's a specific property page (e.g., /landlord/property/123, not /landlord/properties)
  const isPropertyPage = pathname.match(/\/property\/\d+/) !== null;
  // Check if it's the properties list page (e.g., /landlord/properties)
  const isPropertiesPage = pathname === '/landlord/properties' || pathname.startsWith('/landlord/properties?');
  // Check if it's the canonical Finances workspace.
  const isFinancesPage = pathname === '/landlord/finances';
  // Check if it's the leases page (e.g., /landlord/leases)
  const isLeasesPage = pathname === '/landlord/leases' || pathname.startsWith('/landlord/leases?');
  // Check if it's a specific lease page (e.g., /landlord/lease/123)
  const isLeasePage = pathname.match(/\/lease\/\d+/) !== null;
  // Check if it's the maintenances page (e.g., /landlord/maintenances)
  const isMaintenancesPage = pathname === '/landlord/maintenances' || pathname.startsWith('/landlord/maintenances?');
  // Check if it's the messages page (e.g., /landlord/messages)
  const isMessagesPage = pathname === '/landlord/messages' || pathname.startsWith('/landlord/messages?');
  // Check if it's the reports page (e.g., /landlord/reports)
  const isReportsPage = pathname === '/landlord/reports' || pathname.startsWith('/landlord/reports?');
  // Check if it's the settings page (e.g., /landlord/settings)
  const isSettingsPage = pathname === '/landlord/settings' || pathname.startsWith('/landlord/settings?');
  // Check if it's the accounting page (e.g., /landlord/accounting)
  const isAccountingPage = pathname === '/landlord/accounting' || pathname.startsWith('/landlord/accounting');
  const hasPageScopedMaintenanceDrawer =
    pathname.includes('/landlord/dashboard') ||
    pathname === '/landlord/maintenances' ||
    pathname.startsWith('/landlord/maintenances?') ||
    pathname === '/landlord/messages' ||
    pathname.startsWith('/landlord/messages?') ||
    pathname.match(/\/landlord\/property\/\d+/) !== null ||
    pathname === '/landlord/urgent-messages' ||
    pathname.startsWith('/landlord/urgent-messages?');
  const showGlobalMaintenanceDrawer = hasLandlordRole && !hasPageScopedMaintenanceDrawer;
  const showLoader = isLayoutLoading || 
    (isDashboardPage && isDashboardLoading) || 
    (isPropertyPage && isPropertyLoading) || 
    (isPropertiesPage && isPropertiesLoading) ||
    (isFinancesPage && isAccountingLoading) ||
    (isLeasesPage && (isLeasesLoading || isTenantsLoading)) ||
    (isLeasePage && isLeaseLoading) ||
    (isMaintenancesPage && isMaintenancesLoading) ||
    (isMessagesPage && isMessagesLoading) ||
    (isReportsPage && isReportsLoading) ||
    (isSettingsPage && isSettingsLoading) ||
    (isAccountingPage && isAccountingLoading);

  return (
    <AuthGuard>
      {/* Show top loading bar when layout is loading OR dashboard components are loading */}
      {showLoader && <Loader />}
      <Box
        sx={(theme) => ({
          display: 'flex',
          width: '100%',
          bgcolor: 'background.default',
          minHeight: '100vh',
          ...(theme.palette.mode === 'dark' && {
            backgroundImage: `
              radial-gradient(circle at 20% 0%, ${alpha(theme.palette.primary.main, 0.12)} 0, transparent 28%),
              radial-gradient(circle at 86% 12%, ${alpha(theme.palette.warning.main, 0.08)} 0, transparent 24%),
              linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha('#050a12', 0.98)} 100%)
            `,
            backgroundAttachment: 'fixed'
          })
        })}
      >
        {!isAddPropertyPage && <Header adminPortal={isAdminPortal} onAdminMenuOpen={() => setAdminMobileMenuOpen(true)} />}
        {isAdminPortal && <MainDrawer mobileOpen={adminMobileMenuOpen} onMobileClose={() => setAdminMobileMenuOpen(false)} />}

        <Box 
          component="main" 
          sx={{ 
            width: isAdminPortal ? { xs: '100%', lg: `calc(100% - ${DRAWER_WIDTH}px)` } : '100%',
            flexGrow: 1, 
            p: isAddPropertyPage ? 0 : 2.5,
            pb: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'auto',
            minWidth: 0
          }}
        >
          {!isAddPropertyPage && <Toolbar sx={{ minHeight: { xs: '68px !important', sm: '84px !important' } }} />}
          <Container
            maxWidth={false}
            disableGutters
            sx={{
              position: 'relative',
              flexGrow: 1,
              flexShrink: 0,
              flexBasis: 'auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 'auto !important',
              height: 'auto !important',
              '& > *': {
                minHeight: 'auto !important',
                height: 'auto !important'
              }
            }}
          >
            <ImpersonationBanner />
            {isSuspended && <SuspensionBanner />}
            <Box sx={{ 
              position: 'relative', 
              width: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              minHeight: 'auto !important',
              height: 'auto !important',
              '& > *': {
                minHeight: 'auto !important',
                height: 'auto !important'
              }
            }}>
              <Box sx={{ 
                flex: 1, 
                minHeight: 'auto !important',
                height: 'auto !important',
                display: 'flex', 
                flexDirection: 'column',
                '& > *': {
                  minHeight: 'auto !important',
                  height: 'auto !important'
                }
              }}>
                <UnitLimitGate>
                  <PageTransition>
                    <Outlet />
                  </PageTransition>
                </UnitLimitGate>
              </Box>
              {!isAddPropertyPage && <Box sx={{
                flexShrink: 0,
                width: '100%',
                mt: 'auto',
              }}>
                <Footer />
              </Box>}
            </Box>
          </Container>
        </Box>
        {hasLandlordRole && <NewMaintenancePanel />}
        <RecordPaymentDrawer onSuccess={drawer.notifyFinanceMutation} />
        <ExpenseAddDrawer
          open={drawer.isOpenExpenseAdd}
          onClose={drawer.closeExpenseAddDrawer}
          onSuccess={drawer.notifyFinanceMutation}
          initialSelection={drawer.expenseAddInitialSelection}
        />
        {showGlobalMaintenanceDrawer && <LandlordMaintenanceDrawer />}
        <PropertyAddWorkflowDrawer />
        <ScheduleInspectionDrawer />
      </Box>
    </AuthGuard>
  );
}
