import { useState, useMemo, useEffect, useRef } from 'react';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Button,
  FormControl,
  Select,
  MenuItem,
  Menu,
  MenuList,
  ListItemText,
  Divider,
  Pagination,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  alpha,
  useTheme,
  Card,
  CardContent,
  Slide,
  Fade,
  OutlinedInput,
  InputAdornment
} from '@mui/material';
import { PlusOutlined, FilterOutlined, CloseOutlined, HomeFilled, HomeOutlined, TeamOutlined, FileTextOutlined, UserOutlined, SafetyOutlined, LeftOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { calculateOccupancyPercentage } from 'utils/helper-methods';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';

import PropertyCard from 'components/cards/PropertyCard';
import PropertyUnitCard from 'components/cards/PropertyUnitCard';
import { setProperty } from 'store/property/property.action';
import Avatar from 'components/@extended/Avatar';

import useFetchProperties from 'hooks/useFetchProperties';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

// Enhanced components
import PropertiesEmptyState from 'sections/landlord/properties/PropertiesEmptyState';
import AnimateIn from 'components/AnimateIn';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import PropertiesMultiMap from 'components/maps/PropertiesMultiMap';
import PropertyListCard from 'sections/landlord/properties/PropertyListCard';
import { AppstoreOutlined, UnorderedListOutlined, EnvironmentOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { PropertyCsvImportButton } from 'components/import/CsvImportButtons';

const getPropertyUnits = (property) => property?.units || property?.Units || [];

const getOpenHighMaintenanceCount = (property) => {
  const maintenanceRequests = property?.maintenanceRequests || property?.MaintenanceRequests || [];
  return maintenanceRequests.filter(
    (request) =>
      (request.priority || request.Priority || '').toLowerCase() === 'high' &&
      !['completed', 'cancelled'].includes((request.status || request.Status || '').toLowerCase())
  ).length;
};

const getOverdueUnitCount = (property) =>
  getPropertyUnits(property).filter((unit) => (unit.status || unit.Status || '').toLowerCase() === 'overdue').length;

const getAttentionScore = (property) => getOverdueUnitCount(property) * 2 + getOpenHighMaintenanceCount(property);

const propertyNeedsAttention = (property) => getAttentionScore(property) > 0;

const propertyIsOccupied = (property) => {
  const units = getPropertyUnits(property);
  if (units.length > 0) {
    return units.some((unit) => ['occupied', 'overdue'].includes((unit.status || unit.Status || '').toLowerCase()));
  }

  return Boolean(property?.isOccupied || property?.IsOccupied);
};

const propertyAccentPanelSx = (accentColor, extra = {}) => ({
  ...extra,
  position: 'relative',
  bgcolor: 'background.paper',
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha(accentColor, 0.36) : alpha(t.palette.divider, 0.16)}`,
  boxShadow: (t) => t.palette.mode === 'dark'
    ? `0 18px 46px ${alpha(t.palette.common.black, 0.24)}, 0 0 0 1px ${alpha(accentColor, 0.18)}, 0 0 28px ${alpha(accentColor, 0.14)}`
    : `0 4px 20px ${alpha(accentColor, 0.07)}`,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: `linear-gradient(90deg, ${alpha(accentColor, 0.9)} 0%, ${alpha(accentColor, 0.35)} 44%, transparent 100%)`,
    pointerEvents: 'none',
    zIndex: 2
  },
  '&:hover': {
    borderColor: (t) => t.palette.mode === 'dark' ? alpha(accentColor, 0.44) : alpha(accentColor, 0.24),
    boxShadow: (t) => t.palette.mode === 'dark'
      ? `0 20px 52px ${alpha(t.palette.common.black, 0.28)}, 0 0 0 1px ${alpha(accentColor, 0.26)}, 0 0 34px ${alpha(accentColor, 0.18)}`
      : `0 6px 24px ${alpha(accentColor, 0.1)}`
  }
});

export default function Properties() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const { propertiesRefetch, isLoading } = useFetchProperties();
  const properties = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);
  // Get context to update properties page loading state
  const { setPropertiesLoading } = useDashboardLoading();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0: Properties, 1: Units, 2: Tenants, 3: Applications, 4: Screenings
  const [unitsPage, setUnitsPage] = useState(0);
  const [unitsItemsPerPage, setUnitsItemsPerPage] = useState(10);
  const [previousTab, setPreviousTab] = useState(0);
  const [slideDirection, setSlideDirection] = useState('left');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'cards' | 'table'
  const [selectedMapPropertyId, setSelectedMapPropertyId] = useState(null);
  const [activeMetricFilter, setActiveMetricFilter] = useState('all');
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const [filters, setFilters] = useState({
    propertyType: null,
    status: 'Active',
    occupancy: null
  });

  const PER_PAGE = 6;

  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in animation on mount - start immediately so components can render
  useEffect(() => {
    // Set fadeIn immediately so components render, even if they start with opacity 0
    setFadeIn(true);
  }, []);

  // Update the context whenever the properties page loading state changes
  useEffect(() => {
    setPropertiesLoading(isLoading);
  }, [isLoading, setPropertiesLoading]);

  // Reset property selection when leaving this page
  const location = useLocation();
  const previousPathname = useRef(null);
  useEffect(() => {
    const isOnThisPage = location.pathname === '/landlord/properties';
    const justNavigatedAway = previousPathname.current === '/landlord/properties' && !isOnThisPage;

    if (justNavigatedAway && selectedProperty) {
      dispatch(setProperty(null));
    }

    previousPathname.current = location.pathname;
  }, [location.pathname, dispatch, selectedProperty]);

  // refetch properties on mount
  useEffect(() => {
    propertiesRefetch();
  }, [propertiesRefetch]);

  useEffect(() => {
    dispatch(setProperty(null));
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Check URL query parameter for view and set active tab
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'units') {
      setActiveTab(1);
    } else if (view === 'tenants') {
      setActiveTab(2);
    } else if (view === 'applications') {
      setActiveTab(3);
    } else if (view === 'screenings') {
      setActiveTab(4);
    } else {
      setActiveTab(0);
    }
  }, [searchParams]);

  // Handle tab change and update URL
  const handleTabChange = (event, newValue) => {
    // Determine slide direction based on tab movement
    if (newValue > activeTab) {
      // Moving right (e.g., Properties -> Units)
      setSlideDirection('left'); // New content comes from right (slides in from right to left)
    } else if (newValue < activeTab) {
      // Moving left (e.g., Tenants -> Units)
      setSlideDirection('right'); // New content comes from left (slides in from left to right)
    }

    setPreviousTab(activeTab);
    setActiveTab(newValue);

    // Update URL query parameter
    const params = new URLSearchParams(searchParams);
    if (newValue === 1) {
      params.set('view', 'units');
    } else if (newValue === 2) {
      params.set('view', 'tenants');
    } else if (newValue === 3) {
      params.set('view', 'applications');
    } else if (newValue === 4) {
      params.set('view', 'screenings');
    } else {
      params.delete('view');
    }
    navigate(`/landlord/properties?${params.toString()}`, { replace: true });
  };

  // The Properties page should always show the full portfolio list.
  // Global selectedProperty is used by other workflows (for example, preselecting a lease property),
  // but it should not narrow this page after creating or selecting a property elsewhere.
  const filteredByProperty = useMemo(() => properties || [], [properties]);

  // --- Filter by status ---
  const baseFiltered = useMemo(() => {
    if (!filteredByProperty) return [];
    // Filter by status if set
    if (filters.status === 'Active') {
      return filteredByProperty.filter((p) => p.isActive);
    }
    if (filters.status === 'Archived') {
      return filteredByProperty.filter((p) => !p.isActive);
    }
    // If no status filter (null), show all properties
    return filteredByProperty;
  }, [filteredByProperty, filters.status]);

  // --- Filter + sort ---
  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searchableText = (value) => (value == null ? '' : String(value).toLowerCase());
    const tenantMatches = (tenant) => [
      tenant?.firstName,
      tenant?.FirstName,
      tenant?.lastName,
      tenant?.LastName,
      tenant?.name,
      tenant?.Name,
      tenant?.email,
      tenant?.Email,
      tenant?.phone,
      tenant?.Phone
    ].some((value) => searchableText(value).includes(query));
    const unitMatches = (unit) => {
      const tenants = unit?.tenants || unit?.Tenants || (unit?.tenant || unit?.Tenant ? [unit?.tenant || unit?.Tenant] : []);
      return [
        unit?.name,
        unit?.Name,
        unit?.unitName,
        unit?.UnitName,
        unit?.unitNumber,
        unit?.UnitNumber,
        unit?.number,
        unit?.Number,
        unit?.label,
        unit?.Label
      ].some((value) => searchableText(value).includes(query)) || tenants.some(tenantMatches);
    };

    let list = baseFiltered.filter((p) => {
      const units = p.units || p.Units || [];
      const propertyTenants = p.tenants || p.Tenants || [];
      const matchesSearch = !query || [
        p.name,
        p.Name,
        p.streetAddress,
        p.StreetAddress,
        p.city,
        p.City
      ].some((value) => searchableText(value).includes(query)) || units.some(unitMatches) || propertyTenants.some(tenantMatches);

      if (filters.propertyType && p.propertyType !== filters.propertyType) return false;

      if (filters.occupancy) {
        const occupancy = calculateOccupancyPercentage(p.units || []);
        if (filters.occupancy === 'Occupied' && occupancy === 0) return false;
        if (filters.occupancy === 'Vacant' && occupancy > 0) return false;
        if (filters.occupancy === 'Partially Occupied' && (occupancy === 0 || occupancy === 100)) return false;
        if (filters.occupancy === 'Fully Occupied' && occupancy !== 100) return false;
      }

      if (activeMetricFilter === 'vacant' && propertyIsOccupied(p)) return false;
      if (activeMetricFilter === 'occupied' && !propertyIsOccupied(p)) return false;
      if (activeMetricFilter === 'attention' && !propertyNeedsAttention(p)) return false;

      return matchesSearch;
    });

    return list.sort((a, b) => new Date(b.dateListed) - new Date(a.dateListed));
  }, [baseFiltered, search, filters, activeMetricFilter]);

  const attentionSortedProperties = useMemo(
    () =>
      [...filteredProperties].sort((a, b) => {
        const attentionDifference = getAttentionScore(b) - getAttentionScore(a);
        if (attentionDifference !== 0) return attentionDifference;
        return new Date(b.dateListed || b.DateListed || 0) - new Date(a.dateListed || a.DateListed || 0);
      }),
    [filteredProperties]
  );

  // Get properties with units (for Units tab)
  const propertiesWithUnits = useMemo(() => {
    if (!properties || !Array.isArray(properties)) return [];
    // Filter to show only properties that have units or are single-family
    return properties.filter(property => {
      const isSingleFamily = property.propertyType === 'singleFamily';
      const hasUnits = property.units && Array.isArray(property.units) && property.units.length > 0;
      return isSingleFamily || hasUnits;
    });
  }, [properties]);

  // Pagination for units tab
  const unitsTotalPages = Math.ceil(propertiesWithUnits.length / unitsItemsPerPage);
  const paginatedUnits = useMemo(() => {
    const startIndex = unitsPage * unitsItemsPerPage;
    const endIndex = startIndex + unitsItemsPerPage;
    return propertiesWithUnits.slice(startIndex, endIndex);
  }, [propertiesWithUnits, unitsPage, unitsItemsPerPage]);

  // Reset units page when items per page changes
  useEffect(() => {
    setUnitsPage(0);
  }, [unitsItemsPerPage]);

  const handleUnitsPageChange = (newPage) => {
    setUnitsPage(newPage);
  };

  // --- KPIs ---
  const kpis = useMemo(() => {
    const allProps = properties || [];
    let totalUnits = 0, occupiedUnits = 0, monthlyRent = 0;
    allProps.forEach((p) => {
      const units = getPropertyUnits(p);
      units.forEach((u) => {
        totalUnits++;
        const status = (u.status || u.Status || '').toLowerCase();
        if (status === 'occupied' || status === 'overdue') {
          occupiedUnits++;
          monthlyRent += parseFloat(u.rentAmount || u.RentAmount || 0);
        }
      });
    });
    const occupiedProperties = allProps.filter(propertyIsOccupied).length;
    const needAttention = allProps.filter(propertyNeedsAttention).length;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    return { occupancyRate, occupiedUnits, totalUnits, monthlyRent, needAttention, occupiedProperties };
  }, [properties]);

  // --- Pagination ---
  const count = Math.ceil(filteredProperties.length / PER_PAGE);
  const paginated = filteredProperties.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const FILTER_CHIPS = [
    { key: 'all', label: `All properties (${(properties || []).length})` },
    { key: 'occupied', label: `Occupied (${kpis.occupiedProperties})` },
    { key: 'vacant', label: `Vacant (${Math.max((properties || []).length - kpis.occupiedProperties, 0)})` },
    { key: 'attention', label: `Needs attention (${kpis.needAttention})` }
  ];

  return (
    <>
      <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible', mx: { xs: -0.5, sm: 0 }, pb: { xs: 1, sm: 0 } }}>

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <PageBreadcrumbs items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Properties' }
          ]} />
        </Box>

        {/* ── New Header ── */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <Box
            sx={propertyAccentPanelSx(theme.palette.primary.main, {
              mb: { xs: 1.75, md: 2.5 },
              p: { xs: 2, md: 2.5 },
              borderRadius: { xs: 3, md: 2.25 },
              overflow: 'hidden',
              boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 18px 46px ${alpha(t.palette.common.black, 0.24)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 0 28px ${alpha(theme.palette.primary.main, 0.14)}`
                : `0 10px 30px ${alpha('#0f2d4a', 0.08)}`,
              ...(theme.palette.mode === 'dark' && {
                backgroundColor: '#111827',
                backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.035)} 0%, ${alpha('#ffffff', 0.005)} 100%)`
              })
            })}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
              {/* Left: title + KPIs */}
              <Box>
                <Typography variant="h4" fontWeight={700} sx={{ mb: 0.25 }}>Properties</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {(properties||[]).length} properties · {kpis.totalUnits} units
                </Typography>
                {/* KPI chips */}
                <Stack
                  direction="row"
                  flexWrap={{ xs: 'nowrap', md: 'wrap' }}
                  sx={{
                    gap: { xs: 0, md: 1.5 },
                    mt: 1.5,
                    justifyContent: { xs: 'space-between', md: 'flex-start' },
                    '& > .MuiBox-root': { minWidth: 0, flex: { xs: '1 1 0', md: '0 0 auto' } }
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase' }}>Occupancy</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{kpis.occupancyRate}%</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{kpis.occupiedUnits} / {kpis.totalUnits} units</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.28) }} />
                  <Box>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase' }}>Monthly Rent Roll</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem', lineHeight: 1.2, color: theme.palette.success.main }}>${Math.round(kpis.monthlyRent).toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>collected this month</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.28) }} />
                  <Box>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase' }}>Need Attention</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem', lineHeight: 1.2, color: kpis.needAttention > 0 ? theme.palette.error.main : 'text.primary' }}>{kpis.needAttention}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>tickets · lease · turnover</Typography>
                  </Box>
                </Stack>
              </Box>
              {/* Right: buttons */}
              <Stack direction="row" spacing={1} flexShrink={0} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <PropertyCsvImportButton
                  buttonProps={{
                    sx: { textTransform: 'none', fontWeight: 600, borderRadius: 1.5, borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.28) : alpha(t.palette.divider, 0.38), flex: { xs: 1, md: 'none' } }
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<PlusOutlined />}
                  onClick={() => drawer.openPropertyAddWorkflowDrawer()}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`, flex: { xs: 1, md: 'none' } }}
                >
                  Add property
                </Button>
              </Stack>
            </Stack>
          </Box>
        </AnimateIn>

        {/* ── View/Filter bar ── */}
        <AnimateIn direction="bottom" delay={200} distance={120}>
          <Box sx={{ mb: 2 }}>
            {/* Row 1: search (full width on mobile) */}
            <OutlinedInput
              size="small"
              fullWidth
              placeholder="Search by name, address, tenant..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                </InputAdornment>
              }
              sx={{ mb: 1, bgcolor: 'background.paper', borderRadius: 1.5, '& .MuiOutlinedInput-notchedOutline': { borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.28) } }}
            />

            {/* Row 2: filter chips (scroll) + view toggle */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              {/* Filter chips — horizontally scrollable */}
              <Box sx={{
                flex: 1, minWidth: 0, display: 'flex', gap: 0.75, overflowX: 'auto',
                scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }
              }}>
                {FILTER_CHIPS.map((chip) => (
                  <Chip
                    key={chip.key}
                    label={chip.label}
                    size="small"
                    onClick={() => setActiveMetricFilter(chip.key)}
                    sx={{
                      height: 28, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      bgcolor: activeMetricFilter === chip.key ? 'primary.main' : 'background.paper',
                      color: activeMetricFilter === chip.key ? 'primary.contrastText' : 'text.secondary',
                      border: (t) => `1px solid ${activeMetricFilter === chip.key ? alpha(t.palette.primary.main, 0.55) : (t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.28))}`,
                      '&:hover': { bgcolor: activeMetricFilter === chip.key ? 'primary.main' : (t) => alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.5 : 0.7) }
                    }}
                  />
                ))}
              </Box>

              {/* View toggle — always right-aligned, hidden on mobile */}
              <Stack direction="row" spacing={0.5} flexShrink={0} sx={{ display: { xs: 'none', sm: 'flex' }, bgcolor: 'background.paper', border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.24)}`, borderRadius: 1.5, p: 0.4 }}>
                {[
                  { key: 'map', icon: <EnvironmentOutlined />, label: 'Map' },
                  { key: 'cards', icon: <AppstoreOutlined />, label: 'Cards' },
                  { key: 'table', icon: <UnorderedListOutlined />, label: 'Table' },
                ].map((v) => (
                  <Button
                    key={v.key}
                    size="small"
                    startIcon={v.icon}
                    onClick={() => setViewMode(v.key)}
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.8rem',
                      borderRadius: 1, px: { xs: 0.75, sm: 1.5 }, py: 0.5, minWidth: 0,
                      ...(viewMode === v.key
                        ? { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' } }
                        : { color: 'text.secondary' })
                    }}
                  >
                    {/* Hide label on xs, show icon only */}
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{v.label}</Box>
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Box>
        </AnimateIn>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl) && !clickedChipFilter}
        onClose={() => {
          setFilterAnchorEl(null);
          setSubMenuAnchorEl(null);
          setActiveSubMenu(null);
          setClickedChipFilter(null);
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        <MenuList>
          {/* Property Type Filter */}
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('propertyType');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Property Type" />
            {filters.propertyType && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {filters.propertyType === 'singleFamily' ? 'Single Unit' : filters.propertyType === 'multiUnit' ? 'Multi Unit' : filters.propertyType}
              </Typography>
            )}
          </MenuItem>

          {/* Status Filter */}
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('status');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Status" />
            {filters.status && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {filters.status}
              </Typography>
            )}
          </MenuItem>

          {/* Occupancy Filter */}
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('occupancy');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Occupancy" />
            {filters.occupancy && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {filters.occupancy}
              </Typography>
            )}
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Submenu for Filter Options */}
      <Menu
        anchorEl={subMenuAnchorEl}
        open={Boolean(subMenuAnchorEl) && (activeSubMenu === 'propertyType' || activeSubMenu === 'status' || activeSubMenu === 'occupancy')}
        onClose={() => {
          setSubMenuAnchorEl(null);
          setActiveSubMenu(null);
          setFilterAnchorEl(null);
          setClickedChipFilter(null);
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        <MenuList>
          {activeSubMenu === 'propertyType' && (
            <>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, propertyType: null }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
              >
                <ListItemText primary="All Types" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, propertyType: 'singleFamily' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.propertyType === 'singleFamily'}
              >
                <ListItemText primary="Single Unit" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, propertyType: 'multiUnit' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.propertyType === 'multiUnit'}
              >
                <ListItemText primary="Multi Unit" />
              </MenuItem>
            </>
          )}
          {activeSubMenu === 'status' && (
            <>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: null }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
              >
                <ListItemText primary="All Statuses" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: 'Active' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'Active'}
              >
                <ListItemText primary="Active" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: 'Archived' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'Archived'}
              >
                <ListItemText primary="Archived" />
              </MenuItem>
            </>
          )}
          {activeSubMenu === 'occupancy' && (
            <>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, occupancy: null }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
              >
                <ListItemText primary="All Occupancy" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, occupancy: 'Vacant' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.occupancy === 'Vacant'}
              >
                <ListItemText primary="Vacant" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, occupancy: 'Partially Occupied' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.occupancy === 'Partially Occupied'}
              >
                <ListItemText primary="Partially Occupied" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, occupancy: 'Fully Occupied' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.occupancy === 'Fully Occupied'}
              >
                <ListItemText primary="Fully Occupied" />
              </MenuItem>
            </>
          )}
        </MenuList>
      </Menu>

        {/* ── Property Display ── */}
        <AnimateIn direction="bottom" delay={300} distance={120}>
          {isLoading ? (
            <Box textAlign="center" py={5}><CircularProgress size={24} /></Box>
          ) : filteredProperties.length === 0 ? (
            <PropertiesEmptyState />
          ) : viewMode === 'map' ? (
            /* Map view: map left + list right */
            <Box sx={{ display: 'flex', gap: 2, height: { xs: 'auto', sm: 'calc(100vh - 280px)' }, minHeight: { xs: 0, sm: 500 } }}>
              {/* Map — hidden on mobile */}
              <Box sx={propertyAccentPanelSx(theme.palette.info.main, { display: { xs: 'none', sm: 'block' }, flex: '1 1 60%', borderRadius: 3, overflow: 'hidden' })}>
                <PropertiesMultiMap
                  properties={filteredProperties}
                  selectedPropertyId={selectedMapPropertyId}
                  onPropertyClick={setSelectedMapPropertyId}
                />
              </Box>
              {/* List */}
              <Box
                sx={propertyAccentPanelSx(theme.palette.primary.main, {
                  width: { xs: '100%', sm: 400 },
                  flexShrink: { xs: 1, sm: 0 },
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  overflow: 'hidden',
                  boxShadow: (t) => t.palette.mode === 'dark'
                    ? `0 18px 46px ${alpha(t.palette.common.black, 0.24)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 0 28px ${alpha(theme.palette.primary.main, 0.14)}`
                    : `0 10px 30px ${alpha('#0f2d4a', 0.07)}`,
                  ...(theme.palette.mode === 'dark' && {
                    backgroundColor: '#111827',
                    backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.035)} 0%, ${alpha('#ffffff', 0.005)} 100%)`
                  })
                })}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.16)}` }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase' }}>
                    {filteredProperties.length} properties · sorted by attention
                  </Typography>
                </Box>
                <Box sx={{ flex: { xs: 'none', sm: 1 }, overflowY: { xs: 'visible', sm: 'auto' }, p: 1.25, bgcolor: (t) => t.palette.mode === 'dark' ? alpha('#020617', 0.16) : 'transparent' }}>
                  <Stack spacing={1}>
                    {attentionSortedProperties.map((p) => (
                      <PropertyListCard
                        key={p.id || p.Id}
                        property={p}
                      />
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Box>
          ) : (
            /* Cards / Table view */
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Main content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {viewMode === 'table' ? (
                  /* Table view */
                  <Box sx={propertyAccentPanelSx(theme.palette.success.main, { bgcolor: 'background.paper', borderRadius: 3, overflow: 'hidden' })}>
                    {/* Table header */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', px: 2, py: 1.25, borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.12)}`, bgcolor: (t) => t.palette.mode === 'dark' ? alpha(t.palette.success.main, 0.06) : alpha(t.palette.success.main, 0.03) }}>
                      {['Property', 'Address', 'Status', 'Beds/Baths', 'Rent/mo', 'Lease ends'].map((h) => (
                        <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary', textTransform: 'uppercase' }}>
                          {h}
                        </Typography>
                      ))}
                    </Box>
                    {filteredProperties.map((p, idx) => {
                      const units = p.units || p.Units || [];
                      const firstUnit = units[0];
                      const lease = firstUnit?.lease || firstUnit?.Lease;
                      const unitStatus = (firstUnit?.status || firstUnit?.Status || '').toLowerCase();
                      const isOccupied = unitStatus === 'occupied' || unitStatus === 'overdue' || p.isOccupied;
                      const statusLabel = unitStatus === 'overdue' ? 'Overdue' : isOccupied ? 'Occupied' : 'Vacant';
                      const statusColor = unitStatus === 'overdue' ? 'error' : isOccupied ? 'success' : 'warning';
                      const rent = lease?.rentAmount || lease?.RentAmount || firstUnit?.rentAmount || firstUnit?.RentAmount || 0;
                      const leaseEnd = lease?.endDate || lease?.EndDate;
                      const beds = firstUnit?.bedrooms || firstUnit?.Bedrooms || '—';
                      const baths = firstUnit?.baths || firstUnit?.Baths || '—';
                      const address = [p.streetAddress?.split(',')[0], p.city].filter(Boolean).join(', ');
                      return (
                        <Box
                          key={p.id || idx}
                          onClick={() => navigate(`/landlord/property/${p.id || p.Id}`)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr',
                            px: 2, py: 1.25,
                            cursor: 'pointer',
                            borderBottom: idx < filteredProperties.length - 1 ? (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.12) : alpha(t.palette.divider, 0.1)}` : 'none',
                            transition: 'background 0.15s',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ pr: 1 }}>{p.name || p.streetAddress}</Typography>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ pr: 1, fontSize: '0.82rem' }}>{address}</Typography>
                          <Box>
                            <Chip label={statusLabel} size="small" color={statusColor}
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>{beds} / {baths}</Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem', color: rent > 0 ? theme.palette.success.main : 'text.disabled' }}>
                            {rent > 0 ? `$${rent.toLocaleString()}` : '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                            {leaseEnd ? new Date(leaseEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  /* Cards grid */
                  <>
                    <Grid container spacing={2.5} alignItems="stretch">
                      {paginated.map((property) => (
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={property.id}>
                          <PropertyCard property={property} />
                        </Grid>
                      ))}
                    </Grid>
                    {count > 1 && (
                      <Stack sx={{ alignItems: 'flex-end', p: 2.5, my: 0.5 }}>
                        <Pagination
                          count={count}
                          size="medium"
                          page={page}
                          showFirstButton
                          showLastButton
                          variant="combined"
                          color="primary"
                          onChange={(e, p) => setPage(p)}
                        />
                      </Stack>
                    )}
                  </>
                )}
              </Box>
              {/* Right: attention list */}
              <Box
                sx={propertyAccentPanelSx(theme.palette.warning.main, {
                  width: 400,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  overflow: 'hidden',
                  alignSelf: 'flex-start',
                  position: 'sticky',
                  top: 16,
                  ...(theme.palette.mode === 'dark' && {
                    backgroundColor: '#111827',
                    backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.035)} 0%, ${alpha('#ffffff', 0.005)} 100%)`
                  })
                })}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.16)}` }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase' }}>
                    {filteredProperties.length} properties · sorted by attention
                  </Typography>
                </Box>
                <Box sx={{ maxHeight: 600, overflowY: 'auto', p: 1.25, bgcolor: (t) => t.palette.mode === 'dark' ? alpha('#020617', 0.16) : 'transparent' }}>
                  <Stack spacing={1}>
                    {attentionSortedProperties.map((p) => (
                      <PropertyListCard key={p.id || p.Id} property={p} />
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Box>
          )}
        </AnimateIn>
      </Box>
    </Fade>

    <LeaseAddDrawer />
    </>
  );
}
