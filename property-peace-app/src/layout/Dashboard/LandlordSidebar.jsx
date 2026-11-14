import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { DashboardOutlined, HomeOutlined, TeamOutlined, ToolOutlined, WalletOutlined, FileTextOutlined, MoreOutlined, DownOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Box, Collapse, Divider, Drawer, IconButton, InputAdornment, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import Logo from 'components/logo';
import { brand } from 'themes/brand';
import placeholderImage from 'assets/images/placeholder-house.png';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getRecentPropertyStorageKey, PROPERTY_VISITED_EVENT, readPropertyVisitDates, recordRecentlyViewedProperty, sortPropertiesByLastVisit } from 'utils/recentlyViewedProperties';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { landlordPrimaryLinks, landlordMoreLinks, activeLandlordPrimaryLink } from 'utils/landlordPrimaryNavigation';

export const LANDLORD_PRIMARY_SIDEBAR_WIDTH = 240;
export const LANDLORD_PROPERTY_SIDEBAR_WIDTH = 260;
export const LANDLORD_SIDEBAR_WIDTH = LANDLORD_PRIMARY_SIDEBAR_WIDTH + LANDLORD_PROPERTY_SIDEBAR_WIDTH;
const primaryIcons = [DashboardOutlined, TeamOutlined, ToolOutlined, WalletOutlined, FileTextOutlined];

export default function LandlordSidebar({ mobileOpen, onMobileClose }) {
  const { pathname, search } = useLocation();
  const [propertySearch, setPropertySearch] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const { properties, isLoading, propertiesError } = useFetchProperties();
  const { user } = useAuth();
  const visitScope = getRecentPropertyStorageKey(user);
  const [visitState, setVisitState] = useState(() => ({ scope: visitScope, dates: readPropertyVisitDates(user) }));
  const visitDates = visitState.scope === visitScope ? visitState.dates : readPropertyVisitDates(user);
  useEffect(() => {
    const refreshVisits = () => setVisitState({ scope: visitScope, dates: readPropertyVisitDates(user) });
    refreshVisits();
    window.addEventListener(PROPERTY_VISITED_EVENT, refreshVisits);
    window.addEventListener('storage', refreshVisits);
    return () => {
      window.removeEventListener(PROPERTY_VISITED_EVENT, refreshVisits);
      window.removeEventListener('storage', refreshVisits);
    };
  }, [user, visitScope]);
  useEffect(() => { setPropertySearch(''); }, [visitScope]);
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const trialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);
  const activePrimary = activeLandlordPrimaryLink(pathname, search);
  const propertyRows = sortPropertiesByLastVisit((properties || []).filter((property) => (property.id ?? property.Id) != null)
    .map((property) => ({
      id: property.id ?? property.Id,
      name: property.name || property.Name || property.streetAddress || property.StreetAddress || 'Property',
      address: [property.streetAddress || property.StreetAddress, property.city || property.City, property.state || property.State].filter(Boolean).join(', '),
      image: property.mainImageUrl || property.MainImageUrl || property.images?.[0]?.blobUrl || property.Images?.[0]?.BlobUrl || placeholderImage
    })), visitDates);
  const searchTerm = propertySearch.trim().toLocaleLowerCase();
  const visibleProperties = propertyRows.filter((property) => `${property.name} ${property.address}`.toLocaleLowerCase().includes(searchTerm));

  const rowSx = {
    mx: 1.5, my: 0.25, borderRadius: 1.5, minHeight: 44, px: 1.5,
    color: '#FFFFFF',
    '& .MuiListItemText-primary': { color: 'inherit' },
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF' },
    '&.Mui-selected': { bgcolor: 'rgba(185, 228, 203, 0.16)', color: '#FFFFFF', fontWeight: 700, '&:hover': { bgcolor: 'rgba(185, 228, 203, 0.22)' } },
    '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: -2 }
  };
  const navigation = <Box component="nav" aria-label="Landlord navigation" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 2, bgcolor: brand.forest }}>
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
      <ListItemButton onClick={() => setMoreOpen((open) => !open)} selected={activePrimary === 'More'}
        aria-expanded={moreOpen} sx={rowSx}>
        <Box component="span" sx={{ display: 'flex', minWidth: 34, fontSize: 17 }}><MoreOutlined /></Box>
        <ListItemText primary="More" primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
        <DownOutlined style={{ fontSize: 11, transform: moreOpen ? 'rotate(180deg)' : undefined }} />
      </ListItemButton>
    </List>
    <Collapse in={moreOpen} unmountOnExit>
      <List disablePadding>
        {landlordMoreLinks.map(({ label, to }) => <ListItemButton key={to} component={Link} to={to} disabled={trialExpired && !['Settings', 'Help'].includes(label)}
          selected={pathname === to || pathname.startsWith(`${to}/`)} onClick={onMobileClose} sx={{ ...rowSx, pl: 5.75 }}>
          <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
        </ListItemButton>)}
      </List>
    </Collapse>
  </Box>;

  const propertyNavigation = <PropertyNavigation properties={visibleProperties} total={propertyRows.length} search={propertySearch}
    onSearch={setPropertySearch} pathname={pathname} disabled={trialExpired} user={user} onNavigate={onMobileClose}
    status={isLoading ? 'Loading properties…' : propertiesError ? 'Properties could not be loaded.' : propertyRows.length ? 'No matching properties.' : 'No properties yet.'} />;

  return <>
    <Drawer variant="permanent" open sx={{ display: { xs: 'none', lg: 'block' }, width: LANDLORD_PRIMARY_SIDEBAR_WIDTH, flexShrink: 0,
      '& .MuiDrawer-paper': { width: LANDLORD_PRIMARY_SIDEBAR_WIDTH, boxSizing: 'border-box', height: '100dvh', bgcolor: brand.forest, borderRight: '1px solid', borderColor: 'rgba(255, 255, 255, 0.14)' } }}>
      <Box sx={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', px: 3, bgcolor: brand.forest, borderBottom: '1px solid', borderColor: 'rgba(255, 255, 255, 0.14)' }}>
        <Logo darkSurface disableTopPadding width={120} to="/landlord/dashboard" />
      </Box>
      {navigation}
    </Drawer>
    <Box component="aside" aria-label="Property sidebar" sx={{ display: { xs: 'none', lg: 'block' }, width: LANDLORD_PROPERTY_SIDEBAR_WIDTH, flexShrink: 0 }}>
      <Box sx={{ position: 'fixed', left: LANDLORD_PRIMARY_SIDEBAR_WIDTH, top: 0, bottom: 0, width: LANDLORD_PROPERTY_SIDEBAR_WIDTH,
        bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', zIndex: (theme) => theme.zIndex.drawer }}>
        {propertyNavigation}
      </Box>
    </Box>
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
      sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: 300, maxWidth: '90vw', boxSizing: 'border-box', bgcolor: brand.forest } }}>
      <Box sx={{ flexShrink: 0, maxHeight: '45dvh', overflowY: 'auto' }}>{navigation}</Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, bgcolor: 'background.paper' }}>{propertyNavigation}</Box>
    </Drawer>
  </>;
}

