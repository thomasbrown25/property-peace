import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTheme, alpha } from '@mui/material';
import {
  Box,
  Stack,
  Button,
  Menu,
  MenuItem,
  Paper,
  Chip,
  MenuList,
  ListItemText,
  Typography
} from '@mui/material';
import { FilterOutlined, CloseOutlined } from '@ant-design/icons';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Autocomplete from 'components/@extended/AutoComplete';
import TimespanFilter from '../announcements/TimespanFilter';
import useFetchProperties from 'hooks/useFetchProperties';

export default function ReportFilters({ filters, onFiltersChange }) {
  const theme = useTheme();
  const { properties } = useFetchProperties();
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const timespanChipRef = useRef(null);

  // Convert property IDs to options for Autocomplete
  const propertyOptions = properties?.map((p) => {
    const address = p.streetAddress?.trim();
    const label = address ? `${p.name} (${address})` : p.name;
    return { label, id: p.id, property: p };
  }) || [];

  const selectedPropertyOptions = propertyOptions.filter(
    (opt) => filters.propertyIds?.includes(opt.id)
  );

  const handleTimespanChange = (timespanData) => {
    onFiltersChange({
      ...filters,
      dateFrom: timespanData.dateFrom,
      dateTo: timespanData.dateTo,
      timespan: timespanData
    });
  };

  // Get display label for timespan
  const getTimespanLabel = () => {
    if (!filters.timespan) return 'Last 12 months';
    const { timespan } = filters.timespan;
    const labels = {
      '3months': 'Last 3 months',
      '6months': 'Last 6 months',
      '12months': 'Last 12 months',
      'all': 'All time',
      'custom': 'Custom'
    };
    return labels[timespan] || 'Last 12 months';
  };

  // Get display label for properties
  const getPropertyLabel = () => {
    if (!filters.propertyIds || filters.propertyIds.length === 0) return 'All Properties';
    if (filters.propertyIds.length === 1) return '1 Property';
    return `${filters.propertyIds.length} Properties`;
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          p: 1.5,
          position: 'relative',
          zIndex: 1,
          overflow: 'visible'
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          {/* Property Filter Chip */}
          {filters.propertyIds && filters.propertyIds.length > 0 && (
            <Box>
              <Chip
                label={`Properties: ${getPropertyLabel()}`}
                onClick={(e) => {
                  setFilterAnchorEl(e.currentTarget);
                  setActiveSubMenu('properties');
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  onFiltersChange({
                    ...filters,
                    propertyIds: []
                  });
                }}
                deleteIcon={<FilterDeleteIcon fontSize={10} />}
                size="small"
                sx={{
                  flexShrink: 0,
                  cursor: 'pointer',
                  '& .MuiChip-deleteIcon': {
                    marginLeft: 0.5,
                    marginRight: -0.5
                  }
                }}
              />
            </Box>
          )}

          {/* Timespan Filter Chip */}
          {filters.timespan && (
            <Box ref={timespanChipRef}>
              <Chip
                label={`Timespan: ${getTimespanLabel()}`}
                onClick={(e) => {
                  setFilterAnchorEl(e.currentTarget);
                  setActiveSubMenu('timespan');
                  setSubMenuAnchorEl(e.currentTarget);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  onFiltersChange({
                    ...filters,
                    timespan: null,
                    dateFrom: null,
                    dateTo: null
                  });
                }}
                deleteIcon={<FilterDeleteIcon fontSize={10} />}
                size="small"
                sx={{
                  flexShrink: 0,
                  cursor: 'pointer',
                  '& .MuiChip-deleteIcon': {
                    marginLeft: 0.5,
                    marginRight: -0.5
                  }
                }}
              />
            </Box>
          )}
        </Box>

        {/* Always show Add filters button */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<FilterOutlined style={{ fontSize: 16 }} />}
            onClick={(e) => setFilterAnchorEl(e.currentTarget)}
            sx={{
              color: 'primary.main',
              textTransform: 'none',
              flexShrink: 0,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            Add filters
          </Button>
        </Box>
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => {
          setFilterAnchorEl(null);
          setSubMenuAnchorEl(null);
          setActiveSubMenu(null);
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
          {/* Properties Filter */}
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('properties');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Properties" />
            {filters.propertyIds && filters.propertyIds.length > 0 && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {getPropertyLabel()}
              </Typography>
            )}
          </MenuItem>

          {/* Timespan Filter */}
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('timespan');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Timespan" />
            {filters.timespan && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {getTimespanLabel()}
              </Typography>
            )}
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Submenu for Properties */}
      {activeSubMenu === 'properties' && (
        <Menu
          anchorEl={subMenuAnchorEl}
          open={Boolean(subMenuAnchorEl) && activeSubMenu === 'properties'}
          onClose={() => {
            setSubMenuAnchorEl(null);
            setActiveSubMenu(null);
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
          <Paper sx={{ p: 2, minWidth: 300 }}>
            <Autocomplete
              multiple
              options={propertyOptions}
              value={selectedPropertyOptions}
              onChange={(_, newValue) => {
                const propertyIds = newValue.map((v) => v.id);
                onFiltersChange({
                  ...filters,
                  propertyIds: propertyIds || []
                });
                setSubMenuAnchorEl(null);
                setActiveSubMenu(null);
                setFilterAnchorEl(null);
              }}
              getOptionLabel={(option) => option?.label ?? ''}
              isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
              label="Select Properties"
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Paper>
        </Menu>
      )}

      {/* Submenu for Timespan Filter Options */}
      {activeSubMenu === 'timespan' && (
        filters.timespan?.timespan === 'custom' ? (
          // Show date/time pickers when Custom is selected
          <Menu
            anchorEl={subMenuAnchorEl}
            open={Boolean(subMenuAnchorEl) && activeSubMenu === 'timespan'}
            onClose={() => {
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
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
            <Paper sx={{ p: 2, minWidth: 320 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <TimespanFilter
                  value={filters.timespan}
                  onChange={(timespanData) => {
                    handleTimespanChange(timespanData);
                    // Don't close menu if custom is selected (user might want to adjust dates)
                    if (timespanData.timespan !== 'custom') {
                      setSubMenuAnchorEl(null);
                      setActiveSubMenu(null);
                      setFilterAnchorEl(null);
                    }
                  }}
                />
              </LocalizationProvider>
            </Paper>
          </Menu>
        ) : (
          // Show menu options for preset timespans
          <Menu
            anchorEl={subMenuAnchorEl}
            open={Boolean(subMenuAnchorEl) && activeSubMenu === 'timespan'}
            onClose={() => {
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
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
              <MenuItem
                onClick={() => {
                  const now = new Date();
                  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                  handleTimespanChange({
                    timespan: '3months',
                    dateFrom: threeMonthsAgo,
                    dateTo: now
                  });
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                }}
                selected={filters.timespan?.timespan === '3months'}
              >
                <ListItemText primary="Last 3 months" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  const now = new Date();
                  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                  handleTimespanChange({
                    timespan: '6months',
                    dateFrom: sixMonthsAgo,
                    dateTo: now
                  });
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                }}
                selected={filters.timespan?.timespan === '6months'}
              >
                <ListItemText primary="Last 6 months" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  const now = new Date();
                  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                  handleTimespanChange({
                    timespan: '12months',
                    dateFrom: twelveMonthsAgo,
                    dateTo: now
                  });
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                }}
                selected={filters.timespan?.timespan === '12months'}
              >
                <ListItemText primary="Last 12 months" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleTimespanChange({
                    timespan: 'all',
                    dateFrom: null,
                    dateTo: null
                  });
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                }}
                selected={filters.timespan?.timespan === 'all'}
              >
                <ListItemText primary="All time" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  // For custom, show the date/time pickers
                  const now = new Date();
                  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  handleTimespanChange({
                    timespan: 'custom',
                    dateFrom: lastMonth,
                    dateTo: now,
                    customStartDate: lastMonth,
                    customEndDate: now
                  });
                  // Keep submenu open to show date/time pickers
                }}
                selected={filters.timespan?.timespan === 'custom'}
              >
                <ListItemText primary="Custom" />
              </MenuItem>
            </MenuList>
          </Menu>
        )
      )}
    </>
  );
}

ReportFilters.propTypes = {
  filters: PropTypes.shape({
    propertyIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
    dateFrom: PropTypes.instanceOf(Date),
    dateTo: PropTypes.instanceOf(Date),
    timespan: PropTypes.object
  }).isRequired,
  onFiltersChange: PropTypes.func.isRequired
};
