import PropTypes from 'prop-types';
import { AppBar, Toolbar } from '@mui/material';
import { DRAWER_WIDTH } from 'config';
import HeaderContent from './HeaderContent';

export default function Header({ adminPortal = false, onAdminMenuOpen }) {
  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={(theme) => ({
        bgcolor: theme.palette.mode === 'dark' ? theme.palette.brand.forest : theme.palette.background.paper,
        color: theme.palette.mode === 'dark' ? theme.palette.brand.ivory : theme.palette.brand.forest,
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        boxShadow: theme.palette.mode === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.22)' : '0 4px 14px rgba(16, 44, 41, 0.06)',
        zIndex: theme.zIndex.appBar,
        width: adminPortal ? { xs: '100%', lg: `calc(100% - ${DRAWER_WIDTH}px)` } : '100%',
        ...(adminPortal && { ml: { lg: `${DRAWER_WIDTH}px` } })
      })}
    >
      <Toolbar sx={{ minHeight: { xs: 68, sm: 84 }, height: { xs: 68, sm: 84 }, py: 0, px: { xs: 2, sm: 2.5 }, gap: { xs: 1, sm: 2 } }}>
        <HeaderContent adminPortal={adminPortal} onAdminMenuOpen={onAdminMenuOpen} />
      </Toolbar>
    </AppBar>
  );
}

Header.propTypes = { adminPortal: PropTypes.bool, onAdminMenuOpen: PropTypes.func };
