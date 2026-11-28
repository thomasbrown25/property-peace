import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import AppIcon from 'components/AppIcon';
import BrandedIcon from 'components/BrandedIcon';
import {
  Box,
  Button,
  Collapse,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  listItemTextClasses,
  Menu,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material';
import Logo from 'components/logo';
import { brand } from 'themes/brand';
import compactLogo from 'assets/images/logos/logo-white.png';
import wrenMascot from 'assets/images/logos/wren-mascot-resting.webp';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';
import { useOrganization } from 'contexts/OrganizationContext';
import { selectPropertiesLoadStatus } from 'store/property/property.selector';
import { createTask } from 'store/task/task.action';
import useWrenConversations from 'hooks/useWrenConversations';
import {
  getRecentPropertyStorageKey,
  readPropertyVisitDates,
  recordRecentlyViewedProperty,
  sortPropertiesByLastVisit
} from 'utils/recentlyViewedProperties';
import { getConversationId, getConversationTitle, getPropertyConversations } from 'utils/propertySidebarConversations';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { activeLandlordPrimaryLink, landlordMoreLinks, landlordPrimaryLinks } from 'utils/landlordPrimaryNavigation';
import { dashboardEntranceDelay, dashboardSlideDownSx } from 'sections/landlord/dashboard/dashboardEntrance.mjs';
import TaskEditorDrawer from 'sections/landlord/tasks/TaskEditorDrawer';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';

export const LANDLORD_SIDEBAR_WIDTH = 260;
const sidebarBackground = brand.forest;
const propertyMenuWidth = 200;
const addPropertyPath = '/landlord/properties/add';
const propertySubtitleColor = 'rgba(255,255,255,0.72)';
const visibleConversationLimit = 5;
const propertyActions = [
  { action: 'view', label: 'View property', icon: 'house' },
  { action: 'edit', label: 'Edit property', icon: 'edit' },
  { action: 'payment', label: 'Record payment', icon: 'payment', requires: 'canRecordPayment' },
  { action: 'lease', label: 'Create lease', icon: 'createLease', requires: 'canCreateLease' },
  { action: 'task', label: 'Create task', icon: 'createTask' },
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
  const { conversations, isLoading: conversationsLoading, error: conversationsError, archive } = useWrenConversations();
  const { user } = useAuth();
  const visitScope = getRecentPropertyStorageKey(user);
  const visitDates = visitDatesForSidebar(user);
  useEffect(() => {
    setPropertySearch('');
  }, [visitScope]);
  useEffect(() => {
    setTaskDraft(null);
  }, [organizationId, visitScope]);
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const trialExpired =
    subscriptionStatus?.isTrialActive && (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);

  const propertyRows = sortPropertiesByLastVisit(
    (properties || [])
      .filter((property) => (property.id ?? property.Id) != null)
      .map((property) => {
        const units = property.units ?? property.Units ?? [];
        const hasLongTermUnits = units.some((unit) => rentalMode(unit) !== 'shortTerm');
        return {
          id: property.id ?? property.Id,
          name: property.name || property.Name || property.streetAddress || property.StreetAddress || 'Property',
          address: [property.streetAddress || property.StreetAddress, property.city || property.City, property.state || property.State]
            .filter(Boolean)
            .join(', '),
          canRecordPayment: hasLongTermUnits,
          canCreateLease:
            hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property.propertyType ?? property.PropertyType))
        };
      }),
    visitDates
  );
  const searchTerm = propertySearch.trim().toLocaleLowerCase();
  const visibleProperties = propertyRows.filter((property) =>
    `${property.name} ${property.address}`.toLocaleLowerCase().includes(searchTerm)
  );
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

  const renderPropertyNavigation = (variant) => (
    <PropertyNavigation
      key={`${variant}-${organizationId}-${visitScope}`}
      properties={propertiesReady ? visibleProperties : []}
      total={propertiesReady ? propertyRows.length : null}
      loading={propertiesStatus === 'pending'}
      search={propertySearch}
      searchId={`property-sidebar-search-${variant}`}
      onSearch={setPropertySearch}
      pathname={pathname}
      disabled={trialExpired}
      user={user}
      onNavigate={variant === 'mobile' ? onMobileClose : undefined}
      onAction={runPropertyAction}
      conversations={conversations}
      conversationsLoading={conversationsLoading}
      conversationsError={Boolean(conversationsError)}
      onArchiveConversation={archive}
      status={
        propertiesStatus === 'failed'
          ? 'Failed to load properties'
          : propertiesReady && propertyRows.length
            ? 'No matching properties.'
            : null
      }
    />
  );

  return (
    <>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: desktopWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: desktopWidth,
            boxSizing: 'border-box',
            height: '100dvh',
            bgcolor: sidebarBackground,
            borderRight: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.14)'
          }
        }}
      >
        {!desktopOpen && (
          <Box
            sx={{
              height: 60,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: sidebarBackground,
              borderBottom: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.14)'
            }}
          >
            <Box
              component={Link}
              to="/landlord/dashboard"
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 44,
                height: 60,
                '&:focus-visible': { outline: `2px solid ${brand.mint}`, outlineOffset: -2 }
              }}
            >
              <Box component="img" src={compactLogo} alt="Property Peace home" width={36} sx={{ display: 'block', height: 'auto' }} />
            </Box>
          </Box>
        )}
        <Box id="landlord-property-navigation" sx={{ display: desktopOpen ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
          {renderPropertyNavigation('desktop')}
        </Box>
        {!desktopOpen && (
          <Box
            component="nav"
            aria-label="Property shortcuts"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              py: 1,
              color: '#FFFFFF',
              '& .MuiIconButton-root': {
                width: 40,
                height: 40,
                '&.Mui-disabled img': { opacity: 0.38 },
                '&:focus-visible': { outline: `2px solid ${brand.mint}` }
              }
            }}
          >
            <IconButton
              component={Link}
              to="/landlord/properties"
              aria-label="Properties"
              title="Properties"
              aria-current={pathname === '/landlord/properties' ? 'page' : undefined}
              disabled={trialExpired}
              color="inherit"
            >
              <BrandedIcon name="properties" />
            </IconButton>
            <IconButton
              component={Link}
              to="/landlord/properties/add"
              aria-label="Add property"
              title="Add property"
              disabled={trialExpired}
              color="inherit"
            >
              <AppIcon name="add" size={18} />
            </IconButton>
            <IconButton component={Link} to="/landlord/settings" aria-label="Settings" title="Settings" color="inherit" sx={{ mt: 'auto' }}>
              <SettingsOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': { width: 300, maxWidth: '90vw', boxSizing: 'border-box', bgcolor: sidebarBackground }
        }}
      >
        <Box
          sx={{
            height: 60,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            px: 3,
            borderBottom: '1px solid rgba(255, 255, 255, 0.14)'
          }}
        >
          <Logo darkSurface disableTopPadding width={120} to="/landlord/dashboard" />
        </Box>
        <Box
          component="nav"
          aria-label="Landlord pages"
          sx={{ maxHeight: '38dvh', overflowY: 'auto', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.18)' }}
        >
          <List dense disablePadding sx={{ py: 1, [`& .${listItemTextClasses.primary}`]: { color: '#FFFFFF' } }}>
            {landlordPrimaryLinks.map(({ label, to }) => (
              <ListItemButton
                key={label}
                component={Link}
                to={to}
                disabled={trialExpired}
                onClick={onMobileClose}
                selected={activeLandlordPrimaryLink(pathname, search) === label}
                sx={{ mx: 1.5, borderRadius: 1.5, color: '#FFFFFF', '&.Mui-selected': { bgcolor: 'rgba(185,228,203,0.16)' } }}
              >
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
              </ListItemButton>
            ))}
            <ListItemButton
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              sx={{ mx: 1.5, borderRadius: 1.5, color: '#FFFFFF' }}
            >
              <BrandedIcon name="more" size={20} style={{ marginRight: 12, filter: 'brightness(1.55)' }} />
              <ListItemText primary="More" primaryTypographyProps={{ fontSize: 13 }} />
              <AppIcon name="chevronDown" size={11} style={{ transform: moreOpen ? 'rotate(180deg)' : undefined }} />
            </ListItemButton>
            <Collapse in={moreOpen} unmountOnExit>
              {landlordMoreLinks
                .filter(({ label }) => label !== 'Settings')
                .map(({ label, to }) => (
                  <ListItemButton
                    key={label}
                    component={Link}
                    to={to}
                    onClick={onMobileClose}
                    disabled={trialExpired && label !== 'Help'}
                    sx={{ mx: 1.5, pl: 4, borderRadius: 1.5, color: '#FFFFFF' }}
                  >
                    <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13 }} />
                  </ListItemButton>
                ))}
            </Collapse>
          </List>
        </Box>
        {renderPropertyNavigation('mobile')}
      </Drawer>
      <TaskEditorDrawer
        open={Boolean(taskDraft) && propertiesReady && !trialExpired}
        onClose={() => setTaskDraft(null)}
        properties={propertyRows}
        initialValues={taskDraft}
        onSave={(form) => dispatch(createTask(form))}
      />
    </>
  );
}

