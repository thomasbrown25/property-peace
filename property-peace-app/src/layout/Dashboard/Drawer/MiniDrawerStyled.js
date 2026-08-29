// material-ui
import { styled } from '@mui/material/styles';
import { Drawer } from '@mui/material';

// project imports
import { DRAWER_WIDTH } from 'config';

const getDrawerBackground = (theme) => theme.palette.common.white;

const getDrawerEdge = (theme) => ({
  borderRight: `1px solid ${theme.palette.divider}`,
  boxShadow: '4px 0 18px rgba(6, 30, 53, 0.1)'
});

const openedMixin = (theme, lightDrawerBackground) => ({
  width: DRAWER_WIDTH,
  ...getDrawerEdge(theme),
  background: getDrawerBackground(theme, lightDrawerBackground),
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  }),
  overflowX: 'hidden'
});

const closedMixin = (theme, lightDrawerBackground) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),
  overflowX: 'hidden',
  width: theme.spacing(7.5),
  ...getDrawerEdge(theme),
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
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
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
