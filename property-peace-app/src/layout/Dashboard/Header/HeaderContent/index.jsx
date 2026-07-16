import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMediaQuery, IconButton, Tooltip } from '@mui/material';
import { Box } from '@mui/material';
import { SettingOutlined } from '@ant-design/icons';

// project imports
import Search from './Search';
import Message from './Message';
import Profile from './Profile';
import Localization from './Localization';
import Notification from './Notification';
import Support from './Support';
import FullScreen from './FullScreen';
import FinishSetup from 'sections/landlord/dashboard/FinishSetup';
import MobileSection from './MobileSection';
import MegaMenuSection from './MegaMenuSection';
import Logo from 'components/logo';

import useConfig from 'hooks/useConfig';
import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';
import useLandlordSetupSteps from 'hooks/useLandlordSetupSteps';
import { MenuOrientation } from 'config';
import DrawerHeader from 'layout/Dashboard/Drawer/DrawerHeader';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const { menuOrientation } = useConfig();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const isXs = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // Get roles from user
  const userRoles = Array.isArray(user?.Roles) ? user?.Roles : Array.isArray(user?.roles) ? user?.roles : [];

  // Normalize roles to lowercase for case-insensitive comparison
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const [finishSetupOpen, setFinishSetupOpen] = useState(false);
  const setupState = useLandlordSetupSteps(() => setFinishSetupOpen(false));
  const showFinishSetup = hasLandlordRole && !hasTenantRole && !isAdmin && !setupState.isLoading && !setupState.isComplete;

  // Determine base path based on role (priority: Admin > Tenant > Landlord)
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';

  const handleSettingsClick = () => {
    navigate(`${basePath}/settings`);
  };

  const handleNotificationsClick = () => {
    navigate(`${basePath}/notifications`);
  };

  //const localization = useMemo(() => <Localization />, []);

  //const megaMenu = useMemo(() => <MegaMenuSection />, []);

  return (
    <>
      {menuOrientation === MenuOrientation.HORIZONTAL && !downMD && <DrawerHeader open={true} />}
      {!downMD && !hasTenantRole && <Search shrink={showFinishSetup} />}
      {!downMD && hasTenantRole && <Box sx={{ flex: 1 }} />}
      {/* {!downMD && megaMenu} */}
      {/* {!downMD && localization} */}
      {downMD && (
        <Box
          sx={{
            width: '100%',
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

      {/* Azure-style navbar icons */}
      {!downMD && (
        <>
          {showFinishSetup && (
            <Box sx={{ flexShrink: 0, mr: 0.75 }}>
              <FinishSetup
                open={finishSetupOpen}
                onOpen={() => setFinishSetupOpen(true)}
                onClose={() => setFinishSetupOpen(false)}
                steps={setupState.steps}
                compact
              />
            </Box>
          )}

          {/* Notifications - dropdown with view all option */}
          <Notification />

          {/* Settings */}
          <Tooltip title="Settings">
            <IconButton
              color="secondary"
              onClick={handleSettingsClick}
              sx={(theme) => ({
                color: 'text.primary',
                transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
                  duration: theme.transitions.duration.shorter
                }),
                '&:hover': {
                  bgcolor: 'action.hover',
                  boxShadow: 'none',
                  transform: 'translateY(-1px)'
                },
                ...theme.applyStyles('dark', { '&:hover': { bgcolor: 'action.hover' } })
              })}
            >
              <SettingOutlined />
            </IconButton>
          </Tooltip>

          {/* Support - dropdown menu with 3 options */}
          {hasLandlordRole && !hasTenantRole && !isAdmin && <Support />}
        </>
      )}

      {/* Messages - keep for now but can be removed if not needed */}
      {!downMD && <Message />}

      {/* FullScreen - can be removed if not needed */}
      {!downMD && <FullScreen />}

      {/* Profile */}
      {!downMD && <Profile />}
      {downMD && <MobileSection />}
    </>
  );
}
