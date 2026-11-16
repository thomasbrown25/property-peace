import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { DownOutlined, HomeOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Box, Collapse, Drawer, IconButton, InputAdornment, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import Logo from 'components/logo';
import { brand } from 'themes/brand';
import placeholderImage from 'assets/images/placeholder-house.png';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getRecentPropertyStorageKey, readPropertyVisitDates, recordRecentlyViewedProperty, sortPropertiesByLastVisit } from 'utils/recentlyViewedProperties';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { activeLandlordPrimaryLink, landlordMoreLinks, landlordPrimaryLinks } from 'utils/landlordPrimaryNavigation';

export const LANDLORD_SIDEBAR_WIDTH = 260;

// One visit-order snapshot per account/organization for this page load. A route
// remount must not move a clicked property; a full reload creates fresh snapshots.
const sidebarVisitDates = new Map();
function visitDatesForSidebar(user) {
  const scope = getRecentPropertyStorageKey(user);
  if (!scope) return {};
  if (!sidebarVisitDates.has(scope)) sidebarVisitDates.set(scope, readPropertyVisitDates(user));
  return sidebarVisitDates.get(scope);
}

export default function LandlordSidebar({ mobileOpen, onMobileClose }) {
  const { pathname, search } = useLocation();
  const [propertySearch, setPropertySearch] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const { properties, isLoading, propertiesError } = useFetchProperties();
  const { user } = useAuth();
  const visitScope = getRecentPropertyStorageKey(user);
  const visitDates = visitDatesForSidebar(user);
  useEffect(() => { setPropertySearch(''); }, [visitScope]);
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const trialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);

  const propertyRows = sortPropertiesByLastVisit((properties || []).filter((property) => (property.id ?? property.Id) != null)
    .map((property) => ({
      id: property.id ?? property.Id,
      name: property.name || property.Name || property.streetAddress || property.StreetAddress || 'Property',
      address: [property.streetAddress || property.StreetAddress, property.city || property.City, property.state || property.State].filter(Boolean).join(', '),
      image: property.mainImageUrl || property.MainImageUrl || property.images?.[0]?.blobUrl || property.Images?.[0]?.BlobUrl || placeholderImage
    })), visitDates);
  const searchTerm = propertySearch.trim().toLocaleLowerCase();
  const visibleProperties = propertyRows.filter((property) => `${property.name} ${property.address}`.toLocaleLowerCase().includes(searchTerm));


  const renderPropertyNavigation = () => <PropertyNavigation properties={visibleProperties} total={propertyRows.length} search={propertySearch}
    onSearch={setPropertySearch} pathname={pathname} disabled={trialExpired} user={user} onNavigate={onMobileClose}
    status={isLoading ? 'Loading properties…' : propertiesError ? 'Properties could not be loaded.' : propertyRows.length ? 'No matching properties.' : 'No properties yet.'} />;

  return <>
    <Drawer variant="permanent" open sx={{ display: { xs: 'none', lg: 'block' }, width: LANDLORD_SIDEBAR_WIDTH, flexShrink: 0,
      '& .MuiDrawer-paper': { width: LANDLORD_SIDEBAR_WIDTH, boxSizing: 'border-box', height: '100dvh', bgcolor: brand.forest, borderRight: '1px solid', borderColor: 'rgba(255, 255, 255, 0.14)' } }}>
      <Box sx={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', px: 3, bgcolor: brand.forest, borderBottom: '1px solid', borderColor: 'rgba(255, 255, 255, 0.14)' }}>
        <Logo darkSurface disableTopPadding width={120} to="/landlord/dashboard" />
      </Box>
      {renderPropertyNavigation()}
    </Drawer>
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
      sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: 300, maxWidth: '90vw', boxSizing: 'border-box', bgcolor: brand.forest } }}>
      <Box sx={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.14)' }}>
        <Logo darkSurface disableTopPadding width={120} to="/landlord/dashboard" />
      </Box>
      <Box component="nav" aria-label="Landlord pages" sx={{ maxHeight: '38dvh', overflowY: 'auto', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
        <List dense disablePadding sx={{ py: 1 }}>
          {landlordPrimaryLinks.map(({ label, to }) => (
            <ListItemButton key={label} component={Link} to={to} disabled={trialExpired} onClick={onMobileClose}
              selected={activeLandlordPrimaryLink(pathname, search) === label}
              sx={{ mx: 1.5, borderRadius: 1.5, color: '#FFFFFF', '&.Mui-selected': { bgcolor: 'rgba(185,228,203,0.16)' } }}>
              <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
            </ListItemButton>
          ))}
          <ListItemButton onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen}
            sx={{ mx: 1.5, borderRadius: 1.5, color: '#FFFFFF' }}>
            <MoreOutlined style={{ marginRight: 12 }} /><ListItemText primary="More" primaryTypographyProps={{ fontSize: 13 }} />
            <DownOutlined style={{ fontSize: 11, transform: moreOpen ? 'rotate(180deg)' : undefined }} />
          </ListItemButton>
          <Collapse in={moreOpen} unmountOnExit>
            {landlordMoreLinks.map(({ label, to }) => (
              <ListItemButton key={label} component={Link} to={to} onClick={onMobileClose}
                disabled={trialExpired && !['Settings', 'Help'].includes(label)}
                sx={{ mx: 1.5, pl: 4, borderRadius: 1.5, color: '#FFFFFF' }}>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
              </ListItemButton>
            ))}
          </Collapse>
        </List>
      </Box>
      {renderPropertyNavigation()}
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

  const rowSx = {
    mx: 1.5, my: 0.5, borderRadius: 1.5, color: '#FFFFFF',
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
    '&.Mui-selected': { bgcolor: 'rgba(185, 228, 203, 0.16)', '&:hover': { bgcolor: 'rgba(185, 228, 203, 0.22)' } },
    '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: -2 }
  };
  return <Box component="nav" aria-label="Property navigation" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: brand.forest, color: '#FFFFFF' }}>
    <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <Box component={Link} to="/landlord/properties" onClick={(event) => { if (disabled) event.preventDefault(); else onNavigate?.(); }}
        aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
        aria-current={pathname === '/landlord/properties' ? 'page' : undefined}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: '#FFFFFF', textDecoration: 'none',
          '&:hover': { color: '#FFFFFF', textDecoration: 'underline' },
          '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: 3 } }}>
        <HomeOutlined aria-hidden="true" />
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, color: 'inherit' }}>Properties</Typography>
        <Typography component="span" variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>{total}</Typography>
      </Box>
      <IconButton component={Link} to="/landlord/properties/add" aria-label="Add property" title="Add property"
        disabled={disabled} onClick={onNavigate} size="small" sx={{ color: 'inherit' }}><PlusOutlined /></IconButton>
    </Box>
    <Box sx={{ px: 1.5, pt: 1, pb: 1, flexShrink: 0 }}>
      <TextField size="small" fullWidth placeholder="Search properties" value={search} onChange={(event) => onSearch(event.target.value)}
        slotProps={{ htmlInput: { 'aria-label': 'Search properties' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' }, '&.Mui-focused fieldset': { borderColor: brand.mint } }, '& .MuiInputBase-input': { fontSize: 13, '&::placeholder': { color: 'rgba(255,255,255,0.8)', opacity: 1 } }, '& .MuiInputAdornment-root': { color: '#FFFFFF' } }} />
    </Box>
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <Box ref={scrollRef} onScroll={updateOverflow} sx={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.4) transparent',
        '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 3 } }}>
        <List disablePadding sx={{ pb: 2 }}>
          {properties.map((property) => {
            const to = `/landlord/property/${encodeURIComponent(property.id)}`;
            const isActive = pathname === to || pathname.startsWith(`${to}/`);
            return <ListItemButton key={property.id} component={Link} to={to} disabled={disabled} selected={isActive}
              aria-current={isActive ? 'page' : undefined} onClick={() => { recordRecentlyViewedProperty(property.id, user); onNavigate?.(); }}
              sx={{ ...rowSx, px: 1.25, gap: 1.25, minHeight: 56 }}>
              <Box component="img" src={property.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = placeholderImage; }}
                sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1, objectFit: 'cover', bgcolor: 'rgba(255,255,255,0.12)' }} />
              <ListItemText primary={property.name} secondary={property.address && property.address !== property.name ? property.address : null}
                primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 700 : 500, noWrap: true, title: property.name, sx: { color: '#FFFFFF' } }}
                secondaryTypographyProps={{ fontSize: 11, noWrap: true, title: property.address, sx: { color: 'rgba(255,255,255,0.72)' } }} />
            </ListItemButton>;
          })}
        </List>
        {!properties.length && <Typography role="status" sx={{ px: 3, py: 1, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{status}</Typography>}
      </Box>
      {hasMoreBelow && <Box aria-hidden="true" sx={{ position: 'absolute', bottom: 0, left: 0, right: 6, height: 28, pointerEvents: 'none',
        background: `linear-gradient(transparent, ${brand.forest})` }} />}
    </Box>
  </Box>;
}

LandlordSidebar.propTypes = { mobileOpen: PropTypes.bool, onMobileClose: PropTypes.func };
PropertyNavigation.propTypes = {
  properties: PropTypes.array.isRequired, total: PropTypes.number.isRequired, search: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired, pathname: PropTypes.string.isRequired, disabled: PropTypes.bool,
  user: PropTypes.object, onNavigate: PropTypes.func, status: PropTypes.string.isRequired
};
