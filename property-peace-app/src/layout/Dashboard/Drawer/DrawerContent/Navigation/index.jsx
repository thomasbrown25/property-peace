import { useState, useMemo } from 'react';
import { useMediaQuery, Divider, List, Typography, Box, Button, Tooltip } from '@mui/material';
import { Link } from 'react-router-dom';
import { StarOutlined } from '@ant-design/icons';

// project imports
import NavItem from './NavItem';
import NavGroup from './NavGroup';
import menuItems, { tenantPages, adminPages } from 'menu-items';
import pages from 'menu-items/pages';

import useConfig from 'hooks/useConfig';
import { HORIZONTAL_MAX_ITEM, MenuOrientation } from 'config';
import useAuth from 'hooks/useAuth';
import { useSubscriptionStatus, useSubscription } from 'hooks/useSubscription';

// ==============================|| DRAWER CONTENT - NAVIGATION ||============================== //

export default function Navigation() {
  const { menuOrientation } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const auth = useAuth();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const { subscription, loading: subscriptionLoading } = useSubscription();

  // Get roles from JWTContext only - ensure it's an array
  const userRoles = Array.isArray(auth?.user?.Roles)
    ? auth?.user?.Roles
    : Array.isArray(auth?.user?.roles)
      ? auth?.user?.roles
      : [];
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const hasAdminRole = normalizedRoles.includes('admin');

  const isPremium = subscription?.plan?.name?.toLowerCase() === 'premium';
  const subscriptionUrl = hasTenantRole ? '/tenant/subscription?tab=0' : '/landlord/subscription?tab=0';
  // Only show upgrade when we've determined they're on the free plan (hide until subscription has loaded)
  const showUpgrade = !subscriptionLoading && !isPremium;

  // Check if trial is expired
  const isTrialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus?.trialDaysRemaining === null || subscriptionStatus?.trialDaysRemaining <= 0);


  const [selectedID, setSelectedID] = useState('');
  const [selectedItems, setSelectedItems] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(0);

  // Filter menu items based on user role
  // Priority: Admin > Tenant > Landlord
  const filteredMenuItems = useMemo(() => {
    let menuData;
    if (hasAdminRole) {
      menuData = { items: [adminPages] };
    } else if (hasTenantRole) {
      menuData = { items: Array.isArray(tenantPages) ? tenantPages : [tenantPages] };
    } else if (hasLandlordRole) {
      // pages is now an array of groups
      const pagesArray = Array.isArray(pages) ? pages : [pages];
      menuData = { items: pagesArray };
    } else {
      // Default to landlord menu if no role or unknown role
      const pagesArray = Array.isArray(pages) ? pages : [pages];
      menuData = { items: pagesArray };
    }
    
    // If trial is expired, disable all items except subscription
    // Note: subscription is removed from menu, so this logic may not be needed
    // But keeping for backward compatibility
    if (isTrialExpired && menuData.items.length > 0) {
      menuData.items = menuData.items.map(group => {
        if (group.children) {
          const updatedChildren = group.children.map(item => {
            // Allow subscription page, disable all others
            if (item.id === 'subscription' || item.url === '/landlord/subscription') {
              return item;
            }
            return { ...item, disabled: true };
          });
          return { ...group, children: updatedChildren };
        }
        return group;
      });
    }
    
    return menuData;
  }, [hasAdminRole, hasTenantRole, hasLandlordRole, isTrialExpired]);

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;

  const lastItem = isHorizontal ? HORIZONTAL_MAX_ITEM : null;
  let lastItemIndex = filteredMenuItems.items.length - 1;
  let remItems = [];
  let lastItemId;

  //  first it checks menu item is more than giving HORIZONTAL_MAX_ITEM after that get lastItemid by giving horizontal max
  // item and it sets horizontal menu by giving horizontal max item lastly slice menuItem from array and set into remItems

  if (lastItem && lastItem < filteredMenuItems.items.length) {
    lastItemId = filteredMenuItems.items[lastItem - 1].id;
    lastItemIndex = lastItem - 1;
    remItems = filteredMenuItems.items.slice(lastItem - 1, filteredMenuItems.items.length).map((item) => ({
      title: item.title,
      elements: item.children,
      icon: item.icon,
      ...(item.url && {
        url: item.url
      })
    }));
  }

  const navGroups = filteredMenuItems.items.slice(0, lastItemIndex + 1).map((item, index) => {
    switch (item.type) {
      case 'group':
        if (item.url && item.id !== lastItemId) {
          return (
            <List key={item.id} sx={{ zIndex: 0, ...(isHorizontal && { mt: 0.5 }) }}>
              {!isHorizontal && index !== 0 && <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.12)' }} />}
              <NavItem item={item} level={1} isParents setSelectedID={setSelectedID} />
            </List>
          );
        }

        return (
          <NavGroup
            key={item.id}
            setSelectedID={setSelectedID}
            setSelectedItems={setSelectedItems}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            selectedID={selectedID}
            selectedItems={selectedItems}
            lastItem={lastItem}
            remItems={remItems}
            lastItemId={lastItemId}
            item={item}
          />
        );
      default:
        return (
          <Typography key={item.id} variant="h6" color="error" align="center">
            Fix - Navigation Group
          </Typography>
        );
    }
  });

  return (
    <Box
      sx={{
        pt: 0,
        ...(!isHorizontal && { '& > ul:first-of-type': { mt: 0 } }),
        display: isHorizontal ? { xs: 'block', lg: 'flex' } : 'block'
      }}
    >
      {navGroups}
    </Box>
  );
}
