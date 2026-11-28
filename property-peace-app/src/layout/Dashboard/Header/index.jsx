import PropTypes from 'prop-types';
import { AppBar, IconButton, Toolbar, Tooltip } from '@mui/material';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from 'config';
import { portalHeaderColors } from 'themes/brand';
import { LANDLORD_SIDEBAR_WIDTH } from '../LandlordSidebar';
import HeaderContent from './HeaderContent';

export const HEADER_HEIGHT = { xs: 52, sm: 60 };
export const TENANT_HEADER_HEIGHT = { xs: 96, sm: 104, md: HEADER_HEIGHT.sm };
const desktopMenuButtonSx = { display: { xs: 'none', lg: 'inline-flex' }, color: 'inherit' };

export default function Header({
  adminPortal = false,
  landlordPortal = false,
  tenantPortal = false,
  adminDesktopMenuOpen = true,
  landlordDesktopMenuOpen = true,
  landlordSidebarWidth = LANDLORD_SIDEBAR_WIDTH,
  onAdminMenuToggle,
  onAdminMenuOpen,
  onLandlordMenuToggle,
  onLandlordMenuOpen
}) {
  const height = tenantPortal ? TENANT_HEADER_HEIGHT : HEADER_HEIGHT;
  const sidebarWidth = adminPortal ? (adminDesktopMenuOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH) : landlordSidebarWidth;
  const adminMenuLabel = adminDesktopMenuOpen ? 'Collapse admin navigation' : 'Expand admin navigation';
  const landlordMenuLabel = landlordDesktopMenuOpen ? 'Collapse property navigation' : 'Expand property navigation';

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={(theme) => ({
        ...portalHeaderColors(theme.palette.mode),
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        boxShadow: theme.palette.mode === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.22)' : '0 4px 14px rgba(16, 44, 41, 0.06)',
        zIndex: theme.zIndex.appBar,
        width: adminPortal || landlordPortal ? { xs: '100%', lg: `calc(100% - ${sidebarWidth}px)` } : '100%',
        ...((adminPortal || landlordPortal) && { ml: { lg: `${sidebarWidth}px` } })
      })}
    >
      <Toolbar sx={{ minHeight: height, height, py: 0, px: { xs: 2, sm: 2.5 }, gap: { xs: 1, sm: 2 } }}>
        {adminPortal && (
          <Tooltip title={adminMenuLabel}>
            <IconButton
              aria-label={adminMenuLabel}
              aria-controls="admin-navigation"
              aria-expanded={adminDesktopMenuOpen}
              onClick={onAdminMenuToggle}
              sx={desktopMenuButtonSx}
            >
              {adminDesktopMenuOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            </IconButton>
          </Tooltip>
        )}
        {landlordPortal && onLandlordMenuToggle && (
          <Tooltip title={landlordMenuLabel}>
            <IconButton
              aria-label={landlordMenuLabel}
              aria-controls="landlord-property-navigation"
              aria-expanded={landlordDesktopMenuOpen}
              onClick={onLandlordMenuToggle}
              sx={desktopMenuButtonSx}
            >
              {landlordDesktopMenuOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            </IconButton>
          </Tooltip>
        )}
        <HeaderContent adminPortal={adminPortal} landlordPortal={landlordPortal} tenantPortal={tenantPortal} onAdminMenuOpen={onAdminMenuOpen} onLandlordMenuOpen={onLandlordMenuOpen} />
      </Toolbar>
    </AppBar>
  );
}

Header.propTypes = {
  adminPortal: PropTypes.bool,
  landlordPortal: PropTypes.bool,
  tenantPortal: PropTypes.bool,
  adminDesktopMenuOpen: PropTypes.bool,
  landlordDesktopMenuOpen: PropTypes.bool,
  landlordSidebarWidth: PropTypes.number,
  onAdminMenuToggle: PropTypes.func,
  onAdminMenuOpen: PropTypes.func,
  onLandlordMenuToggle: PropTypes.func,
  onLandlordMenuOpen: PropTypes.func
};
