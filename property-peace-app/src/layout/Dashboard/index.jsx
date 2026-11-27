import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { matchPath, Outlet, useLocation } from 'react-router-dom';
import NewMaintenancePanel from 'components/maintenance/NewMaintenancePanel';
import ExpenseAddDrawer from 'components/expense/ExpenseAddDrawer';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import RecordPaymentDrawer from 'components/drawers/RecordPaymentDrawer';
import PropertyAddWorkflowDrawer from 'components/drawers/PropertyAddWorkflowDrawer';
import ScheduleInspectionDrawer from 'components/drawers/ScheduleInspectionDrawer';

import { Container, Toolbar, Box } from '@mui/material';
import { portalPageBackground } from 'themes/portalPageBackground';

// project imports
import Header, { TENANT_HEADER_HEIGHT } from './Header';
import MainDrawer from './Drawer';
import LandlordSidebar, { LANDLORD_SIDEBAR_WIDTH } from './LandlordSidebar';
import Footer from './Footer';
import Loader from 'components/Loader';

import AuthGuard from 'utils/route-guard/AuthGuard';
import SuspensionBanner from 'components/account/SuspensionBanner';
import ImpersonationBanner from 'components/admin/ImpersonationBanner';
import PageTransition from 'components/PageTransition';
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { useOrganization } from 'contexts/OrganizationContext';
import { selectIsEmptyPropertyPortfolio } from 'store/property/property.selector';
import { MINI_DRAWER_WIDTH } from 'config';


import { useGetMenuMaster } from 'api/menu';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const isAdminPortal = pathname === '/admin' || pathname.startsWith('/admin/');
  const isTenantPortal = pathname === '/tenant' || pathname.startsWith('/tenant/');

  const isLandlordPortal = pathname === '/landlord' || pathname.startsWith('/landlord/');
  const [adminMobileMenuOpen, setAdminMobileMenuOpen] = useState(false);
  const [adminDesktopMenuOpen, setAdminDesktopMenuOpen] = useState(true);
  const [landlordMobileMenuOpen, setLandlordMobileMenuOpen] = useState(false);
  const [landlordDesktopMenu, setLandlordDesktopMenu] = useState(null);
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const emptyPropertyPortfolio = useSelector((state) => isLandlordPortal && selectIsEmptyPropertyPortfolio(state, organizationId));
  const landlordDesktopMenuOpen = !emptyPropertyPortfolio || (landlordDesktopMenu?.organizationId === organizationId && landlordDesktopMenu.open);
  const landlordSidebarWidth = landlordDesktopMenuOpen ? LANDLORD_SIDEBAR_WIDTH : MINI_DRAWER_WIDTH;
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
    setLandlordMobileMenuOpen(false);
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
  // Check if it's the messages page (e.g., /landlord/chat)
  const isMessagesPage = pathname === '/landlord/chat' || pathname.startsWith('/landlord/chat?');
  // Check if it's the reports page (e.g., /landlord/reports)
  const isReportsPage = pathname === '/landlord/reports' || pathname.startsWith('/landlord/reports?');
  const isLandlordSettingsPage = Boolean(matchPath('/landlord/settings', pathname));
  const isSettingsPage = isLandlordSettingsPage || Boolean(matchPath('/tenant/settings', pathname));
  const isFullWidthPage = isSettingsPage;
  // Check if it's the accounting page (e.g., /landlord/accounting)
  const isAccountingPage = pathname === '/landlord/accounting' || pathname.startsWith('/landlord/accounting');
  const hasPageScopedMaintenanceDrawer =
    pathname.includes('/landlord/dashboard') ||
    pathname === '/landlord/maintenances' ||
    pathname.startsWith('/landlord/maintenances?') ||
    pathname === '/landlord/chat' ||
    pathname.startsWith('/landlord/chat?') ||
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
    (isLandlordSettingsPage && isSettingsLoading) ||
    (isAccountingPage && isAccountingLoading);

  return (
    <AuthGuard>
      {/* Show top loading bar when layout is loading OR dashboard components are loading */}
      {showLoader && <Loader />}
      <Box
        sx={[portalPageBackground, { display: 'flex', width: '100%', minHeight: '100vh' }]}
      >
        <Header
          adminPortal={isAdminPortal}
          landlordPortal={isLandlordPortal}
          tenantPortal={isTenantPortal}
          adminDesktopMenuOpen={adminDesktopMenuOpen}
          landlordDesktopMenuOpen={landlordDesktopMenuOpen}
          landlordSidebarWidth={landlordSidebarWidth}
          onAdminMenuToggle={() => setAdminDesktopMenuOpen((open) => !open)}
          onAdminMenuOpen={() => setAdminMobileMenuOpen(true)}
          onLandlordMenuToggle={emptyPropertyPortfolio ? () => setLandlordDesktopMenu({ organizationId, open: !landlordDesktopMenuOpen }) : undefined}
          onLandlordMenuOpen={() => setLandlordMobileMenuOpen(true)}
        />
        {isAdminPortal && (
          <MainDrawer desktopOpen={adminDesktopMenuOpen} mobileOpen={adminMobileMenuOpen} onMobileClose={() => setAdminMobileMenuOpen(false)} />
        )}
        {isLandlordPortal && (
          <LandlordSidebar
            desktopOpen={landlordDesktopMenuOpen}
            desktopWidth={landlordSidebarWidth}
            mobileOpen={landlordMobileMenuOpen}
            onMobileClose={() => setLandlordMobileMenuOpen(false)}
          />
        )}

        <Box 
          component="main" 
          sx={{ 
            width: isLandlordPortal ? { xs: '100%', lg: `calc(100% - ${landlordSidebarWidth}px)` } : '100%',
            flexGrow: 1, 
            p: isFullWidthPage ? 0 : 2.5,
            pb: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'auto',
            minWidth: 0
          }}
        >
          <Toolbar sx={{ minHeight: { xs: '52px !important', sm: '60px !important' }, height: isTenantPortal ? TENANT_HEADER_HEIGHT : undefined }} />
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
              {/* Keep page gutters separate from the header and footer. */}
              <Box data-testid="main-app-page-content" sx={{
                width: '100%',
                maxWidth: 'none',
                mx: 'auto',
                px: isFullWidthPage ? 0 : { xs: 0, sm: 1, md: 1.5, lg: 2 },
                boxSizing: 'border-box',
                minWidth: 0,
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
                <PageTransition stretch={isSettingsPage}>
                  <Outlet />
                </PageTransition>
              </Box>
              <Box sx={{
                flexShrink: 0,
                width: '100%',
                px: isSettingsPage ? 2.5 : 0,
                mt: 'auto',
              }}>
                <Footer />
              </Box>
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
