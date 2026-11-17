import { Box, Divider, Typography, ListItemButton, ListItemIcon, ListItemText, List, Tooltip, alpha } from '@mui/material';
import { SettingOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

import { useGetMenuMaster } from 'api/menu';
import useAuth from 'hooks/useAuth';

export default function SidebarBottomSection() {

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;


  const location = useLocation();
  const auth = useAuth();
  // Get roles from JWTContext - ensure it's an array
  const userRoles = Array.isArray(auth?.user?.Roles) 
    ? auth?.user?.Roles 
    : Array.isArray(auth?.user?.roles) 
    ? auth?.user?.roles 
    : [];

  // Normalize roles to lowercase for case-insensitive comparison
  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const hasAdminRole = normalizedRoles.includes('admin');
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const hasTenantRole = normalizedRoles.includes('tenant');



  const isSelected = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getItemColors = (theme, selected) => {
    const darkChrome = theme.palette.mode === 'dark';
    const foreground = darkChrome ? '#ffffff' : theme.palette.brand.forest;
    const hoverBg = alpha(foreground, 0.06);
    const selectedBg = alpha(foreground, 0.1);
    const selectedColor = foreground;
    const defaultTextColor = foreground;
    const defaultIconColor = foreground;

    return {
      hoverBg,
      selectedBg,
      selectedColor,
      textColor: selected ? selectedColor : defaultTextColor,
      iconColor: selected ? selectedColor : defaultIconColor,
      dividerColor: alpha(foreground, 0.14),
      selectedBorderColor: darkChrome ? '#56b983' : theme.palette.brand.forest
    };
  };

  const helpSupportSelected = isSelected('/landlord/support');
  const settingsSelected = isSelected('/landlord/settings') || isSelected('/tenant/settings');
  return (
    <Box sx={{ pt: 4, mb: 5 }}>
      <Divider sx={(theme) => ({ mb: 2, borderColor: getItemColors(theme, false).dividerColor })} />



      {/* Bottom Menu Items - Hide for admin */}
      {!hasAdminRole && (
        <List disablePadding>
          {/* Support - Visible for landlord only (directly above Settings) */}
          {hasLandlordRole && (
            <Tooltip title={!drawerOpen ? 'Support' : ''} placement="right" arrow disableHoverListener={drawerOpen}>
              <ListItemButton
                component={Link}
                to="/landlord/support/ticket"
                selected={helpSupportSelected}
                sx={(theme) => {
                  const colors = getItemColors(theme, helpSupportSelected);
                  return {
                    pl: drawerOpen ? 3 : 1.5,
                    py: 1,
                    '&:hover': { bgcolor: colors.hoverBg },
                    '&.Mui-selected': {
                      bgcolor: drawerOpen ? colors.selectedBg : 'transparent',
                      ...(drawerOpen && {
                        borderRight: '2px solid',
                        borderColor: colors.selectedBorderColor,
                        color: colors.selectedColor,
                        '& .MuiListItemIcon-root': { color: `${colors.selectedColor} !important` }
                      }),
                      '&:hover': { bgcolor: drawerOpen ? colors.selectedBg : 'transparent' }
                    }
                  };
                }}
              >
                <ListItemIcon
                  sx={(theme) => {
                    const colors = getItemColors(theme, helpSupportSelected);
                    return {
                      minWidth: 28,
                      color: `${colors.iconColor} !important`,
                      ...(!drawerOpen && {
                        borderRadius: 1.5,
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': { bgcolor: colors.hoverBg }
                      }),
                      ...(!drawerOpen && helpSupportSelected && {
                        bgcolor: colors.selectedBg,
                        '&:hover': { bgcolor: colors.selectedBg }
                      })
                    };
                  }}
                >
                  <CustomerServiceOutlined style={{ fontSize: drawerOpen ? '1rem' : '1.25rem' }} />
                </ListItemIcon>
                {drawerOpen && (
                  <ListItemText
                    primary={
                      <Typography
                        variant="h6"
                        sx={(theme) => ({
                          color: getItemColors(theme, helpSupportSelected).textColor,
                          fontFamily: "'Inter', sans-serif",
                          fontSize: '0.875rem',
                          fontWeight: 700
                        })}
                      >
                        Support
                      </Typography>
                    }
                  />
                )}
              </ListItemButton>
            </Tooltip>
          )}
          {/* Settings - Visible for both landlord and tenant */}
          <Tooltip title={!drawerOpen ? 'Settings' : ''} placement="right" arrow disableHoverListener={drawerOpen}>
            <ListItemButton
              component={Link}
              to={hasTenantRole ? "/tenant/settings" : "/landlord/settings"}
              selected={settingsSelected}
              sx={(theme) => {
                const colors = getItemColors(theme, settingsSelected);
                return {
                  pl: drawerOpen ? 3 : 1.5,
                  py: 1,
                  '&:hover': { bgcolor: colors.hoverBg },
                  '&.Mui-selected': {
                    bgcolor: drawerOpen ? colors.selectedBg : 'transparent',
                    ...(drawerOpen && {
                      borderRight: '2px solid',
                      borderColor: colors.selectedBorderColor,
                      color: colors.selectedColor,
                      '& .MuiListItemIcon-root': { color: `${colors.selectedColor} !important` }
                    }),
                    '&:hover': { bgcolor: drawerOpen ? colors.selectedBg : 'transparent' }
                  }
                };
              }}
            >
                <ListItemIcon
                  sx={(theme) => {
                    const colors = getItemColors(theme, settingsSelected);
                    return {
                      minWidth: 28,
                      color: `${colors.iconColor} !important`,
                      ...(!drawerOpen && {
                        borderRadius: 1.5,
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': { bgcolor: colors.hoverBg }
                      }),
                      ...(!drawerOpen && settingsSelected && {
                        bgcolor: colors.selectedBg,
                        '&:hover': { bgcolor: colors.selectedBg }
                      })
                    };
                  }}
                >
                  <SettingOutlined style={{ fontSize: drawerOpen ? '1rem' : '1.25rem' }} />
                </ListItemIcon>
                {drawerOpen && (
                  <ListItemText
                    primary={
                      <Typography
                        variant="h6"
                        sx={(theme) => ({
                          color: getItemColors(theme, settingsSelected).textColor,
                          fontFamily: "'Inter', sans-serif",
                          fontSize: '0.875rem',
                          fontWeight: 700
                        })}
                      >
                        Settings
                      </Typography>
                    }
                  />
                )}
              </ListItemButton>
            </Tooltip>

        </List>
      )}
    </Box>
  );
}

