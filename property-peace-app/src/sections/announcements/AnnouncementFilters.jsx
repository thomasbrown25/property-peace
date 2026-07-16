import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTheme, alpha } from '@mui/material';

// material-ui
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Button,
  Menu,
  Paper,
  Chip,
  MenuList,
  ListItemText,
  Typography,
  TextField,
  InputAdornment
} from '@mui/material';
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons';
import FilterDeleteIcon from 'components/FilterDeleteIcon';

// project imports
import PropertySelect from 'components/PropertySelect';
import { organizationAPI } from 'api';
import { useOrganization } from 'contexts/OrganizationContext';
import { selectProperty } from 'store/property/property.selector';

// ==============================|| ANNOUNCEMENT FILTERS ||============================== //

export default function AnnouncementFilters({ filters, onFiltersChange, onNewAnnouncement }) {
  const theme = useTheme();
  const { organizations: contextOrganizations } = useOrganization();
  const selectedProperty = useSelector(selectProperty);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          // Filter to only show organizations where user has Owner or Manager role
          const orgsWithAccess = response.data.filter(org => {
            const role = org.userRole || org.role;
            return role === 'Owner' || role === 'Manager';
          });
          setAvailableOrganizations(orgsWithAccess);
        } else {
          setAvailableOrganizations([]);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setAvailableOrganizations([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  // Update property filter when selected property changes
  useEffect(() => {
    if (selectedProperty?.id !== filters.propertyId) {
      onFiltersChange({
        ...filters,
        propertyId: selectedProperty?.id || null
      });
    }
  }, [selectedProperty]);

  const handleOrganizationChange = (event) => {
    const value = event.target.value;
    onFiltersChange({
      ...filters,
      organizationId: value === 'all' ? null : value
    });
  };

  const handleTimespanChange = (timespanData) => {
    onFiltersChange({
      ...filters,
      dateFrom: timespanData.dateFrom,
      dateTo: timespanData.dateTo,
      timespan: timespanData
    });
  };


  const [timespanDropdownAnchor, setTimespanDropdownAnchor] = useState(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastMonth.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'column', md: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' },
          justifyContent: { xs: 'flex-start', sm: 'flex-start', md: 'space-between' },
          '& .MuiInputLabel-root': {
            bgcolor: 'transparent',
            px: 0
          },
          '& .MuiInputLabel-shrink': {
            bgcolor: 'transparent',
            px: 0
          }
        }}
      >
        {/* Left: filters */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'column', md: 'row' }, gap: 1, alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' }, flexWrap: 'wrap', flex: 1, minWidth: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
          {/* Timespan Filter Dropdown */}
          <FormControl size="small" sx={{ minWidth: 180, flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
            <InputLabel>Timespan</InputLabel>
            <Select
              value={filters.timespan?.timespan || 'month'}
              onChange={(e) => {
                const value = e.target.value;
                const now = new Date();
                let dateFrom = null;
                let dateTo = now;
                
                if (value === 'custom') {
                  if (filters.timespan?.timespan === 'custom' && filters.timespan?.dateFrom && filters.timespan?.dateTo) {
                    setDateFrom(filters.timespan.dateFrom.toISOString().split('T')[0]);
                    setDateTo(filters.timespan.dateTo.toISOString().split('T')[0]);
                  } else if (!dateFrom || !dateTo) {
                    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    setDateFrom(lastMonth.toISOString().split('T')[0]);
                    setDateTo(now.toISOString().split('T')[0]);
                  }
                  setShowCustomDatePicker(true);
                  setTimespanDropdownAnchor(e.target);
                } else {
                  if (value === '24hours') {
                    dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                  } else if (value === 'month') {
                    dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  } else if (value === '3months') {
                    dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                  } else if (value === '6months') {
                    dateFrom = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                  }
                  
                  if (dateFrom) {
                    handleTimespanChange({
                      timespan: value,
                      dateFrom,
                      dateTo
                    });
                  }
                }
              }}
              label="Timespan"
              renderValue={(selected) => {
                if (!selected) return 'Last month';
                if (selected === 'custom') return 'Custom';
                const labels = {
                  '24hours': 'Last 24 hours',
                  'month': 'Last month',
                  '3months': 'Last 3 months',
                  '6months': 'Last 6 months'
                };
                return labels[selected] || selected;
              }}
            >
              <MenuItem value="24hours">Last 24 hours</MenuItem>
              <MenuItem value="month">Last month</MenuItem>
              <MenuItem value="3months">Last 3 months</MenuItem>
              <MenuItem value="6months">Last 6 months</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          {/* Custom Date Range Chip - shows when custom dates are selected */}
          {filters.timespan?.timespan === 'custom' && filters.timespan?.dateFrom && filters.timespan?.dateTo && (
            <Chip
              label={`${formatDate(filters.timespan.dateFrom)} - ${formatDate(filters.timespan.dateTo)}`}
              onDelete={(e) => {
                e.stopPropagation();
                handleTimespanChange({
                  timespan: 'month',
                  dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  dateTo: new Date()
                });
                setShowCustomDatePicker(false);
                setTimespanDropdownAnchor(null);
              }}
              deleteIcon={<FilterDeleteIcon fontSize={10} />}
              size="small"
              variant="outlined"
              sx={{
                flexShrink: 0,
                bgcolor: 'background.paper',
                borderColor: 'primary.main',
                color: 'primary.main',
                px: 0.75,
                '& .MuiChip-label': {
                  color: 'primary.main',
                  px: 0.5
                },
                '& .MuiChip-deleteIcon': {
                  marginLeft: 0.5,
                  marginRight: -0.5
                }
              }}
            />
          )}

          <Box sx={{ minWidth: 200, flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
            <PropertySelect 
              width={{ xs: '100%', sm: '100%', md: '100%' }}
              disableAllOption={false}
            />
          </Box>

          {!loading && availableOrganizations.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200, flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
              <InputLabel>Organization</InputLabel>
              <Select
                value={filters.organizationId || 'all'}
                label="Organization"
                onChange={handleOrganizationChange}
                sx={{
                  '& .MuiSelect-select': {
                    py: 1
                  }
                }}
              >
                <MenuItem value="all">All Organizations</MenuItem>
                {availableOrganizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Right: create action */}
        <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', md: 'flex-end' }, alignItems: 'center', flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
          {onNewAnnouncement && (
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={onNewAnnouncement}
              sx={{ borderRadius: 1.5, textTransform: 'none', flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}
            >
              New Announcement
            </Button>
          )}
        </Box>
      </Box>

      {/* Custom Date Picker Modal - positioned next to timespan dropdown */}
      <Menu
        anchorEl={timespanDropdownAnchor}
        open={showCustomDatePicker && Boolean(timespanDropdownAnchor)}
        onClose={() => {
          setShowCustomDatePicker(false);
          setTimespanDropdownAnchor(null);
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        sx={{
          '& .MuiPaper-root': {
            mt: 0.5
          }
        }}
      >
        <Paper sx={{ p: 2, minWidth: 320 }}>
          <Stack spacing={2}>
            <TextField
              size="small"
              type="date"
              label="From Date"
              value={dateFrom || ''}
              onChange={(e) => {
                setDateFrom(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarOutlined style={{ fontSize: 16 }} />
                  </InputAdornment>
                )
              }}
            />
            <TextField
              size="small"
              type="date"
              label="To Date"
              value={dateTo || ''}
              onChange={(e) => {
                setDateTo(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarOutlined style={{ fontSize: 16 }} />
                  </InputAdornment>
                )
              }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setShowCustomDatePicker(false);
                  setTimespanDropdownAnchor(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  if (dateFrom && dateTo) {
                    const fromDate = new Date(dateFrom);
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    
                    handleTimespanChange({
                      timespan: 'custom',
                      dateFrom: fromDate,
                      dateTo: toDate
                    });
                    setShowCustomDatePicker(false);
                    setTimespanDropdownAnchor(null);
                  }
                }}
                disabled={!dateFrom || !dateTo}
              >
                Apply
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Menu>
    </>
  );
}

AnnouncementFilters.propTypes = {
  filters: PropTypes.shape({
    dateFrom: PropTypes.object,
    dateTo: PropTypes.object,
    timespan: PropTypes.object,
    organizationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    propertyId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  }).isRequired,
  onFiltersChange: PropTypes.func.isRequired,
  onNewAnnouncement: PropTypes.func
};
