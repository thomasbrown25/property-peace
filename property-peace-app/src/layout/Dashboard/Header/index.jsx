import PropTypes from 'prop-types';
import { AppBar, Toolbar } from '@mui/material';
import { DRAWER_WIDTH } from 'config';
import { LANDLORD_SIDEBAR_WIDTH } from '../LandlordSidebar';
import HeaderContent from './HeaderContent';

export default function Header({ adminPortal = false, landlordPortal = false, onAdminMenuOpen, onLandlordMenuOpen }) {
  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={(theme) => ({
        bgcolor: theme.palette.mode === 'dark' ? theme.palette.brand.forest : '#F8F7F1',
        color: theme.palette.mode === 'dark' ? theme.palette.brand.ivory : theme.palette.brand.forest,
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        boxShadow: theme.palette.mode === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.22)' : '0 4px 14px rgba(16, 44, 41, 0.06)',
        zIndex: theme.zIndex.appBar,
        width: adminPortal ? { xs: '100%', lg: `calc(100% - ${DRAWER_WIDTH}px)` } : landlordPortal ? { xs: '100%', lg: `calc(100% - ${LANDLORD_SIDEBAR_WIDTH}px)` } : '100%',
        ...((adminPortal || landlordPortal) && { ml: { lg: `${adminPortal ? DRAWER_WIDTH : LANDLORD_SIDEBAR_WIDTH}px` } })
      })}
    >
      <Toolbar sx={{ minHeight: { xs: 52, sm: 60 }, height: { xs: 52, sm: 60 }, py: 0, px: { xs: 2, sm: 2.5 }, gap: { xs: 1, sm: 2 } }}>
        <HeaderContent adminPortal={adminPortal} landlordPortal={landlordPortal} onAdminMenuOpen={onAdminMenuOpen} onLandlordMenuOpen={onLandlordMenuOpen} />
      </Toolbar>
    </AppBar>
  );
}

Header.propTypes = { adminPortal: PropTypes.bool, landlordPortal: PropTypes.bool, onAdminMenuOpen: PropTypes.func, onLandlordMenuOpen: PropTypes.func };
