import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import { getPostLoginRedirectPath } from 'utils/authRedirect';
import { getChecklistIntent } from 'utils/leaseTransitionChecklists.mjs';

// ==============================|| GUEST GUARD ||============================== //

export default function GuestGuard({ children }) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoggedIn) {
      // Allow logged-in tenants to access invite acceptance flow (e.g. from in-app notification)
      const pathname = location?.pathname || '';
      if (pathname.includes('/tenant/invite/')) {
        return; // Don't redirect - tenant needs to accept invite
      }
      const step = new URLSearchParams(location.search).get('step');
      if (
        location.state?.registrationCompleting &&
        pathname === '/register' &&
        (step === 'creating' || step === 'complete')
      ) {
        return;
      }
      const defaultPath = getPostLoginRedirectPath(user, location?.state?.from);
      const checklistIntent = pathname === '/register' ? getChecklistIntent(location.search) : null;
      navigate(checklistIntent && defaultPath.startsWith('/landlord/') ? `/landlord/checklists?intent=${checklistIntent}` : defaultPath, {
        state: {
          from: ''
        },
        replace: true
      });
    }
  }, [isLoggedIn, user, navigate, location]);

  return children;
}

GuestGuard.propTypes = { children: PropTypes.any };
