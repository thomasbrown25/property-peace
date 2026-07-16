import { useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import useAuth from 'hooks/useAuth';

// ==============================|| TOKEN EXPIRATION CHECKER ||============================== //

/**
 * Component that periodically checks if the JWT token is expired
 * and automatically logs out the user if the token has expired.
 * 
 * This runs as a lightweight background checker without requiring
 * API calls - it simply decodes the JWT token to check its expiration.
 */
export default function TokenExpirationChecker() {
  const { isLoggedIn, logout } = useAuth();

  useEffect(() => {
    // Only check if user is authenticated/logged in
    if (!isLoggedIn) {
      return;
    }

    /**
     * Check if token is expired by decoding it
     */
    const checkTokenExpiration = () => {
      try {
        const token = localStorage.getItem('serviceToken') || localStorage.getItem('token');
        
        if (!token) {
          // No token found, user should be logged out
          return;
        }

        try {
          const decoded = jwtDecode(token);
          const currentTime = Date.now() / 1000; // Current time in seconds
          
          // Check if token is expired
          if (decoded.exp < currentTime) {
            console.log('Token expired, logging out user...');
            logout();
            
            // Redirect to login page if not already there
            if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) {
              window.location.href = '/login';
            }
          }
        } catch (decodeError) {
          // Token cannot be decoded, consider it invalid
          console.error('Token decode error:', decodeError);
          logout();
          if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) {
            window.location.href = '/login';
          }
        }
      } catch (error) {
        console.error('Error checking token expiration:', error);
      }
    };

    // Check immediately on mount
    checkTokenExpiration();

    // Set up interval to check every 30 seconds
    // This is a lightweight check that just decodes the token (no API call)
    const intervalId = setInterval(checkTokenExpiration, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [isLoggedIn, logout]);

  // This component doesn't render anything
  return null;
}

