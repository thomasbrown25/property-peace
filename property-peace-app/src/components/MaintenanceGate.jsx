import { useEffect } from 'react';

const DEFAULT_STATUS = {
  maintenanceModeEnabled: false,
  maintenanceTitle: 'Property Peace is getting a quick tune-up',
  maintenanceMessage: 'We’re making updates to improve reliability and performance. Please check back shortly.',
  maintenanceSupportEmail: 'support@propertypeace.io'
};

const AUTH_BYPASS_PATHS = [
  '/',
  '/login',
  '/auth/login',
  '/jwt/login',
  '/auth/forgot-password',
  '/forgot-password',
  '/jwt/forgot-password',
  '/auth/reset-password',
  '/reset-password',
  '/jwt/reset-password',
  '/auth/check-mail',
  '/check-mail',
  '/jwt/check-mail',
  '/auth/code-verification',
  '/code-verification',
  '/jwt/code-verification'
];

function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_APP_API_URL;
  if (!envUrl || !envUrl.trim()) return 'http://localhost:5001';
  return envUrl.trim().replace(/\/$/, '');
}

function isMaintenanceBypassPath(pathname) {
  if (pathname === '/maintenance') return true;

  // Keep the admin portal reachable so admins can turn maintenance mode off.
  // Existing protected/admin routes still enforce authentication and Admin role.
  if (pathname.startsWith('/admin')) return true;

  // Keep login/recovery reachable during maintenance so admins can sign in.
  return AUTH_BYPASS_PATHS.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));
}

export default function MaintenanceGate({ children }) {
  useEffect(() => {
    let cancelled = false;

    async function checkMaintenanceStatus() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/admin/settings/app-status`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });

        if (!response.ok) return;

        const status = { ...DEFAULT_STATUS, ...(await response.json()) };
        if (cancelled) return;

        const pathname = window.location.pathname;
        if (status.maintenanceModeEnabled && !isMaintenanceBypassPath(pathname)) {
          sessionStorage.setItem('maintenanceStatus', JSON.stringify(status));
          sessionStorage.setItem('preMaintenancePath', `${window.location.pathname}${window.location.search}${window.location.hash}`);
          window.location.replace('/maintenance');
        } else if (!status.maintenanceModeEnabled) {
          sessionStorage.removeItem('maintenanceStatus');
        }
      } catch {
        // Fail open: if the status endpoint is unavailable, do not lock users out.
      }
    }

    const notifyLocationChange = () => window.dispatchEvent(new Event('maintenance-gate:location-change'));
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyLocationChange();
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyLocationChange();
      return result;
    };

    checkMaintenanceStatus();
    window.addEventListener('popstate', checkMaintenanceStatus);
    window.addEventListener('focus', checkMaintenanceStatus);
    window.addEventListener('maintenance-gate:location-change', checkMaintenanceStatus);

    return () => {
      cancelled = true;
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', checkMaintenanceStatus);
      window.removeEventListener('focus', checkMaintenanceStatus);
      window.removeEventListener('maintenance-gate:location-change', checkMaintenanceStatus);
    };
  }, []);

  return children;
}
