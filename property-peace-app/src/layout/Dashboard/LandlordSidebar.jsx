import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { CalendarOutlined, DashboardOutlined, HomeOutlined, PlusOutlined, ProfileOutlined, SearchOutlined } from '@ant-design/icons';
import { Box, Divider, Drawer, IconButton, InputAdornment, List, ListItemButton, ListItemText, TextField, Typography, useTheme } from '@mui/material';
import Logo from 'components/logo';
import placeholderImage from 'assets/images/placeholder-house.png';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getRecentPropertyStorageKey, PROPERTY_VISITED_EVENT, readPropertyVisitDates, recordRecentlyViewedProperty, sortPropertiesByLastVisit } from 'utils/recentlyViewedProperties';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { landlordPrimaryLinks, activeLandlordPrimaryLink } from 'utils/landlordPrimaryNavigation';

export const LANDLORD_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_PROPERTIES = 8;
const primaryIcons = [DashboardOutlined, CalendarOutlined, HomeOutlined, ProfileOutlined];

export default function LandlordSidebar({ mobileOpen, onMobileClose }) {
  const { pathname, search } = useLocation();
  const theme = useTheme();
  const [propertySearch, setPropertySearch] = useState('');
  const { properties, isLoading, propertiesError } = useFetchProperties();
  const { user } = useAuth();
  const visitScope = getRecentPropertyStorageKey(user);
  const [visitState, setVisitState] = useState(() => ({ scope: visitScope, dates: readPropertyVisitDates(user) }));
  const visitDates = visitState.scope === visitScope ? visitState.dates : readPropertyVisitDates(user);
  useEffect(() => {
    const refreshVisits = () => setVisitState({ scope: visitScope, dates: readPropertyVisitDates(user) });
    refreshVisits();
    window.addEventListener(PROPERTY_VISITED_EVENT, refreshVisits);
    return () => window.removeEventListener(PROPERTY_VISITED_EVENT, refreshVisits);
  }, [visitScope]);
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const trialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);
  const activePrimary = activeLandlordPrimaryLink(pathname, search);
  const propertyRows = sortPropertiesByLastVisit((properties || []).filter((property) => (property.id ?? property.Id) != null)
    .map((property) => ({
      id: property.id ?? property.Id,
      name: property.name || property.Name || property.streetAddress || property.StreetAddress || 'Property',
      image: property.mainImageUrl || property.MainImageUrl || property.images?.[0]?.blobUrl || property.Images?.[0]?.BlobUrl || placeholderImage
    })), visitDates);
  const hasMoreProperties = propertyRows.length > MAX_SIDEBAR_PROPERTIES;
  const searchTerm = propertySearch.trim().toLocaleLowerCase();
  const visibleProperties = propertyRows
    .filter((property) => !hasMoreProperties || property.name.toLocaleLowerCase().includes(searchTerm))
    .slice(0, MAX_SIDEBAR_PROPERTIES);

  const rowSx = {
    mx: 1.5, my: 0.25, borderRadius: 1.5, minHeight: 40, px: 1.5,
    color: 'text.secondary',
    '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
    '&.Mui-selected': { bgcolor: 'action.selected', color: 'primary.main', fontWeight: 700, '&:hover': { bgcolor: 'action.selected' } },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
  };
  const navigation = <Box component="nav" aria-label="Landlord navigation" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 2, bgcolor: 'background.paper' }}>
    <List disablePadding>
      {landlordPrimaryLinks.map(({ label, to }, index) => {
        const Icon = primaryIcons[index];
        const isActive = activePrimary === label;
        return <ListItemButton key={to} component={Link} to={to} disabled={trialExpired} selected={isActive}
          aria-current={isActive ? 'page' : undefined} onClick={onMobileClose} sx={rowSx}>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', minWidth: 34, fontSize: 17 }}><Icon /></Box>
          <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 700 : 500 }} />
        </ListItemButton>;
      })}
    </List>
    <Divider sx={{ mx: 2, my: 1.5 }} />
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 3, pr: 2, pb: 0.75 }}>
      <Typography component="h2" variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.3 }}>Properties</Typography>
      <IconButton component={Link} to="/landlord/properties/add" aria-label="Add property" title="Add property"
        disabled={trialExpired} onClick={onMobileClose} size="small"
        sx={{ color: 'text.secondary', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}>
        <PlusOutlined />
      </IconButton>
    </Box>
    {hasMoreProperties && <TextField
      size="small" fullWidth placeholder="Search properties"
      value={propertySearch} onChange={(event) => setPropertySearch(event.target.value)}
      slotProps={{ htmlInput: { 'aria-label': 'Search properties' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
      sx={{ px: 2, pb: 1, '& .MuiInputBase-input': { fontSize: 13 } }}
    />}
    <List disablePadding>
      {visibleProperties.map((property) => {
        const to = `/landlord/property/${encodeURIComponent(property.id)}`;
        const isActive = pathname === to || pathname.startsWith(`${to}/`);
        return <ListItemButton key={property.id} component={Link} to={to} disabled={trialExpired} selected={isActive}
          aria-current={isActive ? 'page' : undefined} onClick={() => { recordRecentlyViewedProperty(property.id, user); onMobileClose?.(); }} sx={{ ...rowSx, gap: 1.25, minHeight: 48 }}>
          <Box component="img" src={property.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = placeholderImage; }}
            sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: 1, objectFit: 'cover', bgcolor: 'action.hover' }} />
          <ListItemText primary={property.name} primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 700 : 500, noWrap: true, title: property.name }} />
        </ListItemButton>;
      })}
    </List>
    {!propertyRows.length && <Typography sx={{ px: 3, py: 1, fontSize: 12, color: 'text.secondary' }}>
      {isLoading ? 'Loading properties…' : propertiesError ? 'Properties could not be loaded.' : 'No properties yet.'}
    </Typography>}
    {propertyRows.length > 0 && !visibleProperties.length && <Typography sx={{ px: 3, py: 1, fontSize: 12, color: 'text.secondary' }}>
      No matching properties.
    </Typography>}
    {hasMoreProperties && <List disablePadding>
      <ListItemButton component={Link} to="/landlord/properties" disabled={trialExpired} onClick={onMobileClose} sx={rowSx}>
        <ListItemText primary="View more" primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} />
      </ListItemButton>
    </List>}
  </Box>;

  return <>
    <Drawer variant="permanent" open sx={{ display: { xs: 'none', lg: 'block' }, width: LANDLORD_SIDEBAR_WIDTH, flexShrink: 0,
      '& .MuiDrawer-paper': { width: LANDLORD_SIDEBAR_WIDTH, boxSizing: 'border-box', height: '100dvh', bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider' } }}>
      <Box sx={{ height: 84, flexShrink: 0, display: 'flex', alignItems: 'center', px: 3, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Logo reverse darkSurface={theme.palette.mode === 'dark'} disableTopPadding lightHeaderLogo={theme.palette.mode !== 'dark'} width={142} to="/landlord/dashboard" />
      </Box>
      {navigation}
    </Drawer>
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
      sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: LANDLORD_SIDEBAR_WIDTH, boxSizing: 'border-box', bgcolor: 'background.paper' } }}>
      {navigation}
    </Drawer>
  </>;
}

LandlordSidebar.propTypes = { mobileOpen: PropTypes.bool, onMobileClose: PropTypes.func };
