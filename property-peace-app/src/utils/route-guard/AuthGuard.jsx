import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import Loader from 'components/Loader';
import useRedirectUser from 'hooks/useRedirectUser';
import SuspensionBanner from 'components/account/SuspensionBanner';

// ==============================|| AUTH GUARD ||============================== //

export default function AuthGuard({ children }) {
  const { isLoggedIn, isInitialized, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Use redirect hook to automatically redirect based on user role
  // This hook will check if user is authenticated and has roles, then redirect accordingly
  useRedirectUser();

  useEffect(() => {
    // Only check authentication after context is initialized
    if (isInitialized && !isLoggedIn) {
      navigate('/login', {
        state: {
          from: location.pathname
        },
        replace: true
      });
    }
  }, [isLoggedIn, isInitialized, navigate, location]);

  // Show loader while initializing
  if (!isInitialized) {
    return <Loader />;
  }

  // Don't render children if not logged in (will redirect)
  if (!isLoggedIn) {
    return <Loader />;
  }

  // Check if user is suspended
  const isSuspended = user?.isSuspended || user?.IsSuspended || false;

  return (
    <>
      {isSuspended && <SuspensionBanner />}
      {children}
    </>
  );
}

AuthGuard.propTypes = { children: PropTypes.any };
