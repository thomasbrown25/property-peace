import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AppIcon from 'components/AppIcon';
import { Box, Collapse, Drawer, IconButton, List, ListItemButton, ListItemText, listItemTextClasses, TextField, Typography, useMediaQuery } from '@mui/material';
import Logo from 'components/logo';
import { brand } from 'themes/brand';
import placeholderImage from 'assets/images/placeholder-house.png';
import compactLogo from 'assets/images/logos/logo-white.png';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';
import { useOrganization } from 'contexts/OrganizationContext';
import { selectPropertiesLoadStatus } from 'store/property/property.selector';
import { createTask } from 'store/task/task.action';
import { getRecentPropertyStorageKey, readPropertyVisitDates, recordRecentlyViewedProperty, sortPropertiesByLastVisit } from 'utils/recentlyViewedProperties';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { activeLandlordPrimaryLink, landlordMoreLinks, landlordPrimaryLinks } from 'utils/landlordPrimaryNavigation';
import { dashboardEntranceDelay, dashboardSlideDownSx } from 'sections/landlord/dashboard/dashboardEntrance.mjs';
import TaskEditorDrawer from 'sections/landlord/tasks/TaskEditorDrawer';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';

export const LANDLORD_SIDEBAR_WIDTH = 260;
const sidebarBackground = brand.forest;
const propertySubtitleColor = 'rgba(255,255,255,0.72)';
const propertyActions = [
  { action: 'view', label: 'View property', icon: 'house' },
  { action: 'edit', label: 'Edit property', icon: 'edit' },
  { action: 'payment', label: 'Record payment', icon: 'payments', requires: 'canRecordPayment' },
  { action: 'lease', label: 'Create lease', icon: 'leaseAdd', requires: 'canCreateLease' },
  { action: 'task', label: 'Create task', icon: 'checklists' },
  { action: 'upload', label: 'Upload document', icon: 'uploadDocument' }
];

// One visit-order snapshot per account/organization for this page load. A route
// remount must not move a clicked property; a full reload creates fresh snapshots.
const sidebarVisitDates = new Map();
function visitDatesForSidebar(user) {
  const scope = getRecentPropertyStorageKey(user);
  if (!scope) return {};
  if (!sidebarVisitDates.has(scope)) sidebarVisitDates.set(scope, readPropertyVisitDates(user));
  return sidebarVisitDates.get(scope);
}

