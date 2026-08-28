import { Box, Divider, Typography, Button, Stack, ListItemButton, ListItemIcon, ListItemText, List, Tooltip, alpha } from '@mui/material';
import { SettingOutlined, StarOutlined, ArrowRightOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSubscriptionStatus, useSubscription } from 'hooks/useSubscription';
import { useGetMenuMaster } from 'api/menu';
import useAuth from 'hooks/useAuth';

export default function SidebarBottomSection() {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const { status } = useSubscriptionStatus();
  const navigate = useNavigate();
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

  const isTrialActive = status?.isTrialActive || false;
  const trialDaysRemaining = status?.trialDaysRemaining ?? null;

  const { subscription, loading: subLoading } = useSubscription();
  const planName = subscription?.plan?.name?.toLowerCase() ?? '';
  const isPremium = planName === 'premium';
  const isLifetime = planName.includes('lifetime');
  const showUpgradeCard = !hasAdminRole && hasLandlordRole && !subLoading && !isPremium && !isLifetime;

  const handleBuyNow = () => {
    navigate('/landlord/settings?tab=subscription');
  };

  const isSelected = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getItemColors = (theme, selected) => {
    const hoverBg = alpha('#061e35', 0.06);
    const selectedBg = alpha('#061e35', 0.1);
    const selectedColor = '#061e35';
    const defaultTextColor = '#061e35';
    const defaultIconColor = '#061e35';

    return {
      hoverBg,
      selectedBg,
      selectedColor,
      textColor: selected ? selectedColor : defaultTextColor,
      iconColor: selected ? selectedColor : defaultIconColor,
      dividerColor: alpha('#061e35', 0.14),
      selectedBorderColor: '#061e35'
    };
  };

  const helpSupportSelected = isSelected('/landlord/support');
  const settingsSelected = isSelected('/landlord/settings') || isSelected('/tenant/settings');
  return (
    <Box sx={{ pt: 4, mb: 5 }}>
      <Divider sx={(theme) => ({ mb: 2, borderColor: getItemColors(theme, false).dividerColor })} />

      {/* Trial Status Section */}
      {/* {isTrialActive && trialDaysRemaining !== null && drawerOpen && (
        <Box sx={{ px: 2, py: 1, mb: 2, textAlign: 'center' }}>
          <Typography 
            variant="body2" 
            sx={{ 
              mb: 1, 
              color: trialDaysRemaining <= 3 ? 'error.main' : 'text.secondary',
              fontWeight: trialDaysRemaining <= 3 ? 600 : 400,
              fontFamily: "'Host Grotesk', sans-serif"
            }}
          >
            {trialDaysRemaining} days remaining
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={handleBuyNow}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            BUY NOW
          </Button>
        </Box>
      )} */}

      {/* Divider after Buy Now button */}
      {/* {isTrialActive && trialDaysRemaining !== null && drawerOpen && <Divider sx={{ mb: 2 }} />} */}

      {/* Upgrade to Pro card — only when drawer is open and user is not premium */}
      {showUpgradeCard && drawerOpen && (
        <Box
          sx={{
            mx: 2,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha('#061e35', 0.04),
            border: '1px solid',
            borderColor: alpha('#061e35', 0.12)
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
            <StarOutlined style={{ fontSize: 13, color: '#061e35' }} />
            <Typography variant="caption" fontWeight={700} sx={{ color: '#061e35', fontSize: '0.75rem' }}>
              Upgrade to Premium
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: alpha('#061e35', 0.68), fontSize: '0.7rem', display: 'block', mb: 1.25 }}>
            Unlimited agents &amp; more
          </Typography>
          <Button
            component={Link}
            to="/landlord/settings?tab=subscription"
            variant="contained"
            color="success"
            size="small"
            fullWidth
            endIcon={<ArrowRightOutlined style={{ fontSize: 11 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
              py: 0.5,
              borderRadius: 1.5
            }}
          >
            See plans
          </Button>
        </Box>
      )}

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
                          fontFamily: "'Host Grotesk', sans-serif",
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
                          fontFamily: "'Host Grotesk', sans-serif",
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