function PropertyNavigation({ properties, total, search, onSearch, pathname, disabled, user, onNavigate, status }) {
  const scrollRef = useRef(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const updateOverflow = () => {
    const node = scrollRef.current;
    if (node) setHasMoreBelow(node.scrollHeight - node.clientHeight - node.scrollTop > 2);
  };
  useEffect(() => {
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [properties.length]);

  return <Box component="nav" aria-label="Property navigation" sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <Box sx={{ height: 60, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>Properties</Typography>
      <IconButton component={Link} to="/landlord/properties/add" aria-label="Add property" title="Add property"
        disabled={disabled} onClick={onNavigate} size="small" sx={{ color: 'primary.main' }}><PlusOutlined /></IconButton>
    </Box>
    <Box sx={{ px: 1.5, pt: 2, pb: 1, flexShrink: 0 }}>
      <TextField size="small" fullWidth placeholder="Search properties" value={search} onChange={(event) => onSearch(event.target.value)}
        slotProps={{ htmlInput: { 'aria-label': 'Search properties' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
      <List disablePadding sx={{ mt: 1 }}>
        <ListItemButton component={Link} to="/landlord/properties" disabled={disabled} onClick={onNavigate}
          selected={pathname === '/landlord/properties'} sx={{ borderRadius: 1.5, px: 1.5, minHeight: 44, gap: 1 }}>
          <HomeOutlined />
          <ListItemText primary="All properties" primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} />
          <Typography variant="caption" color="text.secondary">{total}</Typography>
        </ListItemButton>
      </List>
    </Box>
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <Box ref={scrollRef} onScroll={updateOverflow} sx={{ height: '100%', overflowY: 'scroll', scrollbarWidth: 'thin',
        scrollbarColor: (theme) => `${theme.palette.divider} transparent`,
        '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 } }}>
        <List disablePadding sx={{ pb: 2 }}>
          {properties.map((property) => {
            const to = `/landlord/property/${encodeURIComponent(property.id)}`;
            const isActive = pathname === to || pathname.startsWith(`${to}/`);
            return <ListItemButton key={property.id} component={Link} to={to} disabled={disabled} selected={isActive}
              aria-current={isActive ? 'page' : undefined} onClick={() => { recordRecentlyViewedProperty(property.id, user); onNavigate?.(); }}
              sx={{ mx: 1.5, my: 0.5, px: 1.25, gap: 1.25, borderRadius: 1.5, minHeight: 56 }}>
              <Box component="img" src={property.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = placeholderImage; }}
                sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1, objectFit: 'cover', bgcolor: 'action.hover' }} />
              <ListItemText primary={property.name} secondary={property.address && property.address !== property.name ? property.address : null}
                primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 700 : 500, noWrap: true, title: property.name }}
                secondaryTypographyProps={{ fontSize: 11, noWrap: true, title: property.address }} />
            </ListItemButton>;
          })}
        </List>
        {!properties.length && <Typography role="status" sx={{ px: 3, py: 1, fontSize: 12, color: 'text.secondary' }}>{status}</Typography>}
      </Box>
      {hasMoreBelow && <Box aria-hidden="true" sx={{ position: 'absolute', bottom: 0, left: 0, right: 6, height: 28, pointerEvents: 'none',
        background: (theme) => `linear-gradient(transparent, ${theme.palette.background.paper})` }} />}
    </Box>
  </Box>;
}

LandlordSidebar.propTypes = { mobileOpen: PropTypes.bool, onMobileClose: PropTypes.func };
PropertyNavigation.propTypes = {
  properties: PropTypes.array.isRequired, total: PropTypes.number.isRequired, search: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired, pathname: PropTypes.string.isRequired, disabled: PropTypes.bool,
  user: PropTypes.object, onNavigate: PropTypes.func, status: PropTypes.string.isRequired
};
