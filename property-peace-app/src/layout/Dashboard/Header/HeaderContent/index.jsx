import { Divider, useMediaQuery } from '@mui/material';
import { Box } from '@mui/material';

// project imports
import Search from './Search';
import Message from './Message';
import Profile from './Profile';
import Notification from './Notification';

import MobileSection from './MobileSection';
import MobileSearch from './MobileSearch';
import Logo from 'components/logo';

import useConfig from 'hooks/useConfig';
import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';

import { MenuOrientation } from 'config';
import DrawerHeader from 'layout/Dashboard/Drawer/DrawerHeader';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const { menuOrientation } = useConfig();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const isXs = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // Get roles from user
  const userRoles = Array.isArray(user?.Roles) ? user?.Roles : Array.isArray(user?.roles) ? user?.roles : [];

  // Normalize roles to lowercase for case-insensitive comparison
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');


  // Determine base path based on role (priority: Admin > Tenant > Landlord)
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';

  return (
    <>
      {menuOrientation === MenuOrientation.HORIZONTAL && !downMD && <DrawerHeader open={true} />}
      {!downMD && !hasTenantRole && <Search />}
      {!downMD && hasTenantRole && <Box sx={{ flex: 1 }} />}
      {/* {!downMD && megaMenu} */}
      {/* {!downMD && localization} */}
      {downMD && (
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: { xs: 60, sm: 64 },
            ml: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {isXs && (
            <Logo
              reverse
              disableTopPadding
              lightHeaderLogo
              width={126}
              to={`${basePath}/dashboard`}
              sx={{ width: 'auto', height: 46, lineHeight: 0, display: 'flex', alignItems: 'center' }}
            />
          )}
        </Box>
      )}

      {/* Desktop command bar */}
      {!downMD && (
        <>
          <Message />
          <Notification />
          <Divider orientation="vertical" flexItem sx={{ height: 28, alignSelf: 'center', mx: 1 }} />
          <Profile />
        </>
      )}
      {downMD && !hasTenantRole && <MobileSearch />}
      {downMD && <MobileSection />}
    </>
  );
}
