import { useEffect } from 'react';
import useAuth from 'hooks/useAuth';
import { checkImpersonationStatus, ensureActiveAccessToken } from 'utils/axios';
import { getActiveAccessToken, isImpersonating, notifyImpersonationExpired } from 'utils/impersonationSession';

export default function TokenExpirationChecker() {
  const { isLoggedIn, logout } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const ensureFreshToken = async () => {
      const token = getActiveAccessToken();
      if (!token) return;
      try {
        await ensureActiveAccessToken();
        if (isImpersonating()) await checkImpersonationStatus();
      } catch {
        if (isImpersonating()) notifyImpersonationExpired();
        else logout();
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
