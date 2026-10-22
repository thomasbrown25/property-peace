import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Button, Divider, ListSubheader, Menu, MenuItem } from '@mui/material';
import DownOutlined from '@ant-design/icons/DownOutlined';
import useAuth from 'hooks/useAuth';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import pages from 'menu-items/pages';
import { tenantPages, adminPages } from 'menu-items';
import { landlordPagesForInventory } from 'menu-items/landlordInventory';
import useLandlordInventoryMenu from 'menu-items/useLandlordInventoryMenu';

// Reuse the same role-aware destinations as the former sidebar, including
// short-stay inventory filtering and expired-trial restrictions.
export default function TopNavigation() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const [anchor, setAnchor] = useState(null);
  const roles = (Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [])
    .map((role) => String(role).toLowerCase().trim());
  const isAdmin = roles.includes('admin');
  const isTenant = roles.includes('tenant');
  const isLandlord = roles.includes('landlord');
  const shortTermOnly = useLandlordInventoryMenu(isLandlord && !isTenant && !isAdmin);
  const groups = isAdmin ? [adminPages] : isTenant ? tenantPages : landlordPagesForInventory(pages, shortTermOnly);
  const trialExpired = !isAdmin && !isTenant && subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);

  useEffect(() => setAnchor(null), [pathname]);

  return (
    <>
      <Button
        aria-label="Navigate to a page"
        aria-controls={anchor ? 'dashboard-navigation-menu' : undefined}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        endIcon={<DownOutlined style={{ fontSize: 11 }} />}
        sx={{ flexShrink: 0, color: 'inherit', fontWeight: 600, textTransform: 'none', minWidth: 0, px: { xs: 0.5, sm: 1 } }}
      >
        Navigate
      </Button>
      <Menu
        id="dashboard-navigation-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { width: 300, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(70vh, 580px)', mt: 1 } } }}
      >
        {groups.map((group, index) => (
          <Box key={group.id}>
            {index > 0 && <Divider sx={{ my: 0.5 }} />}
            {group.title && <ListSubheader sx={{ lineHeight: '32px', fontWeight: 700 }}>{group.title}</ListSubheader>}
            {(group.children || []).filter((item) => item.type === 'item' && item.url).map((item) => (
              <MenuItem
                key={item.id}
                component={Link}
                to={item.url}
                disabled={item.disabled || (trialExpired && item.id !== 'subscription' && item.url !== '/landlord/subscription')}
                selected={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                onClick={() => setAnchor(null)}
                sx={{ minHeight: 40, whiteSpace: 'normal' }}
              >
                {item.title}
              </MenuItem>
            ))}
          </Box>
        ))}
        {!isAdmin && (
          <>
            <Divider sx={{ my: 0.5 }} />
            {!isTenant && (
              <MenuItem component={Link} to="/landlord/support/ticket" onClick={() => setAnchor(null)}>Support</MenuItem>
            )}
            <MenuItem component={Link} to={isTenant ? '/tenant/settings' : '/landlord/settings'}
              selected={pathname.startsWith(isTenant ? '/tenant/settings' : '/landlord/settings')} onClick={() => setAnchor(null)}>
              Settings
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}
