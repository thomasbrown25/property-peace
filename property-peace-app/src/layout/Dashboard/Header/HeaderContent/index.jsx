import { Box, Divider, useMediaQuery, useTheme } from '@mui/material';
import Message from './Message';
import Profile from './Profile';
import Notification from './Notification';
import MobileSection from './MobileSection';
import MobileSearch from './MobileSearch';
import LandlordPrimaryNavigation from './LandlordPrimaryNavigation';
import Logo from 'components/logo';
import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';

export default function HeaderContent() {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const roles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  const hasTenantRole = roles.some((role) => String(role).toLowerCase().trim() === 'tenant');
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';

  return (
    <>
      <Logo
        reverse
        darkSurface={theme.palette.mode === 'dark'}
        disableTopPadding
        lightHeaderLogo={theme.palette.mode !== 'dark'}
        width={downSM ? 94 : downMD ? 116 : 142}
        to={`${basePath}/dashboard`}
        sx={{ flexShrink: 0, lineHeight: 0, display: 'flex', alignItems: 'center' }}
      />
      {!isAdmin && !hasTenantRole && <LandlordPrimaryNavigation />}
      <Box sx={{ flex: 1, minWidth: 0 }} />
      {!downMD && (
        <>
          {!hasTenantRole && <MobileSearch />}
          <Message />
          <Notification />
          <Divider orientation="vertical" flexItem sx={{ height: 28, alignSelf: 'center', mx: 1, borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'divider' }} />
          <Profile />
        </>
      )}
      {downMD && !hasTenantRole && <MobileSearch />}
      {downMD && <MobileSection />}
    </>
  );
}
