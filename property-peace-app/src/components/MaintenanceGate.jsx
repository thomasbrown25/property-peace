import { useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const DEFAULT_STATUS = {
  maintenanceModeEnabled: false,
  maintenanceTitle: 'Property Peace is getting a quick tune-up',
  maintenanceMessage: 'We’re making updates to improve reliability and performance. Please check back shortly.',
  maintenanceSupportEmail: 'support@propertypeace.io'
};

function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_APP_API_URL;
  if (!envUrl || !envUrl.trim()) return 'http://localhost:5001';
  return envUrl.trim().replace(/\/$/, '');
}


function hasAdminBypass() {
  try {
    const token = localStorage.getItem('serviceToken') || localStorage.getItem('token');
    if (!token) return false;

    const decoded = jwtDecode(token);
    const roles = [
      decoded.role,
      decoded.roles,
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role']
    ].flat().filter(Boolean);

    return roles.some((role) => String(role).toLowerCase() === 'admin');
  } catch {
    return false;
  }
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

        const isMaintenancePath = window.location.pathname === '/maintenance';
        const isAdminPath = window.location.pathname.startsWith('/admin');
        if (status.maintenanceModeEnabled && !isMaintenancePath && !(isAdminPath && hasAdminBypass())) {
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

    checkMaintenanceStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}
