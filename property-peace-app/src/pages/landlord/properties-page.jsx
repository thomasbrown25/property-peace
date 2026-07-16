import { useState, useMemo, useEffect } from 'react';
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
  Pagination,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  alpha,
  useTheme,
  Fade
} from '@mui/material';
import { AppstoreOutlined, TableOutlined, HomeFilled } from '@ant-design/icons';
import { calculateOccupancyPercentage } from 'utils/helper-methods';
import MainCard from 'components/MainCard';

import PropertyCard from 'components/cards/PropertyCard';
import PropertySelect from 'components/PropertySelect';
import PropertiesTableView from 'components/property/PropertiesTableView';
import { setProperty } from 'store/property/property.action';

import useFetchProperties from 'hooks/useFetchProperties';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { useDrawer } from 'contexts/DrawerContext';
import { getSettings, saveSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';

// Enhanced components
import PropertiesHeader from 'sections/landlord/properties/PropertiesHeader';
import PropertiesEmptyState from 'sections/landlord/properties/PropertiesEmptyState';
import PropertiesOverviewCards from 'sections/landlord/properties/PropertiesOverviewCards';
import AnimateIn from 'components/AnimateIn';
import { PropertyCsvImportButton } from 'components/import/CsvImportButtons';

export default function PropertiesPage() {
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const theme = useTheme();
  const { propertiesRefetch, isLoading } = useFetchProperties();
  const properties = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);
  const userSettings = useSelector(selectUserSettings);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const [filters, setFilters] = useState({
    propertyType: null,
    status: 'Active',
    occupancy: null
  });

  const PER_PAGE = 6;

  // Get property layout from user settings, default to 'cards'
  const propertyLayout = userSettings?.propertyLayout || 'cards';

  // Load user settings on mount
  useEffect(() => {
    dispatch(getSettings());
  }, [dispatch]);

  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in animation on mount
  useEffect(() => {
    setFadeIn(true);
  }, []);

  // Handle layout change
  const handleLayoutChange = async (newLayout) => {
    const updatedSettings = {
      ...userSettings,
      propertyLayout: newLayout
    };
    await dispatch(saveSettings(updatedSettings));
  };

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

  // --- Filter by selected property ---
  const filteredByProperty = useMemo(() => {
    if (!selectedProperty?.id) return properties || [];
    return properties?.filter((p) => p.id === selectedProperty.id) || [];
  }, [selectedProperty, properties]);

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
    let list = baseFiltered.filter((p) => {
      const name = p.name?.toLowerCase() || '';
      const address = p.streetAddress?.toLowerCase() || '';
      const matchesSearch = name.includes(search.toLowerCase()) || address.includes(search.toLowerCase());
      
      // Filter by property type
      if (filters.propertyType && p.propertyType !== filters.propertyType) {
        return false;
      }

      // Filter by occupancy
      if (filters.occupancy) {
        const occupancy = calculateOccupancyPercentage(p.units || []);
        if (filters.occupancy === 'Occupied' && occupancy === 0) return false;
        if (filters.occupancy === 'Vacant' && occupancy > 0) return false;
        if (filters.occupancy === 'Partially Occupied' && (occupancy === 0 || occupancy === 100)) return false;
        if (filters.occupancy === 'Fully Occupied' && occupancy !== 100) return false;
      }

      return matchesSearch;
    });

    // Sort by created date (newest first)
    return list.sort((a, b) => new Date(b.dateListed) - new Date(a.dateListed));
  }, [baseFiltered, search, filters]);

  // --- Pagination ---
  const count = Math.ceil(filteredProperties.length / PER_PAGE);
  const paginated = propertyLayout === 'table' 
    ? filteredProperties // Show all in table view (no pagination)
    : filteredProperties.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>
        {/* Header */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <PropertiesHeader />
        </AnimateIn>

        {/* Overview Cards */}
        <AnimateIn direction="bottom" delay={300} distance={120}>
          <PropertiesOverviewCards properties={properties || []} />
        </AnimateIn>
        
        {/* Sort + Add */}
        <AnimateIn direction="bottom" delay={400} distance={120}>
          <MainCard
            sx={{
              mt: 3,
              mb: 3,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'column', md: 'row' },
                gap: 2,
                alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' },
                justifyContent: { xs: 'flex-start', sm: 'flex-start', md: 'space-between' }
              }}
            >
              {/* Top (mobile) / Left (desktop): Add Property & Import */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
                {/* Add Property Button */}
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<HomeFilled />}
                  onClick={() => drawer.openPropertyAddWorkflowDrawer()}
                  sx={{
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                    px: 2.5,
                    py: 0.75,
                    width: { xs: '100%', sm: '100%', md: 'auto' },
                    '&:hover': {
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`
                    }
                  }}
                >
                  Add Property
                </Button>
                {/* Import Button */}
                <PropertyCsvImportButton
                  buttonProps={{
                    color: 'primary',
                    sx: {
                      px: 2.5,
                      py: 0.75,
                      width: { xs: '100%', sm: '100%', md: 'auto' }
                    }
                  }}
                />
              </Box>

              {/* Bottom (mobile) / Right (desktop): Toggle buttons, PropertySelect */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  flexShrink: 0,
                  width: { xs: '100%', sm: '100%', md: 'auto' },
                  justifyContent: { xs: 'flex-start', sm: 'flex-start', md: 'flex-end' }
                }}
              >
                <ToggleButtonGroup
                  value={propertyLayout}
                  exclusive
                  onChange={(e, newLayout) => {
                    if (newLayout !== null) {
                      handleLayoutChange(newLayout);
                    }
                  }}
                  size="small"
                  aria-label="view layout"
                  sx={{ display: { xs: 'none', sm: 'none', md: 'flex' } }}
                >
                  <Tooltip title="Card View">
                    <ToggleButton value="cards" aria-label="cards">
                      <AppstoreOutlined />
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Table View">
                    <ToggleButton value="table" aria-label="table">
                      <TableOutlined />
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>

                <Box sx={{ flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
                  <PropertySelect width={{ xs: '100%', sm: '100%', md: 300 }} />
                </Box>
              </Box>
            </Box>
          </MainCard>
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

        {/* Property Display */}
        <AnimateIn direction="bottom" delay={500} distance={120}>
          {isLoading ? (
            <Box textAlign="center" py={5}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading properties...
              </Typography>
            </Box>
          ) : filteredProperties.length === 0 ? (
            <PropertiesEmptyState />
          ) : propertyLayout === 'table' ? (
            <PropertiesTableView properties={paginated} onRefresh={propertiesRefetch} />
          ) : (
            <>
              <Grid container spacing={3} alignItems="stretch">
                {paginated.map((property) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={property.id}>
                    <PropertyCard property={property} />
                  </Grid>
                ))}
              </Grid>
              {/* Pagination - only show for card view */}
              {count > 1 && (
                <Stack spacing={2} sx={{ gap: 2, alignItems: 'flex-end', p: 2.5, my: 0.5 }}>
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
        </AnimateIn>
      </Box>
    </Fade>
  );
}