export default function LandlordSidebar({ desktopOpen, desktopWidth, mobileOpen, onMobileClose }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const [propertySearch, setPropertySearch] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState(null);
  const { properties } = useFetchProperties();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const propertiesStatus = useSelector((state) => selectPropertiesLoadStatus(state, organizationId));
  const { user } = useAuth();
  const visitScope = getRecentPropertyStorageKey(user);
  const visitDates = visitDatesForSidebar(user);
  useEffect(() => { setPropertySearch(''); }, [visitScope]);
  useEffect(() => { setTaskDraft(null); }, [organizationId, visitScope]);
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const trialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);

  const propertyRows = sortPropertiesByLastVisit((properties || []).filter((property) => (property.id ?? property.Id) != null)
    .map((property) => {
      const units = property.units ?? property.Units ?? [];
      const hasLongTermUnits = units.some((unit) => rentalMode(unit) !== 'shortTerm');
      return {
        id: property.id ?? property.Id,
        name: property.name || property.Name || property.streetAddress || property.StreetAddress || 'Property',
        address: [property.streetAddress || property.StreetAddress, property.city || property.City, property.state || property.State].filter(Boolean).join(', '),
        image: property.mainImageUrl || property.MainImageUrl || property.images?.[0]?.blobUrl || property.Images?.[0]?.BlobUrl || placeholderImage,
        canRecordPayment: hasLongTermUnits,
        canCreateLease: hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property.propertyType ?? property.PropertyType))
      };
    }), visitDates);
  const searchTerm = propertySearch.trim().toLocaleLowerCase();
  const visibleProperties = propertyRows.filter((property) => `${property.name} ${property.address}`.toLocaleLowerCase().includes(searchTerm));
  const propertiesReady = propertiesStatus === 'ready';

  const runPropertyAction = (action, property, to) => {
    if (action === 'payment') {
      drawer.openPaymentAddDrawer({ property: { id: property.id, name: property.name } });
    } else if (action === 'task') {
      setTaskDraft({ propertyId: property.id });
    } else {
      navigate(to, { state: { propertySidebarAction: action } });
    }
  };

  const renderPropertyNavigation = (variant) => <PropertyNavigation
    key={`${variant}-${organizationId}-${visitScope}`}
    properties={propertiesReady ? visibleProperties : []} total={propertiesReady ? propertyRows.length : null}
    loading={propertiesStatus === 'pending'} search={propertySearch}
    searchId={`property-sidebar-search-${variant}`} onSearch={setPropertySearch} pathname={pathname} disabled={trialExpired} user={user}
    onNavigate={variant === 'mobile' ? onMobileClose : undefined} onAction={runPropertyAction}
    status={propertiesStatus === 'failed' ? 'Failed to load properties' : propertiesReady && propertyRows.length ? 'No matching properties.' : null} />;

  return <>
    <Drawer variant="permanent" open sx={{ display: { xs: 'none', lg: 'block' }, width: desktopWidth, flexShrink: 0,
      '& .MuiDrawer-paper': { width: desktopWidth, boxSizing: 'border-box', height: '100dvh', bgcolor: sidebarBackground, borderRight: '1px solid', borderColor: 'rgba(255, 255, 255, 0.14)' } }}>
      <Box sx={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: desktopOpen ? 'flex-start' : 'center', px: desktopOpen ? 3 : 0,
        bgcolor: sidebarBackground, borderBottom: '1px solid', borderColor: 'rgba(255, 255, 255, 0.14)' }}>
        {desktopOpen ? (
          <Logo darkSurface disableTopPadding width={120} to="/landlord/dashboard" />
        ) : (
          <Box component={Link} to="/landlord/dashboard" sx={{ display: 'grid', placeItems: 'center', width: 44, height: 60,
            '&:focus-visible': { outline: `2px solid ${brand.mint}`, outlineOffset: -2 } }}>
            <Box component="img" src={compactLogo} alt="Property Peace home" width={36} sx={{ display: 'block', height: 'auto' }} />
          </Box>
        )}
      </Box>
      <Box id="landlord-property-navigation" sx={{ display: desktopOpen ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
        {renderPropertyNavigation('desktop')}
      </Box>
      {!desktopOpen && (
        <Box component="nav" aria-label="Property shortcuts"
          sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 1, color: '#FFFFFF',
            '& .MuiIconButton-root': { width: 40, height: 40, '&:focus-visible': { outline: `2px solid ${brand.mint}` } } }}>
          <IconButton component={Link} to="/landlord/properties" aria-label="Properties" title="Properties"
            aria-current={pathname === '/landlord/properties' ? 'page' : undefined} disabled={trialExpired} color="inherit">
            <AppIcon name="properties" size={18} />
          </IconButton>
          <IconButton component={Link} to="/landlord/properties/add" aria-label="Add property" title="Add property" disabled={trialExpired} color="inherit">
            <AppIcon name="add" size={18} />
          </IconButton>
          <IconButton component={Link} to="/landlord/settings" aria-label="Settings" title="Settings" color="inherit" sx={{ mt: 'auto' }}>
            <AppIcon name="settings" size={18} />
          </IconButton>
        </Box>
      )}
    </Drawer>
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
      sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: 300, maxWidth: '90vw', boxSizing: 'border-box', bgcolor: sidebarBackground } }}>
      <Box sx={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.14)' }}>
        <Logo darkSurface disableTopPadding width={120} to="/landlord/dashboard" />
      </Box>
      <Box component="nav" aria-label="Landlord pages" sx={{ maxHeight: '38dvh', overflowY: 'auto', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
        <List dense disablePadding sx={{ py: 1, [`& .${listItemTextClasses.primary}`]: { color: '#FFFFFF' } }}>
          {landlordPrimaryLinks.map(({ label, to }) => (
            <ListItemButton key={label} component={Link} to={to} disabled={trialExpired} onClick={onMobileClose}
              selected={activeLandlordPrimaryLink(pathname, search) === label}
              sx={{ mx: 1.5, borderRadius: 1.5, color: '#FFFFFF', '&.Mui-selected': { bgcolor: 'rgba(185,228,203,0.16)' } }}>
              <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
            </ListItemButton>
          ))}
          <ListItemButton onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen}
            sx={{ mx: 1.5, borderRadius: 1.5, color: '#FFFFFF' }}>
            <AppIcon name="more" style={{ marginRight: 12 }} /><ListItemText primary="More" primaryTypographyProps={{ fontSize: 13 }} />
            <AppIcon name="chevronDown" size={11} style={{ transform: moreOpen ? 'rotate(180deg)' : undefined }} />
          </ListItemButton>
          <Collapse in={moreOpen} unmountOnExit>
            {landlordMoreLinks.filter(({ label }) => label !== 'Settings').map(({ label, to }) => (
              <ListItemButton key={label} component={Link} to={to} onClick={onMobileClose}
                disabled={trialExpired && label !== 'Help'}
                sx={{ mx: 1.5, pl: 4, borderRadius: 1.5, color: '#FFFFFF' }}>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
              </ListItemButton>
            ))}
          </Collapse>
        </List>
      </Box>
      {renderPropertyNavigation('mobile')}
    </Drawer>
    <TaskEditorDrawer open={Boolean(taskDraft) && propertiesReady && !trialExpired} onClose={() => setTaskDraft(null)}
      properties={propertyRows} initialValues={taskDraft} onSave={(form) => dispatch(createTask(form))} />
  </>;
}

