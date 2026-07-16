import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Paper,
  Menu,
  MenuList,
  ListItemText,
  Checkbox,
  useTheme,
  alpha
} from '@mui/material';
import {
  PlusOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import TimeEntryList from 'components/time-tracking/TimeEntryList';
import TimeEntryForm from 'components/time-tracking/TimeEntryForm';
import ApprovalWorkflow from 'components/time-tracking/ApprovalWorkflow';
import useFetchTimeEntries from 'hooks/useFetchTimeEntries';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchStaffMembers from 'hooks/useFetchStaffMembers';
import { timeEntryAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import PropertySelect from 'components/PropertySelect';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { useOrganization } from 'contexts/OrganizationContext';
import { organizationAPI } from 'api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Invoiced', label: 'Invoiced' }
];

export default function TimeTracking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const { currentOrganization } = useOrganization();
  const { properties } = useFetchProperties();
  const { staffMembers } = useFetchStaffMembers();
  const selectedProperty = useSelector(selectProperty);

  // Filters
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get('propertyId') || 'all');
  const [staffMemberFilter, setStaffMemberFilter] = useState(searchParams.get('staffMemberId') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || null);
  const [formOpen, setFormOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [maintenanceRequestId, setMaintenanceRequestId] = useState(
    searchParams.get('maintenanceRequestId') ? parseInt(searchParams.get('maintenanceRequestId')) : null
  );
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const timespanChipRef = useRef(null);
  
  // Timespan filter state - default to current month
  const getDefaultTimespan = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      timespan: 'month',
      dateFrom: monthStart,
      dateTo: now
    };
  };
  const [timespanFilter, setTimespanFilter] = useState(getDefaultTimespan());
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date;
  });
  const [dateTo, setDateTo] = useState(new Date());

  // Load organizations for filter
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoadingOrganizations(true);
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          setAvailableOrganizations(response.data);
        } else {
          setAvailableOrganizations([]);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setAvailableOrganizations([]);
      } finally {
        setLoadingOrganizations(false);
      }
    };

    loadOrganizations();
  }, []);

  // Default to current organization
  useEffect(() => {
    if (currentOrganization && selectedOrganizationIds.length === 0) {
      setSelectedOrganizationIds([currentOrganization.id]);
    }
  }, [currentOrganization, selectedOrganizationIds.length]);

  // Build filters object
  const filters = useMemo(() => {
    const filterObj = {};
    if (propertyFilter !== 'all') filterObj.propertyId = parseInt(propertyFilter);
    if (staffMemberFilter !== 'all') filterObj.staffMemberId = parseInt(staffMemberFilter);
    if (statusFilter !== 'all') filterObj.status = statusFilter;
    if (dateFrom) filterObj.startDate = dateFrom.toISOString().split('T')[0];
    if (dateTo) filterObj.endDate = dateTo.toISOString().split('T')[0];
    if (maintenanceRequestId) filterObj.maintenanceRequestId = maintenanceRequestId;
    if (selectedOrganizationIds.length > 0) filterObj.organizationIds = selectedOrganizationIds;
    return filterObj;
  }, [propertyFilter, staffMemberFilter, statusFilter, dateFrom, dateTo, maintenanceRequestId, selectedOrganizationIds]);

  const { timeEntries, loading, refetch } = useFetchTimeEntries(filters);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= weekStart && entry.status === 'Approved';
    });
    const monthEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= monthStart && entry.status === 'Approved';
    });
    const pendingEntries = timeEntries.filter(entry => entry.status === 'Submitted');

    const weekHours = weekEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
    const monthHours = monthEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);

    return {
      weekHours,
      monthHours,
      pendingCount: pendingEntries.length
    };
  }, [timeEntries]);

  const formatHours = (hours) => {
    if (!hours) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const handleView = (id) => {
    navigate(`/landlord/time-entry/${id}`);
  };

  const handleApprove = (id) => {
    const entry = timeEntries.find(e => e.id === id);
    if (entry) {
      setSelectedEntry(entry);
      setApprovalOpen(true);
    }
  };

  const handleReject = (id) => {
    const entry = timeEntries.find(e => e.id === id);
    if (entry) {
      setSelectedEntry(entry);
      setApprovalOpen(true);
    }
  };

  const handleEdit = (id) => {
    const entry = timeEntries.find(e => e.id === id);
    if (entry) {
      setSelectedEntry(entry);
      setFormOpen(true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this time entry?')) return;

    try {
      const response = await timeEntryAPI.deleteTimeEntry(id);
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Time entry deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        refetch();
      } else {
        throw new Error(response?.data?.message || 'Failed to delete time entry');
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete time entry',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleFormSuccess = () => {
    refetch();
    setSelectedEntry(null);
  };

  const handleApprovalSuccess = () => {
    refetch();
    setSelectedEntry(null);
  };

  const handlePendingFilter = () => {
    setStatusFilter('Submitted');
  };

  return (
    <>
      <MainCard>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h3">Time Tracking</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<FilterOutlined />}
                onClick={handlePendingFilter}
              >
                Pending Approvals ({summary.pendingCount})
              </Button>
              <Button
                variant="contained"
                startIcon={<PlusOutlined />}
                onClick={() => {
                  setSelectedEntry(null);
                  setFormOpen(true);
                }}
              >
                Add Time Entry
              </Button>
            </Stack>
          </Stack>

          {/* Summary Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ClockCircleOutlined style={{ fontSize: 24, color: '#1877F2' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Hours This Week
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        {formatHours(summary.weekHours)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarOutlined style={{ fontSize: 24, color: '#2e7d32' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Hours This Month
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        {formatHours(summary.monthHours)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleOutlined style={{ fontSize: 24, color: '#ed6c02' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Pending Approvals
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        {summary.pendingCount}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <MainCard
            sx={{
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
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                <PropertySelect width={250} />
                <FormControl size="small" sx={{ minWidth: 250 }}>
                  <InputLabel>Staff Member</InputLabel>
                  <Select
                    value={staffMemberFilter}
                    onChange={(e) => setStaffMemberFilter(e.target.value)}
                    label="Staff Member"
                  >
                    <MenuItem value="all">All Staff</MenuItem>
                    {staffMembers
                      .filter(sm => sm.isActive)
                      .map((staff) => (
                        <MenuItem key={staff.id} value={staff.id}>
                          {staff.userName || `${staff.userFirstName} ${staff.userLastName}`}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                {/* Filter Chips */}
                {statusFilter && (
                  <Chip
                    label={`Status: ${STATUS_OPTIONS.find(opt => opt.value === statusFilter)?.label || statusFilter}`}
                    onClick={(e) => {
                      setClickedChipFilter('status');
                      setActiveSubMenu('status');
                      setFilterAnchorEl(e.currentTarget);
                      setSubMenuAnchorEl(e.currentTarget);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      setStatusFilter(null);
                    }}
                    deleteIcon={<FilterDeleteIcon fontSize={10} />}
                    size="small"
                    variant="outlined"
                    sx={{
                      flexShrink: 0,
                      cursor: 'pointer',
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
                {selectedOrganizationIds.map((orgId) => {
                  const org = availableOrganizations.find(o => o.id === orgId);
                  if (!org) return null;
                  return (
                    <Chip
                      key={orgId}
                      label={`Organization: ${org.name}`}
                      onClick={(e) => {
                        setClickedChipFilter('organization');
                        setActiveSubMenu('organization');
                        setFilterAnchorEl(e.currentTarget);
                        setSubMenuAnchorEl(e.currentTarget);
                      }}
                      onDelete={() => {
                        setSelectedOrganizationIds(prev => prev.filter(id => id !== orgId));
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
                          fontSize: 14,
                          color: 'primary.main'
                        }
                      }}
                    />
                  );
                })}
                {/* Timespan Filter Chip */}
                {timespanFilter && (
                  <Box ref={timespanChipRef}>
                    <Chip
                      label={`Date: ${
                        timespanFilter?.timespan === 'month' ? 'This Month' :
                        timespanFilter?.timespan === 'week' ? 'This Week' :
                        timespanFilter?.timespan === 'custom' ? 'Custom' :
                        'Custom'
                      }`}
                      onClick={(e) => {
                        setClickedChipFilter('timespan');
                        setActiveSubMenu('timespan');
                        setFilterAnchorEl(e.currentTarget);
                        setSubMenuAnchorEl(e.currentTarget);
                      }}
                      onDelete={(e) => {
                        e.stopPropagation();
                        setTimespanFilter(null);
                        setDateFrom(null);
                        setDateTo(null);
                      }}
                      deleteIcon={<FilterDeleteIcon fontSize={10} />}
                      size="small"
                      variant="outlined"
                      sx={{
                        flexShrink: 0,
                        cursor: 'pointer',
                        bgcolor: 'background.paper',
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        px: 0.75,
                        '& .MuiChip-label': {
                          color: 'primary.main',
                          px: 0.5
                        },
                        '& .MuiChip-deleteIcon': {
                          fontSize: 14,
                          color: 'primary.main'
                        }
                      }}
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FilterOutlined style={{ fontSize: 16 }} />}
                  onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                  sx={{
                    color: 'primary.main',
                    borderColor: 'primary.main',
                    textTransform: 'none',
                    flexShrink: 0,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  Add filters
                </Button>
              </Box>
            </Box>
          </MainCard>

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
              {/* Status Filter */}
              <MenuItem
                onClick={(e) => {
                  setActiveSubMenu('status');
                  setSubMenuAnchorEl(e.currentTarget);
                }}
              >
                <ListItemText primary="Status" />
                {statusFilter && (
                  <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                    {STATUS_OPTIONS.find(opt => opt.value === statusFilter)?.label || statusFilter}
                  </Typography>
                )}
              </MenuItem>
              {/* Organization Filter */}
              <MenuItem
                onClick={(e) => {
                  setActiveSubMenu('organization');
                  setSubMenuAnchorEl(e.currentTarget);
                }}
              >
                <ListItemText primary="Organization" />
                {selectedOrganizationIds.length > 0 && (
                  <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                    {selectedOrganizationIds.length} selected
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
                <ListItemText primary="Date" />
                {timespanFilter && (
                  <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                    {timespanFilter?.timespan === 'month' ? 'This Month' :
                     timespanFilter?.timespan === 'week' ? 'This Week' :
                     timespanFilter?.timespan === 'custom' ? 'Custom' : 'Custom'}
                  </Typography>
                )}
              </MenuItem>
            </MenuList>
          </Menu>

          {/* Submenu for Filter Options */}
          <Menu
            anchorEl={subMenuAnchorEl}
            open={Boolean(subMenuAnchorEl) && (activeSubMenu === 'status' || activeSubMenu === 'organization' || activeSubMenu === 'timespan')}
            onClose={() => {
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              if (!clickedChipFilter) {
                setFilterAnchorEl(null);
              }
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
              {activeSubMenu === 'status' && (
                <>
                  {STATUS_OPTIONS.filter(opt => opt.value !== 'all').map((option) => (
                    <MenuItem
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value);
                        setSubMenuAnchorEl(null);
                        setActiveSubMenu(null);
                        setFilterAnchorEl(null);
                        setClickedChipFilter(null);
                      }}
                      selected={statusFilter === option.value}
                    >
                      <ListItemText primary={option.label} />
                    </MenuItem>
                  ))}
                </>
              )}
              {activeSubMenu === 'organization' && (
                <>
                  {availableOrganizations.map((org) => (
                    <MenuItem
                      key={org.id}
                      onClick={() => {
                        setSelectedOrganizationIds(prev => {
                          if (prev.includes(org.id)) {
                            return prev.filter(id => id !== org.id);
                          } else {
                            return [...prev, org.id];
                          }
                        });
                      }}
                    >
                      <Checkbox
                        checked={selectedOrganizationIds.includes(org.id)}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <ListItemText primary={org.name} />
                    </MenuItem>
                  ))}
                </>
              )}
              {activeSubMenu === 'timespan' && (
                <>
                  <MenuItem
                    onClick={() => {
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      setTimespanFilter({
                        timespan: 'month',
                        dateFrom: monthStart,
                        dateTo: now
                      });
                      setSubMenuAnchorEl(null);
                      setActiveSubMenu(null);
                      setFilterAnchorEl(null);
                      setClickedChipFilter(null);
                    }}
                    selected={timespanFilter?.timespan === 'month'}
                  >
                    <ListItemText primary="This Month" />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      const now = new Date();
                      const weekStart = new Date(now);
                      weekStart.setDate(now.getDate() - now.getDay());
                      weekStart.setHours(0, 0, 0, 0);
                      setTimespanFilter({
                        timespan: 'week',
                        dateFrom: weekStart,
                        dateTo: now
                      });
                      setSubMenuAnchorEl(null);
                      setActiveSubMenu(null);
                      setFilterAnchorEl(null);
                      setClickedChipFilter(null);
                    }}
                    selected={timespanFilter?.timespan === 'week'}
                  >
                    <ListItemText primary="This Week" />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      setTimespanFilter({
                        timespan: 'custom',
                        dateFrom: monthStart,
                        dateTo: now
                      });
                      // Keep menu open for custom date selection
                    }}
                    selected={timespanFilter?.timespan === 'custom'}
                  >
                    <ListItemText primary="Custom" />
                  </MenuItem>
                </>
              )}
            </MenuList>
          </Menu>
          
          {/* Custom Date Picker (shown when custom timespan is selected) */}
          {timespanFilter?.timespan === 'custom' && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="From"
                    value={dateFrom}
                    onChange={(newDate) => {
                      setDateFrom(newDate);
                      setTimespanFilter(prev => ({
                        ...prev,
                        dateFrom: newDate
                      }));
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        sx: { minWidth: 200 }
                      }
                    }}
                  />
                  <DatePicker
                    label="To"
                    value={dateTo}
                    onChange={(newDate) => {
                      setDateTo(newDate);
                      setTimespanFilter(prev => ({
                        ...prev,
                        dateTo: newDate
                      }));
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        sx: { minWidth: 200 }
                      }
                    }}
                  />
                </LocalizationProvider>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSubMenuAnchorEl(null);
                    setActiveSubMenu(null);
                    setFilterAnchorEl(null);
                    setClickedChipFilter(null);
                  }}
                >
                  Done
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Time Entries List */}
          <TimeEntryList
            entries={timeEntries}
            loading={loading}
            onView={handleView}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Stack>
      </MainCard>

      <TimeEntryForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setSelectedEntry(null);
        }}
        initialValues={selectedEntry}
        maintenanceRequestId={maintenanceRequestId}
        onSuccess={handleFormSuccess}
      />

      <ApprovalWorkflow
        open={approvalOpen}
        onClose={() => {
          setApprovalOpen(false);
          setSelectedEntry(null);
        }}
        timeEntry={selectedEntry}
        onSuccess={handleApprovalSuccess}
      />
    </>
  );
}
