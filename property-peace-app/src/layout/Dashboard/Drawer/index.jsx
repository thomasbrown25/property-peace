import PropTypes from 'prop-types';
import { useEffect, useMemo } from 'react';

import { useMediaQuery } from '@mui/material';
import { Drawer } from '@mui/material';
import { Box } from '@mui/material';

// project imports
import DrawerHeader from './DrawerHeader';
import DrawerContent from './DrawerContent';
import MiniDrawerStyled from './MiniDrawerStyled';

import { DRAWER_WIDTH } from 'config';
import { handlerDrawerOpen } from 'api/menu';
import useConfig from 'hooks/useConfig';

const DEFAULT_LIGHT_DRAWER_BACKGROUND = '#ffffff';

// ==============================|| MAIN LAYOUT - DRAWER ||============================== //

export default function MainDrawer({ window, mobileOpen = false, onMobileClose }) {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const drawerOpen = downLG ? mobileOpen : true;
  // The existing nav items read menuMaster to decide whether to display labels.
  useEffect(() => {
    handlerDrawerOpen(drawerOpen);
  }, [drawerOpen]);
  const { presetColor } = useConfig();
  const lightDrawerBackground = presetColor === 'default' ? DEFAULT_LIGHT_DRAWER_BACKGROUND : undefined;

  // responsive drawer container
  const container = window !== undefined ? () => window().document.body : undefined;

  // header content
  const drawerContent = useMemo(() => <DrawerContent />, []);
  const drawerHeader = useMemo(
    () => <DrawerHeader open={drawerOpen} lightDrawerBackground={lightDrawerBackground} />,
    [drawerOpen, lightDrawerBackground]
  );

  return (
    <Box component="nav" sx={{ flexShrink: 0, zIndex: 1200 }} aria-label="Admin navigation"
      onClick={(event) => { if (downLG && event.target.closest('a[href]')) onMobileClose(); }}>
      {!downLG ? (
        <MiniDrawerStyled variant="permanent" open={drawerOpen} lightDrawerBackground={lightDrawerBackground}>
          {drawerHeader}
          {drawerContent}
        </MiniDrawerStyled>
      ) : (
        <Drawer
          container={container}
          variant="temporary"
          open={drawerOpen}
          onClose={onMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: drawerOpen ? 'block' : 'none', lg: 'none' } }}
          slotProps={{
            paper: {
              sx: {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRight: 'none',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark' ? '4px 0 18px rgba(0, 0, 0, 0.2)' : '4px 0 18px rgba(6, 30, 53, 0.1)',
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#061e35' : theme.palette.common.white)
              }
            }
          }}
        >
          {drawerHeader}
          {drawerContent}
        </Drawer>
      )}
    </Box>
  );
}

MainDrawer.propTypes = { window: PropTypes.func, mobileOpen: PropTypes.bool, onMobileClose: PropTypes.func };