function PropertyNavigation({ properties, total, loading, search, searchId, onSearch, pathname, disabled, user, onNavigate, onAction, status }) {
  const scrollRef = useRef(null);
  const propertyListRef = useRef(null);
  const searchButtonRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedPropertyId, setExpandedPropertyId] = useState(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const closeSearch = () => {
    setSearchOpen(false);
    onSearch('');
    searchButtonRef.current?.focus();
  };
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const updateOverflow = () => {
    const node = scrollRef.current;
    if (node) setHasMoreBelow(node.scrollHeight - node.clientHeight - node.scrollTop > 2);
  };
  useEffect(() => {
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    if (scrollRef.current) observer.observe(scrollRef.current);
    if (propertyListRef.current) observer.observe(propertyListRef.current);
    return () => observer.disconnect();
  }, [properties.length]);

  const rowSx = {
    mx: 1.5, my: 0.5, borderRadius: 1.5, color: '#FFFFFF',
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
    '&.Mui-selected': { bgcolor: 'rgba(185, 228, 203, 0.16)', '&:hover': { bgcolor: 'rgba(185, 228, 203, 0.22)' } },
    '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: -2 }
  };
  return <Box component="nav" aria-label="Property navigation" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, bgcolor: sidebarBackground, color: '#FFFFFF' }}>
    <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <Box component={Link} to="/landlord/properties" onClick={(event) => { if (disabled) event.preventDefault(); else onNavigate?.(); }}
        aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
        aria-current={pathname === '/landlord/properties' ? 'page' : undefined}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: '#FFFFFF', textDecoration: 'none',
          '&:hover': { color: '#FFFFFF', textDecoration: 'underline' },
          '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: 3 } }}>
        <AppIcon name="properties" />
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, color: 'inherit' }}>Properties</Typography>
        {total != null && <Typography component="span" variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>{total}</Typography>}
      </Box>
      {!loading && <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton ref={searchButtonRef} aria-label="Search properties" title="Search properties"
          aria-expanded={searchOpen} aria-controls={searchOpen ? searchId : undefined}
          onClick={() => { if (searchOpen) closeSearch(); else setSearchOpen(true); }} size="small" sx={{ color: 'inherit' }}>
          <AppIcon name="search" />
        </IconButton>
        <IconButton component={Link} to="/landlord/properties/add" aria-label="Add property" title="Add property"
          disabled={disabled} onClick={onNavigate} size="small" sx={{ color: 'inherit' }}><AppIcon name="add" /></IconButton>
      </Box>}
    </Box>
    {!loading && <Collapse in={searchOpen} timeout={reducedMotion ? 0 : 240} unmountOnExit sx={{ flexShrink: 0 }}>
      <Box id={searchId} sx={{ px: 1.5, pt: 1, pb: 1 }}>
        <TextField size="small" fullWidth placeholder="Search properties" value={search} onChange={(event) => onSearch(event.target.value)}
          inputRef={(node) => { if (node && searchOpen && document.activeElement === searchButtonRef.current) node.focus(); }}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }}
          slotProps={{ htmlInput: { 'aria-label': 'Search properties' } }}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' }, '&.Mui-focused fieldset': { borderColor: brand.mint } }, '& .MuiInputBase-input': { fontSize: 13, '&::placeholder': { color: 'rgba(255,255,255,0.8)', opacity: 1 } } }} />
      </Box>
    </Collapse>}
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <Box ref={scrollRef} onScroll={updateOverflow} aria-busy={loading || undefined} sx={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.4) transparent',
        '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 3 } }}>
        <List ref={propertyListRef} disablePadding sx={{ pb: 2 }}>
          {properties.map((property, index) => {
            const to = `/landlord/property/${encodeURIComponent(property.id)}`;
            const isActive = pathname === to || pathname.startsWith(`${to}/`);
            const expanded = !disabled && expandedPropertyId === property.id;
            const actionsId = `${searchId}-actions-${encodeURIComponent(property.id)}`;
            const toggleId = `${actionsId}-toggle`;
            return <Box component="li" key={property.id} sx={{ display: 'flex', flexDirection: 'column' }}>
              <ListItemButton component="button" type="button" id={toggleId} disabled={disabled} selected={isActive || expanded}
                aria-expanded={expanded} aria-controls={expanded ? actionsId : undefined}
                onClick={() => setExpandedPropertyId(expanded ? null : property.id)}
                style={{ '--dashboard-deal-delay': dashboardEntranceDelay(index) }}
                sx={{ ...rowSx, ...dashboardSlideDownSx, px: 1.25, gap: 1.25, minHeight: 56, textAlign: 'left' }}>
                <Box component="img" src={property.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = placeholderImage; }}
                  sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1, objectFit: 'cover', bgcolor: 'rgba(255,255,255,0.12)' }} />
                <ListItemText primary={property.name} secondary={property.address && property.address !== property.name ? property.address : null}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: isActive || expanded ? 700 : 500, noWrap: true, title: property.name, sx: { color: '#FFFFFF' } }}
                  secondaryTypographyProps={{ fontSize: 11, noWrap: true, title: property.address, sx: { color: propertySubtitleColor } }} />
                <AppIcon name="chevronDown" size={11} style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: reducedMotion ? undefined : 'transform 240ms ease' }} />
              </ListItemButton>
              <Collapse in={expanded} timeout={reducedMotion ? 0 : 240} unmountOnExit>
                <Box id={actionsId} role="group" aria-labelledby={toggleId} inert={!expanded}
                  sx={{ ml: 3.75, mr: 1.5, mb: 0.5, pl: 0.75, borderLeft: '1px solid rgba(185,228,203,0.28)' }}>
                  {propertyActions.map(({ action, label, icon, requires }) => {
                    const isView = action === 'view';
                    return <ListItemButton key={action} component={isView ? Link : 'button'}
                      {...(isView ? { to, 'aria-current': pathname === to ? 'page' : undefined } : { type: 'button' })}
                      disabled={Boolean(requires && !property[requires])}
                      onClick={() => {
                        if (isView) recordRecentlyViewedProperty(property.id, user);
                        else onAction(action, property, to);
                        onNavigate?.();
                      }}
                      sx={{ ...rowSx, m: 0, width: '100%', minHeight: 36, px: 1, py: 0.5, gap: 1.25, textAlign: 'left' }}>
                      <AppIcon name={icon} size={15} style={{ color: brand.mint }} />
                      <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: propertySubtitleColor }}>{label}</Typography>
                    </ListItemButton>;
                  })}
                </Box>
              </Collapse>
            </Box>;
          })}
        </List>
        {!properties.length && status && <Typography role="status" sx={{ px: 3, py: 1, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{status}</Typography>}
      </Box>
      {hasMoreBelow && properties.length > 0 && <Box aria-hidden="true" sx={{ position: 'absolute', bottom: 0, left: 0, right: 6, height: 28, pointerEvents: 'none',
        background: `linear-gradient(transparent, ${sidebarBackground})` }} />}
    </Box>
    <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.14)', flexShrink: 0, py: 1 }}>
      <ListItemButton component={Link} to="/landlord/settings" onClick={onNavigate}
        selected={pathname === '/landlord/settings' || pathname.startsWith('/landlord/settings/')}
        sx={{ ...rowSx, gap: 1.5, px: 2, minHeight: 44 }}>
        <AppIcon name="settings" />
        <ListItemText primary="Settings" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, sx: { color: '#FFFFFF' } }} />
      </ListItemButton>
    </Box>
  </Box>;
}

LandlordSidebar.propTypes = {
  desktopOpen: PropTypes.bool.isRequired,
  desktopWidth: PropTypes.number.isRequired,
  mobileOpen: PropTypes.bool,
  onMobileClose: PropTypes.func
};
PropertyNavigation.propTypes = {
  properties: PropTypes.array.isRequired, total: PropTypes.number, loading: PropTypes.bool.isRequired, search: PropTypes.string.isRequired,
  searchId: PropTypes.string.isRequired, onSearch: PropTypes.func.isRequired, pathname: PropTypes.string.isRequired, disabled: PropTypes.bool,
  user: PropTypes.object, onNavigate: PropTypes.func, onAction: PropTypes.func.isRequired, status: PropTypes.string
};
