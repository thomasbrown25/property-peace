import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { MenuOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Box, Divider, IconButton, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import Message from './Message';
import Profile from './Profile';
import Notification from './Notification';
import MobileSection from './MobileSection';
import MobileSearch from './MobileSearch';
import LandlordPrimaryNavigation from './LandlordPrimaryNavigation';
import TenantPrimaryNavigation from './TenantPrimaryNavigation';
import Logo from 'components/logo';
import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';


export default function HeaderContent({ adminPortal = false, landlordPortal = false, tenantPortal = false, onAdminMenuOpen, onLandlordMenuOpen }) {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const roles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  const hasTenantRole = roles.some((role) => String(role).toLowerCase().trim() === 'tenant');
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';

  return (
    <Box sx={{
      display: tenantPortal ? 'grid' : 'flex',
      alignItems: 'center',
      columnGap: { xs: 1, sm: 2 },
      width: '100%',
      minWidth: 0,
      ...(tenantPortal && {
        height: '100%',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
        gridTemplateRows: { xs: 'minmax(0, 1fr) 44px', md: '1fr' },
        gridTemplateAreas: { xs: '"logo actions" "navigation navigation"', md: '"logo navigation actions"' }
      })
    }}>
      <Box sx={{ display: landlordPortal ? { xs: 'flex', lg: 'none' } : 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, minWidth: 0, ...(tenantPortal && { gridArea: 'logo' }) }}>
      {adminPortal && (
        <IconButton aria-label="Open admin navigation" onClick={onAdminMenuOpen} sx={{ display: { xs: 'inline-flex', lg: 'none' }, color: 'inherit' }}>
          <MenuOutlined />
        </IconButton>
      )}
      {landlordPortal && (
        <IconButton aria-label="Open landlord navigation" onClick={onLandlordMenuOpen} sx={{ display: { xs: 'inline-flex', lg: 'none' }, color: 'inherit' }}>
          <MenuOutlined />
        </IconButton>
      )}
      <Logo
        reverse
        darkSurface={theme.palette.mode === 'dark'}
        disableTopPadding
        lightHeaderLogo={theme.palette.mode !== 'dark'}
        width={downSM ? 82 : downMD ? 100 : 120}
        to={`${basePath}/dashboard`}
        sx={{ flexShrink: 0, lineHeight: 0, display: landlordPortal ? { xs: 'flex', lg: 'none' } : 'flex', alignItems: 'center' }}
      />
      </Box>
      {tenantPortal ? <TenantPrimaryNavigation /> : <Box sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        justifyContent: 'center',
        height: 60,
        // On roomy screens, center the links in the area beside the property rail,
        // rather than in the space left over after the header actions.
        ...(landlordPortal && {
          ml: { lg: 8 },
          '@media (min-width: 1280px)': { ml: 0, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }
        })
      }}>
        {landlordPortal && <LandlordPrimaryNavigation />}
      </Box>}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: { xs: 1, sm: 2 }, flexShrink: 0, ...(tenantPortal && { gridArea: 'actions' }), ...(landlordPortal && { '@media (min-width: 1280px)': { ml: 'auto' } }) }}>
        {!hasTenantRole && <MobileSearch />}
        <Message />
        <Notification />
        {tenantPortal && (
          <Tooltip title="Support">
            <IconButton component={Link} to="/tenant/help" aria-label="Support" sx={{ color: 'text.primary' }}>
              <QuestionCircleOutlined aria-hidden="true" />
            </IconButton>
          </Tooltip>
        )}
        {!downMD && (
          <>
            <Divider orientation="vertical" flexItem sx={{ height: 28, alignSelf: 'center', mx: 1, borderColor: 'divider' }} />
            <Profile />
          </>
        )}
        {downMD && <MobileSection />}
      </Box>
    </Box>
  );
}

HeaderContent.propTypes = { adminPortal: PropTypes.bool, landlordPortal: PropTypes.bool, tenantPortal: PropTypes.bool, onAdminMenuOpen: PropTypes.func, onLandlordMenuOpen: PropTypes.func };
