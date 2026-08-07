import { Navigate, useLocation } from 'react-router-dom';
import Loader from 'components/Loader';
import useAuth from 'hooks/useAuth';

const rolesFor = (user) => {
  const raw = user?.Roles ?? user?.roles ?? user?.Role ?? user?.role ?? [];
  return (Array.isArray(raw) ? raw : [raw]).map((role) => String(role).trim().toLowerCase());
};

// Screening staff endpoints authorize only Landlord/Admin. Mirror that boundary
// in routing so tenant/client users do not enter a workspace they cannot use.
export default function ScreeningStaffRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth?.isInitialized) return <Loader />;
  if (!auth?.isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!rolesFor(auth.user).some((role) => role === 'landlord' || role === 'admin')) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }
  return children;
}
