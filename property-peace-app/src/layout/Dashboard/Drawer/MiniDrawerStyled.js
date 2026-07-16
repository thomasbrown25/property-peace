// material-ui
import { styled } from '@mui/material/styles';
import { Drawer } from '@mui/material';

// project imports
import { DRAWER_WIDTH } from 'config';

const getDrawerBackground = (theme, lightDrawerBackground) =>
  theme.palette.mode === 'dark' ? theme.palette.background.default : lightDrawerBackground || theme.palette.primary.main;

const openedMixin = (theme, lightDrawerBackground) => ({
  width: DRAWER_WIDTH,
  borderRight: 'none',
  background: getDrawerBackground(theme, lightDrawerBackground),
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  }),
  overflowX: 'hidden',
  boxShadow: 'none',
  ...theme.applyStyles('dark', { boxShadow: theme.customShadows.z1 })
});

const closedMixin = (theme, lightDrawerBackground) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),
  overflowX: 'hidden',
  width: theme.spacing(7.5),
  borderRight: 'none',
  boxShadow: theme.customShadows.z1,
  background: getDrawerBackground(theme, lightDrawerBackground)
});

// ==============================|| DRAWER - MINI STYLED ||============================== //

const MiniDrawerStyled = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' && prop !== 'lightDrawerBackground' })(
  ({ theme, lightDrawerBackground }) => ({
    width: DRAWER_WIDTH,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    '& .MuiDrawer-paper': {
      background: getDrawerBackground(theme, lightDrawerBackground)
    },
    variants: [
      {
        props: ({ open }) => open,
        style: {
          ...openedMixin(theme, lightDrawerBackground),
          '& .MuiDrawer-paper': {
            ...openedMixin(theme, lightDrawerBackground),
            background: getDrawerBackground(theme, lightDrawerBackground)
          }
        }
      },
      {
        props: ({ open }) => !open,
        style: {
          ...closedMixin(theme, lightDrawerBackground),
          '& .MuiDrawer-paper': {
            ...closedMixin(theme, lightDrawerBackground),
            background: getDrawerBackground(theme, lightDrawerBackground)
          }
        }
      }
    ]
  })
);

export default MiniDrawerStyled;