function PropertyNavigation({
  properties,
  total,
  loading,
  search,
  searchId,
  onSearch,
  pathname,
  disabled,
  user,
  onNavigate,
  onAction,
  conversations,
  conversationsLoading,
  conversationsError,
  onArchiveConversation,
  status
}) {
  const isEmptyPortfolio = total === 0;
  const navigationRef = useRef(null);
  const scrollRef = useRef(null);
  const propertyListRef = useRef(null);
  const searchButtonRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedPropertyId, setExpandedPropertyId] = useState(null);
  const [showAllPropertyIds, setShowAllPropertyIds] = useState(() => new Set());
  const [propertyMenu, setPropertyMenu] = useState(null);
  const [archivingConversationId, setArchivingConversationId] = useState(null);
  const [archiveError, setArchiveError] = useState('');
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

  const openPropertyMenu = (event, property) => {
    const trigger = event.currentTarget;
    const triggerBounds = trigger.getBoundingClientRect();
    const menuLeft = Math.round(navigationRef.current.getBoundingClientRect().right) - 24;
    const fitsBesideSidebar = menuLeft + propertyMenuWidth + 16 <= trigger.ownerDocument.documentElement.clientWidth;

    setPropertyMenu({
      property,
      position: fitsBesideSidebar
        ? { top: Math.round(triggerBounds.top), left: menuLeft }
        : { top: Math.round(triggerBounds.bottom) + 4, left: Math.round(triggerBounds.right) },
      horizontalOrigin: fitsBesideSidebar ? 'left' : 'right'
    });
  };
  const closePropertyMenu = () => setPropertyMenu(null);
  const runMenuAction = (actionConfig) => {
    const property = propertyMenu?.property;
    if (!property) return;
    const to = `/landlord/property/${encodeURIComponent(property.id)}`;
    closePropertyMenu();
    if (actionConfig.action === 'view') recordRecentlyViewedProperty(property.id, user);
    onAction(actionConfig.action, property, to);
    onNavigate?.();
  };

  const archiveChat = async (event, conversationId) => {
    event.preventDefault();
    event.stopPropagation();
    if (archivingConversationId != null) return;
    setArchiveError('');
    setArchivingConversationId(conversationId);
    try {
      const result = await onArchiveConversation(conversationId);
      if (!result?.success) setArchiveError(result?.message || 'Could not archive the conversation.');
    } catch (error) {
      setArchiveError(error?.message || 'Could not archive the conversation.');
    } finally {
      setArchivingConversationId(null);
    }
  };

  const rowSx = {
    mx: 1.5,
    my: 0.25,
    borderRadius: 1.5,
    color: '#FFFFFF',
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
    '&.Mui-selected': { bgcolor: 'rgba(185, 228, 203, 0.16)', '&:hover': { bgcolor: 'rgba(185, 228, 203, 0.22)' } },
    '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: -2 }
  };
  return (
    <Box
      component="nav"
      ref={navigationRef}
      aria-label="Property navigation"
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, bgcolor: sidebarBackground, color: '#FFFFFF' }}
    >
      <Box
        sx={{
          height: 60,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.14)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="img"
            src={wrenMascot}
            alt=""
            sx={{ display: 'block', width: 44, height: 44, flexShrink: 0, objectFit: 'contain' }}
          />
          <Typography component="h1" variant="h5" sx={{ color: 'inherit', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Wren
          </Typography>
        </Box>
        {!loading && !isEmptyPortfolio && (
          <IconButton
            ref={searchButtonRef}
            aria-label="Search properties"
            title="Search properties"
            aria-expanded={searchOpen}
            aria-controls={searchOpen ? searchId : undefined}
            onClick={() => {
              if (searchOpen) closeSearch();
              else setSearchOpen(true);
            }}
            size="small"
            sx={{ color: 'inherit' }}
          >
            <AppIcon name="search" />
          </IconButton>
        )}
      </Box>
      {!loading && !isEmptyPortfolio && (
        <Collapse in={searchOpen} timeout={reducedMotion ? 0 : 240} unmountOnExit sx={{ flexShrink: 0 }}>
          <Box id={searchId} sx={{ px: 1.5, pt: 1, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search properties"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              inputRef={(node) => {
                if (node && searchOpen && document.activeElement === searchButtonRef.current) node.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  closeSearch();
                }
              }}
              slotProps={{ htmlInput: { 'aria-label': 'Search properties' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: brand.mint }
                },
                '& .MuiInputBase-input': { fontSize: 13, '&::placeholder': { color: 'rgba(255,255,255,0.8)', opacity: 1 } }
              }}
            />
          </Box>
        </Collapse>
      )}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Box
          component={Link}
          to="/landlord/properties"
          onClick={(event) => {
            if (disabled) event.preventDefault();
            else onNavigate?.();
          }}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : undefined}
          aria-current={pathname === '/landlord/properties' ? 'page' : undefined}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            color: propertySubtitleColor,
            textDecoration: 'none',
            '&:hover': { color: '#FFFFFF', textDecoration: 'underline' },
            '&:focus-visible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: 3 }
          }}
        >
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, color: 'inherit' }}>
            Properties
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            component={Link}
            to={addPropertyPath}
            aria-label="Add property"
            title="Add property"
            disabled={disabled}
            onClick={onNavigate}
            size="small"
            sx={{ color: 'inherit' }}
          >
            <AppIcon name="add" />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Box
          ref={scrollRef}
          onScroll={updateOverflow}
          aria-busy={loading || undefined}
          sx={{
            height: '100%',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.4) transparent',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 3 }
          }}
        >
          {isEmptyPortfolio && (
            <Box
              sx={{
                mx: 1.5,
                my: 1,
                p: 2,
                border: '1px solid rgba(185, 228, 203, 0.24)',
                borderRadius: 2,
                bgcolor: 'rgba(185, 228, 203, 0.08)'
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 36,
                  height: 36,
                  mb: 1.5,
                  borderRadius: 1.5,
                  color: brand.mint,
                  bgcolor: 'rgba(185, 228, 203, 0.14)'
                }}
              >
                <BrandedIcon name="properties" size={27} />
              </Box>
              <Typography component="h3" variant="subtitle2" sx={{ color: 'inherit', fontWeight: 700 }}>
                No properties yet
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5, color: 'rgba(255, 255, 255, 0.8)' }}>
                Add your first property to manage its units, leases, and tenants.
              </Typography>
              <Button
                component={Link}
                to={addPropertyPath}
                variant="outlined"
                fullWidth
                startIcon={<AppIcon name="add" />}
                disabled={disabled}
                onClick={onNavigate}
                sx={{
                  minHeight: 40,
                  color: brand.mint,
                  borderColor: 'rgba(185, 228, 203, 0.48)',
                  '&:hover': { borderColor: brand.mint, bgcolor: 'rgba(185, 228, 203, 0.12)' },
                  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: brand.mint, outlineOffset: 2 },
                  '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.45)', borderColor: 'rgba(255, 255, 255, 0.18)' }
                }}
              >
                Add property
              </Button>
            </Box>
          )}
          <List ref={propertyListRef} disablePadding sx={{ pb: 2 }}>
            {properties.map((property, index) => {
              const to = `/landlord/property/${encodeURIComponent(property.id)}`;
              const isActive = pathname === to || pathname.startsWith(`${to}/`);
              const expanded = !disabled && expandedPropertyId === property.id;
              const conversationsId = `${searchId}-conversations-${encodeURIComponent(property.id)}`;
              const toggleId = `${conversationsId}-toggle`;
              const propertyConversations = getPropertyConversations(conversations, property.id);
              const showingAll = showAllPropertyIds.has(String(property.id));
              const displayedConversations = showingAll ? propertyConversations : propertyConversations.slice(0, visibleConversationLimit);
              return (
                <Box component="li" key={property.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box
                    style={{ '--dashboard-deal-delay': dashboardEntranceDelay(index) }}
                    sx={{
                      ...dashboardSlideDownSx,
                      mx: 1.5,
                      my: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 1.5,
                      color: '#FFFFFF',
                      bgcolor: isActive || expanded ? 'rgba(185, 228, 203, 0.16)' : 'transparent',
                      '&:hover': { bgcolor: isActive || expanded ? 'rgba(185, 228, 203, 0.22)' : 'rgba(255, 255, 255, 0.08)' }
                    }}
                  >
                    <ListItemButton
                      component="button"
                      type="button"
                      id={toggleId}
                      disabled={disabled}
                      aria-expanded={expanded}
                      aria-controls={expanded ? conversationsId : undefined}
                      onClick={() => setExpandedPropertyId(expanded ? null : property.id)}
                      sx={{
                        minWidth: 0,
                        minHeight: 34,
                        px: 1,
                        py: 0.25,
                        gap: 1,
                        borderRadius: 1.5,
                        color: 'inherit',
                        '&:hover': { bgcolor: 'transparent' },
                        '&:focus-visible': { outline: `2px solid ${brand.mint}`, outlineOffset: -2 }
                      }}
                    >
                      <AppIcon name="house" size={19} />
                      <ListItemText
                        primary={property.name}
                        primaryTypographyProps={{
                          fontSize: 13,
                          fontWeight: 400,
                          noWrap: true,
                          title: property.name,
                          sx: { color: '#FFFFFF' }
                        }}
                      />
                    </ListItemButton>
                    <IconButton
                      aria-label={`Actions for ${property.name}`}
                      title={`Actions for ${property.name}`}
                      size="small"
                      aria-haspopup="menu"
                      onClick={(event) => openPropertyMenu(event, property)}
                      sx={{ width: 30, height: 30, color: 'inherit' }}
                    >
                      <AppIcon name="more" size={14} />
                    </IconButton>
                    <IconButton
                      component={Link}
                      to={`/landlord/ai-center?propertyId=${encodeURIComponent(property.id)}&new=1`}
                      disabled={disabled}
                      aria-label={`New chat for ${property.name}`}
                      title={`New chat for ${property.name}`}
                      size="small"
                      onClick={onNavigate}
                      sx={{ width: 30, height: 30, mr: 0.25, color: 'inherit' }}
                    >
                      <AppIcon name="edit" size={14} />
                    </IconButton>
                  </Box>
                  <Collapse in={expanded} timeout={reducedMotion ? 0 : 240} unmountOnExit>
                    <Box
                      id={conversationsId}
                      role="group"
                      aria-labelledby={toggleId}
                      inert={!expanded}
                      sx={{ ml: 4.75, mr: 1.5, mb: 0.75 }}
                    >
                      {displayedConversations.map((conversation) => {
                        const conversationId = getConversationId(conversation);
                        const title = getConversationTitle(conversation);
                        return (
                          <Box
                            key={conversationId}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: 1.5,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                              '&:focus-within': { bgcolor: 'rgba(255,255,255,0.08)' }
                            }}
                          >
                            <ListItemButton
                              component={Link}
                              to={`/landlord/ai-center?conversationId=${encodeURIComponent(conversationId)}`}
                              onClick={onNavigate}
                              sx={{
                                minWidth: 0,
                                minHeight: 36,
                                px: 1,
                                py: 0.25,
                                borderRadius: 1.5,
                                color: propertySubtitleColor,
                                '&:hover': { bgcolor: 'transparent' },
                                '&:focus-visible': { outline: `2px solid ${brand.mint}`, outlineOffset: -2 }
                              }}
                            >
                              <ListItemText
                                primary={title}
                                primaryTypographyProps={{ fontSize: 13, fontWeight: 400, noWrap: true, title, sx: { color: 'inherit' } }}
                              />
                            </ListItemButton>
                            <IconButton
                              aria-label={`Archive ${title}`}
                              title={`Archive ${title}`}
                              size="small"
                              disabled={archivingConversationId != null}
                              onClick={(event) => archiveChat(event, conversationId)}
                              sx={{ width: 30, height: 30, color: propertySubtitleColor, '&:hover': { color: '#FFFFFF' } }}
                            >
                              <ArchiveOutlined sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Box>
                        );
                      })}
                      {propertyConversations.length === 0 && (
                        <Typography role="status" sx={{ px: 1, py: 0.75, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                          {conversationsLoading
                            ? 'Loading Wren chats…'
                            : conversationsError
                              ? 'Could not load Wren chats.'
                              : 'No Wren chats yet'}
                        </Typography>
                      )}
                      {propertyConversations.length > visibleConversationLimit && (
                        <Button
                          type="button"
                          size="small"
                          onClick={() =>
                            setShowAllPropertyIds((current) => {
                              const next = new Set(current);
                              if (showingAll) next.delete(String(property.id));
                              else next.add(String(property.id));
                              return next;
                            })
                          }
                          sx={{
                            minWidth: 0,
                            px: 1,
                            py: 0.25,
                            color: 'rgba(255,255,255,0.62)',
                            textTransform: 'none',
                            fontSize: 13,
                            '&:hover': { color: '#FFFFFF', bgcolor: 'transparent' }
                          }}
                        >
                          {showingAll ? 'Show less' : 'Show more'}
                        </Button>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>
          {archiveError && (
            <Typography role="alert" sx={{ px: 3, pb: 1, fontSize: 12, color: '#FFD0D0' }}>
              {archiveError}
            </Typography>
          )}
          {!properties.length && status && (
            <Typography role="status" sx={{ px: 3, py: 1, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              {status}
            </Typography>
          )}
        </Box>
        {hasMoreBelow && properties.length > 0 && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 6,
              height: 28,
              pointerEvents: 'none',
              background: `linear-gradient(transparent, ${sidebarBackground})`
            }}
          />
        )}
      </Box>
      <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.14)', flexShrink: 0, py: 0.5 }}>
        <ListItemButton
          component={Link}
          to="/landlord/settings"
          onClick={onNavigate}
          selected={pathname === '/landlord/settings' || pathname.startsWith('/landlord/settings/')}
          sx={{ ...rowSx, gap: 1, px: 1, py: 0.25, minHeight: 36 }}
        >
          <SettingsOutlined sx={{ fontSize: 19, flexShrink: 0 }} />
          <ListItemText primary="Settings" primaryTypographyProps={{ fontSize: 13, fontWeight: 400, sx: { color: '#FFFFFF' } }} />
        </ListItemButton>
      </Box>
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={propertyMenu?.position}
        open={Boolean(propertyMenu)}
        onClose={closePropertyMenu}
        transformOrigin={{ vertical: 'top', horizontal: propertyMenu?.horizontalOrigin ?? 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: propertyMenuWidth,
              bgcolor: sidebarBackground,
              backgroundImage: 'none',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.14)',
              '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible': {
                bgcolor: 'rgba(255,255,255,0.12)'
              }
            }
          }
        }}
      >
        {propertyActions.map((actionConfig) => (
          <MenuItem
            key={actionConfig.action}
            disabled={Boolean(actionConfig.requires && !propertyMenu?.property?.[actionConfig.requires])}
            onClick={() => runMenuAction(actionConfig)}
            sx={{ gap: 1.25, fontSize: 13 }}
          >
            <ListItemIcon sx={{ minWidth: '24px !important' }}>
              <BrandedIcon name={actionConfig.icon} size={19} />
            </ListItemIcon>
            {actionConfig.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

LandlordSidebar.propTypes = {
  desktopOpen: PropTypes.bool.isRequired,
  desktopWidth: PropTypes.number.isRequired,
  mobileOpen: PropTypes.bool,
  onMobileClose: PropTypes.func
};
PropertyNavigation.propTypes = {
  properties: PropTypes.array.isRequired,
  total: PropTypes.number,
  loading: PropTypes.bool.isRequired,
  search: PropTypes.string.isRequired,
  searchId: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
  pathname: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  user: PropTypes.object,
  onNavigate: PropTypes.func,
  onAction: PropTypes.func.isRequired,
  conversations: PropTypes.array.isRequired,
  conversationsLoading: PropTypes.bool.isRequired,
  conversationsError: PropTypes.bool.isRequired,
  onArchiveConversation: PropTypes.func.isRequired,
  status: PropTypes.string
};
