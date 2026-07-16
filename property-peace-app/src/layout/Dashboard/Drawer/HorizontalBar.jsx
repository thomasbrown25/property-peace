import PropTypes from 'prop-types';
import { cloneElement } from 'react';

// material-ui
import { useTheme } from '@emotion/react';
import { useScrollTrigger, AppBar, Container, Stack } from '@mui/material';

// project imports
import Navigation from './DrawerContent/Navigation';
import useConfig from 'hooks/useConfig';

function ElevationScroll({ children, window }) {
  const theme = useTheme();
  // Note that you normally won't need to set the window ref as useScrollTrigger
  // will default to window.
  // This is only being set here because the demo is in an iframe.
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
    target: window
  });

  theme.shadows[4] = theme.customShadows.z1;

  return cloneElement(children, {
    elevation: trigger ? 4 : 0
  });
}

// ==============================|| HORIZONTAL MENU LIST ||============================== //

export default function CustomAppBar() {
  const { container } = useConfig();

  return (
    <ElevationScroll>
      <AppBar
        sx={{
          top: 60,
          bgcolor: 'background.paper',
          width: '100%',
          height: 62,
          justifyContent: 'center',
          borderTop: '1px solid',
          borderTopColor: 'divider',
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
          zIndex: 1098,
          color: 'grey.500'
        }}
      >
        <Container maxWidth={container ? 'xl' : false}>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Navigation />
          </Stack>
        </Container>
      </AppBar>
    </ElevationScroll>
  );
}

ElevationScroll.propTypes = { children: PropTypes.node, window: PropTypes.any };
