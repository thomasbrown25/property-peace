import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import { useSubscriptionStatus } from 'hooks/useSubscription';

export default function useRedirectUser() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { status: subscriptionStatus } = useSubscriptionStatus();

  // Get auth state from JWTContext only
  const isAuthenticated = auth?.isLoggedIn;
  const isLoading = !auth?.isInitialized;
  // Get roles from JWTContext user - ensure it's an array
  const userRoles = Array.isArray(auth?.user?.Roles) ? auth?.user?.Roles : Array.isArray(auth?.user?.roles) ? auth?.user?.roles : [];

  useEffect(() => {
    const pathname = location.pathname;
    
    // Early return for dashboard/protected routes - no need to check registration workflow
    const isDashboardRoute = 
      pathname.startsWith('/landlord/') ||
      pathname.startsWith('/tenant/') ||
      pathname.startsWith('/admin/');
    
    // Only check registration workflow pages if we're NOT on a dashboard route
    // This avoids unnecessary checks and potential initialization issues
    if (!isDashboardRoute) {
      // Check if we're on a registration workflow page - skip hook entirely for these pages
      const isRegistrationWorkflowPage = 
        pathname.includes('/register/personal-info') || 
        pathname.includes('/register/business-info') ||
        pathname.includes('/register/setting-up-profile') ||
        pathname.includes('/register/email-verifier') ||
        pathname.includes('/register/password') ||
        pathname.includes('/register/email') ||
        pathname.includes('/login') ||
        pathname.includes('/forgot-password') ||
        pathname.includes('/reset-password');

      // Skip entirely if on registration workflow page
      if (isRegistrationWorkflowPage) {
        return;
      }
    }
    
    // Only redirect if user is authenticated, not loading, and has roles
    if (!isAuthenticated || isLoading || !userRoles?.length) {
      return;
    }

    // Normalize roles to lowercase for case-insensitive comparison
    const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
    const hasLandlordRole = normalizedRoles.includes('landlord');
    const hasTenantRole = normalizedRoles.includes('tenant');
    const hasAdminRole = normalizedRoles.includes('admin');

    // Determine if we're on a registration workflow page (for isAuthPage check)
    const isRegistrationWorkflowPage = 
      pathname.includes('/register/personal-info') || 
      pathname.includes('/register/business-info') ||
      pathname.includes('/register/setting-up-profile') ||
      pathname.includes('/register/email-verifier') ||
      pathname.includes('/register/password') ||
      pathname.includes('/register/email');

    const isAuthPage =
      pathname.includes('/login') ||
      (pathname.includes('/register') && !isRegistrationWorkflowPage) ||
      pathname.includes('/forgot-password') ||
      pathname.includes('/reset-password') ||
      pathname.includes('/tenant/register') ||
      pathname === '/' ||
      pathname === '/jwt' ||
      pathname === '/firebase' ||
      pathname === '/aws' ||
      pathname === '/auth0' ||
      pathname === '/supabase';

    const isLandlordRoute = pathname.startsWith('/landlord/');
    const isTenantRoute = pathname.startsWith('/tenant/');
    const isAdminRoute = pathname.startsWith('/admin/');

    // Redirect from auth pages based on role
    // Priority: Admin > Tenant > Landlord
    if (isAuthPage) {
      if (hasAdminRole) {
        navigate('/admin/dashboard', { replace: true });
      } else if (hasTenantRole) {
        navigate('/tenant/dashboard', { replace: true });
      } else if (hasLandlordRole) {
        navigate('/landlord/dashboard', { replace: true });
      } else {
        navigate('/unauthorized', { replace: true });
      }
      return;
    }

    // Protect admin routes: redirect non-admin users away
    if (isAdminRoute && !hasAdminRole) {
      if (hasTenantRole) {
        navigate('/tenant/dashboard', { replace: true });
      } else if (hasLandlordRole) {
        navigate('/landlord/dashboard', { replace: true });
      } else {
        navigate('/unauthorized', { replace: true });
      }
      return;
    }

    // Protect routes: redirect tenants away from landlord routes
    if (isLandlordRoute && hasTenantRole && !hasLandlordRole && !hasAdminRole) {
      navigate('/tenant/dashboard', { replace: true });
      return;
    }

    // Protect routes: redirect landlords away from tenant routes (if needed)
    if (isTenantRoute && hasLandlordRole && !hasTenantRole && !hasAdminRole) {
      navigate('/landlord/dashboard', { replace: true });
      return;
    }

    // Check if trial is expired for landlords
    if (hasLandlordRole && !hasAdminRole && subscriptionStatus) {
      const isTrialExpired = subscriptionStatus.isTrialActive && 
        (subscriptionStatus.trialDaysRemaining === null || subscriptionStatus.trialDaysRemaining <= 0);
      
      // If trial expired, only allow subscription page
      if (isTrialExpired && isLandlordRoute && !pathname.includes('/landlord/settings')) {
        navigate('/landlord/settings?tab=subscription', { replace: true });
        return;
      }
    }
  }, [isAuthenticated, isLoading, userRoles, navigate, location, auth, subscriptionStatus]);

  return;
}
