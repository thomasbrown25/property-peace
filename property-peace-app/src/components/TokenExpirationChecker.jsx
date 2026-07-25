import { useEffect } from 'react';
import useAuth from 'hooks/useAuth';
import { refreshAccessToken, shouldRefreshToken } from 'utils/axios';

// ==============================|| TOKEN EXPIRATION CHECKER ||============================== //

/**
 * Proactively refreshes the access token before it expires. The Axios response
 * interceptor provides the reactive fallback when the API still returns 401.
 */
export default function TokenExpirationChecker() {
  const { isLoggedIn, logout } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const ensureFreshToken = async () => {
      const token = localStorage.getItem('serviceToken') || localStorage.getItem('token');
      if (!token || !shouldRefreshToken(token)) return;

      try {
        await refreshAccessToken();
      } catch (error) {
        logout();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') ensureFreshToken();
    };

    ensureFreshToken();
    const intervalId = window.setInterval(ensureFreshToken, 30000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, logout]);

  return null;
}
