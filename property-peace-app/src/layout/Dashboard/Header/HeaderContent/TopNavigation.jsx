import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Divider, ListSubheader, Menu, MenuItem } from '@mui/material';
import DownOutlined from '@ant-design/icons/DownOutlined';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import pages from 'menu-items/pages';
import { landlordPagesForInventory } from 'menu-items/landlordInventory';
import useLandlordInventoryMenu from 'menu-items/useLandlordInventoryMenu';
import { landlordPrimaryLinks } from 'utils/landlordPrimaryNavigation';
import { groupLandlordMoreNavigation } from 'utils/landlordMoreNavigation';

const primaryDestinations = new Set(landlordPrimaryLinks.map(({ to }) => to));
const tenantsItem = { id: 'tenants', title: 'Tenants', type: 'item', url: '/landlord/leases?tab=tenants' };

// The desktop overflow uses the former landlord sidebar's grouped destinations.
// Tenants is a tab of Leases rather than a separate route in the current app.
export default function TopNavigation() {
  const { pathname, search } = useLocation();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const shortTermOnly = useLandlordInventoryMenu(true);
  const [anchor, setAnchor] = useState(null);
  const groups = groupLandlordMoreNavigation(landlordPagesForInventory(pages, shortTermOnly).map((group) => ({
    ...group,
    children: (group.children || []).flatMap((item) => {
      if (primaryDestinations.has(item.url)) return [];
      return item.id === 'leases' ? [item, tenantsItem] : [item];
    })
  })));
  const trialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);
  const isSelected = (item) => item.id === 'tenants'
    ? pathname === '/landlord/tenants' || (pathname === '/landlord/leases' && new URLSearchParams(search).get('tab') === 'tenants')
    : item.id === 'leases'
      ? (pathname === '/landlord/leases' && new URLSearchParams(search).get('tab') !== 'tenants') || pathname.startsWith('/landlord/leases/')
      : pathname === item.url || pathname.startsWith(`${item.url}/`);
  const moreSelected = groups.some((group) => group.children.some(isSelected));

  useEffect(() => setAnchor(null), [pathname, search]);

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label="More landlord pages"
        aria-controls={anchor ? 'landlord-more-navigation' : undefined}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor((current) => current ? null : event.currentTarget)}
        sx={(theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'stretch',
          px: 0.25,
          border: 0,
          background: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          fontSize: { md: 13, lg: 14 },
          fontWeight: moreSelected ? 700 : 500,
          lineHeight: 1,
          transition: 'color 150ms ease',
          '&:hover': { color: 'inherit' },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -6, borderRadius: 1 }
        })}
      >
        <Box
          component="span"
          sx={(theme) => ({
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            '&::after': {
              content: '""',
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -6,
              height: 2,
              backgroundColor: theme.palette.mode === 'dark' ? 'common.white' : '#061e35',
              opacity: moreSelected ? 1 : 0
            }
          })}
        >
          More <DownOutlined style={{ fontSize: 11 }} />
        </Box>
      </Box>
      <Menu
        id="landlord-more-navigation"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { width: 270, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 88px)', mt: 1 } } }}
      >
        {groups.map((group, index) => (
          <Box key={group.id}>
            {index > 0 && <Divider sx={{ my: 0.25 }} />}
            {group.title && <ListSubheader sx={{ lineHeight: '28px', fontWeight: 700 }}>{group.title}</ListSubheader>}
            {group.children.map((item) => (
              <MenuItem
                key={item.id}
                component={Link}
                to={item.url}
                disabled={item.disabled || trialExpired}
                selected={isSelected(item)}
                aria-current={isSelected(item) ? 'page' : undefined}
                onClick={() => setAnchor(null)}
                sx={{ minHeight: 34, py: 0.5, whiteSpace: 'normal' }}
              >
                {item.title}
              </MenuItem>
            ))}
          </Box>
        ))}
        <Divider sx={{ my: 0.25 }} />
        <MenuItem component={Link} to="/landlord/support/ticket" onClick={() => setAnchor(null)} sx={{ minHeight: 34, py: 0.5 }}>Support</MenuItem>
        <MenuItem component={Link} to="/landlord/settings" selected={pathname.startsWith('/landlord/settings')} onClick={() => setAnchor(null)} sx={{ minHeight: 34, py: 0.5 }}>Settings</MenuItem>
      </Menu>
    </>
  );
}
