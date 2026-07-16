import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box,
  Badge,
  Drawer,
  Fab,
  Grid,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Typography,
  Button,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  DashboardOutlined,
  HomeOutlined,
  MessageOutlined,
  AppstoreOutlined,
  PlusOutlined,
  HomeFilled,
  WalletOutlined,
  BarChartOutlined,
  DollarCircleOutlined,
  ToolOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { StarOutlined, CreditCardOutlined, SettingOutlined } from '@ant-design/icons';

import { useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import { useSubscription } from 'hooks/useSubscription';
import { useDrawer } from 'contexts/DrawerContext';
import { selectConversations } from 'store/conversation/conversation.selector';
import pages from 'menu-items/pages';

// Flatten all landlord menu items (no section titles) and add Subscription + Settings
const flattenedLandlordItems = (() => {
  const items = [];
  const groups = Array.isArray(pages) ? pages : [pages];
  groups.forEach((group) => {
    if (group.children && Array.isArray(group.children)) {
      group.children.forEach((child) => {
        if (child.type === 'item' && child.id && child.title && child.url) {
          items.push({ id: child.id, title: child.title, url: child.url, icon: child.icon, disabled: child.disabled });
        }
      });
    }
  });
  items.push({ id: 'subscription', title: 'Subscription', url: '/landlord/subscription', icon: CreditCardOutlined });
  items.push({ id: 'settings', title: 'Settings', url: '/landlord/settings', icon: SettingOutlined });
  return items;
})();

const textColor = '#fff';
const iconColor = 'rgba(255, 255, 255, 0.9)';
const activeBg = 'rgba(255, 255, 255, 0.12)';
const LIGHT_DRAWER_BACKGROUND = '#061e35';

export default function BottomNavBar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = useAuth();
  const drawer = useDrawer();
  const conversations = useSelector(selectConversations);
  const messagesUnreadCount = (conversations || []).reduce((sum, conv) => sum + (conv.unreadCount ?? conv.UnreadCount ?? 0), 0);

  const userRoles = Array.isArray(auth?.user?.Roles) ? auth?.user?.Roles : Array.isArray(auth?.user?.roles) ? auth?.user?.roles : [];
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const hasAdminRole = normalizedRoles.includes('admin');

  const { subscription, loading: subscriptionLoading } = useSubscription();
  const planName = subscription?.plan?.name?.toLowerCase() ?? '';
  const isPremium = planName === 'premium';
  const isLifetime = planName.includes('lifetime');
  const subscriptionUrl = '/landlord/subscription?tab=0';
  const showUpgrade = !subscriptionLoading && !isPremium && !isLifetime;

  const [moreOpen, setMoreOpen] = useState(false);
  const [plusMenuAnchor, setPlusMenuAnchor] = useState(null);

  const isActive = (url) => pathname === url || pathname.startsWith(url + '/');

  const handleNav = (url) => {
    setMoreOpen(false);
    navigate(url);
  };

  const handlePlusAction = (action) => {
    setPlusMenuAnchor(null);
    if (action === 'property') drawer.openPropertyAddWorkflowDrawer();
    else if (action === 'expense') drawer.openExpenseAddDrawer();
    else if (action === 'viewExpenses') navigate('/landlord/expenses');
    else if (action === 'payment') drawer.openPaymentAddDrawer();
    else if (action === 'maintenance') drawer.openMaintenanceAddDrawer();
  };

  if (!hasLandlordRole) return null;

  const barHeight = 80;
  const isDarkMode = theme.palette.mode === 'dark';
  const bottomNavBg = isDarkMode ? theme.palette.background.default : LIGHT_DRAWER_BACKGROUND;
  const bottomNavSolidBg = isDarkMode ? theme.palette.background.default : '#061e35';
  const bottomNavBorder = isDarkMode ? theme.palette.divider : 'rgba(255, 255, 255, 0.08)';
  const quickActionRing = isDarkMode ? 'rgba(255, 255, 255, 0.42)' : 'transparent';
  const quickActionInnerBorder = isDarkMode ? alpha(theme.palette.common.white, 0.26) : 'rgba(59, 130, 246, 0.22)';
  const quickActionGlow = isDarkMode ? 'rgba(24, 119, 242, 0.42)' : 'rgba(4, 34, 56, 0.36)';
  // Use max() so when iOS Safari hides its UI and reports 0, we keep a minimum and the bar doesn't jump
  const safeBottom = 'max(env(safe-area-inset-bottom, 0px), 20px)';

  return (
    <>
      {/* Sticky bottom bar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: barHeight,
          minHeight: barHeight,
          paddingTop: 2,
          paddingBottom: safeBottom,
          background: bottomNavBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: theme.zIndex.appBar,
          borderTop: '1px solid',
          borderColor: bottomNavBorder
        }}
      >
        {/* Dashboard */}
        <ListItemButton
          component={Link}
          to="/landlord/dashboard"
          onClick={() => {
            setMoreOpen(false);
            setPlusMenuAnchor(null);
          }}
          sx={{
            flex: 1,
            flexDirection: 'column',
            py: 0.5,
            minWidth: 0,
            color: textColor,
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
            '&.Mui-selected': { bgcolor: 'transparent' },
            borderRadius: 0
          }}
        >
          <DashboardOutlined style={{ fontSize: 25, marginBottom: 2, color: '#fff' }} />
          <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1, color: 'inherit' }}>
            Dashboard
          </Typography>
        </ListItemButton>

        {/* Properties */}
        <ListItemButton
          component={Link}
          to="/landlord/properties"
          onClick={() => {
            setMoreOpen(false);
            setPlusMenuAnchor(null);
          }}
          sx={{
            flex: 1,
            flexDirection: 'column',
            py: 0.5,
            minWidth: 0,
            color: textColor,
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
            borderRadius: 0
          }}
        >
          <HomeOutlined style={{ fontSize: 25, marginBottom: 2, color: '#fff' }} />
          <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1, color: 'inherit' }}>
            Properties
          </Typography>
        </ListItemButton>

        {/* Plus (circular FAB) - larger and extends above the navbar */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            flex: 1,
            minWidth: 0,
            background: bottomNavBg
          }}
        >
          <Fab
            aria-label="add"
            onClick={(e) => {
              setMoreOpen(false);
              setPlusMenuAnchor((prev) => (prev ? null : e.currentTarget));
            }}
            sx={{
              bgcolor: bottomNavSolidBg,
              backgroundImage: isDarkMode
                ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${bottomNavSolidBg} 100%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${bottomNavSolidBg} 100%)`,
              boxShadow:
                !plusMenuAnchor && !moreOpen
                  ? isDarkMode
                    ? `0 0 0 4px ${quickActionRing}, 0 14px 30px ${quickActionGlow}`
                    : `0 14px 30px ${quickActionGlow}`
                  : `0 8px 18px ${alpha(theme.palette.common.black, 0.22)}`,
              border: '2px solid',
              borderColor: !plusMenuAnchor && !moreOpen ? quickActionInnerBorder : bottomNavBorder,
              color: '#fff',
              width: { xs: 70, sm: 90 },
              height: { xs: 70, sm: 90 },
              minHeight: { xs: 70, sm: 90 },
              transform: { xs: 'translateY(-16px)', sm: 'translateY(-18px)' },
              '&:hover': {
                bgcolor: bottomNavSolidBg,
                backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${bottomNavSolidBg} 100%)`
              }
            }}
          >
            <PlusOutlined style={{ fontSize: 22 }} />
          </Fab>
        </Box>

        {/* Messages */}
        <ListItemButton
          component={Link}
          to="/landlord/messages"
          onClick={() => {
            setMoreOpen(false);
            setPlusMenuAnchor(null);
          }}
          sx={{
            flex: 1,
            flexDirection: 'column',
            py: 0.5,
            minWidth: 0,
            color: textColor,
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
            borderRadius: 0
          }}
        >
          <Badge badgeContent={messagesUnreadCount > 0 ? messagesUnreadCount : 0} color="primary" max={99} showZero={false}>
            <MessageOutlined style={{ fontSize: 25, marginBottom: 2, color: '#fff' }} />
          </Badge>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1, color: 'inherit' }}>
            Messages
          </Typography>
        </ListItemButton>

        {/* More / Close */}
        <ListItemButton
          onClick={() => {
            setPlusMenuAnchor(null);
            setMoreOpen((open) => !open);
          }}
          sx={{
            flex: 1,
            flexDirection: 'column',
            py: 0.5,
            minWidth: 0,
            color: textColor,
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
            borderRadius: 0
          }}
        >
          {moreOpen ? (
            <CloseOutlined style={{ fontSize: 24, marginBottom: 2 }} />
          ) : (
            <AppstoreOutlined style={{ fontSize: 24, marginBottom: 2 }} />
          )}
          <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1, color: 'inherit' }}>
            {moreOpen ? 'Close' : 'More'}
          </Typography>
        </ListItemButton>
      </Box>

      {/* Plus menu (same as previous FAB) */}
      <Menu
        anchorEl={plusMenuAnchor}
        open={Boolean(plusMenuAnchor)}
        onClose={() => setPlusMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          root: { disableScrollLock: true }
        }}
        PaperProps={{
          sx: {
            mt: -1,
            minWidth: 200,
            boxShadow: theme.shadows[8],
            borderRadius: 2,
            background: bottomNavBg,
            border: '1px solid',
            borderColor: bottomNavBorder,
            '& .MuiList-root': { background: bottomNavBg },
            '& .MuiMenuItem-root': { color: 'rgba(255, 255, 255, 0.9)' },
            '& .MuiListItemIcon-root': { color: 'rgba(255, 255, 255, 0.9)' },
            '& .MuiListItemText-primary': { color: 'rgba(255, 255, 255, 0.9)' }
          }
        }}
      >
        <MenuItem onClick={() => handlePlusAction('property')}>
          <ListItemIcon>
            <HomeFilled style={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Add Property" />
        </MenuItem>
        <MenuItem onClick={() => handlePlusAction('expense')}>
          <ListItemIcon>
            <WalletOutlined style={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Add an Expense" />
        </MenuItem>
        <MenuItem onClick={() => handlePlusAction('viewExpenses')}>
          <ListItemIcon>
            <BarChartOutlined style={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="View Expenses" />
        </MenuItem>
        <MenuItem onClick={() => handlePlusAction('payment')}>
          <ListItemIcon>
            <DollarCircleOutlined style={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Add Payment" />
        </MenuItem>
        <MenuItem onClick={() => handlePlusAction('maintenance')}>
          <ListItemIcon>
            <ToolOutlined style={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Create Maintenance Request" />
        </MenuItem>
      </Menu>

      {/* More overlay (bottom sheet) - positioned above the bottom navbar, no backdrop so page stays visible */}
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        hideBackdrop
        sx={{
          zIndex: theme.zIndex.appBar + 1,
          pointerEvents: 'none',
          '& .MuiDrawer-paper': { pointerEvents: 'auto' }
        }}
        ModalProps={{
          disableScrollLock: true,
          disableEnforceFocus: true,
          disableAutoFocus: true
        }}
        PaperProps={{
          sx: {
            background: bottomNavBg,
            maxHeight: '80vh',
            bottom: barHeight,
            top: 'auto',
            height: 'auto',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTop: '1px solid',
            borderColor: bottomNavBorder,
            boxShadow: isDarkMode ? '0 -16px 40px rgba(0, 0, 0, 0.42)' : theme.shadows[8]
          }
        }}
      >
        <Box sx={{ pt: 2, pb: 3, px: 2 }}>
          {/* Upgrade - same condition as sidenav */}
          {!hasAdminRole && showUpgrade && (
            <>
              <Button
                component={Link}
                to={subscriptionUrl}
                variant="contained"
                color="success"
                size="small"
                fullWidth
                startIcon={<StarOutlined style={{ fontSize: '0.875rem' }} />}
                onClick={() => setMoreOpen(false)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1,
                  mb: 2
                }}
              >
                Upgrade to Premium
              </Button>
            </>
          )}

          <Grid container spacing={1.5}>
            {flattenedLandlordItems.map((item) => {
              const Icon = item.icon;
              const selected = isActive(item.url);
              return (
                <Grid size={3} key={item.id}>
                  <ListItemButton
                    component={Link}
                    to={item.url}
                    disabled={item.disabled}
                    onClick={() => setMoreOpen(false)}
                    sx={{
                      flexDirection: 'column',
                      py: 1.5,
                      px: 0.5,
                      borderRadius: 1,
                      color: textColor,
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                      '&.Mui-selected': { bgcolor: activeBg }
                    }}
                  >
                    <Box sx={{ color: `${iconColor} !important`, mb: 0.5 }}>
                      {Icon &&
                        (() => {
                          const name = Icon?.name || Icon?.displayName || '';
                          return <Icon style={{ fontSize: 22 }} {...(name.includes('TwoTone') && { twoToneColor: '#fff' })} />;
                        })()}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: selected ? 600 : 400,
                        color: textColor,
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        lineHeight: 1.2
                      }}
                    >
                      {item.title}
                    </Typography>
                  </ListItemButton>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Drawer>
    </>
  );
}

export const BOTTOM_NAV_BAR_HEIGHT = 80;
