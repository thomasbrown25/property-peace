import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  alpha,
  useTheme,
  Menu,
  MenuList,
  MenuItem,
  ListItemText,
  FormControlLabel,
  Switch
} from '@mui/material';
import { 
  DeleteOutlined, 
  ReloadOutlined, 
  EditOutlined, 
  StopOutlined, 
  PlayCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  CloseOutlined,
  UserOutlined,
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import { adminUserAPI } from 'api/admin/user';
import { openSnackbar } from 'api/snackbar';
import UserEditDrawer from 'components/drawers/UserEditDrawer';
import { organizationAPI } from 'api';
import { FormControl, Select, InputLabel } from '@mui/material';
import { PASSWORD_REQUIREMENTS_TEXT, validatePassword } from 'utils/password-validation';

export default function AdminUsers() {
  const theme = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [unsuspendDialogOpen, setUnsuspendDialogOpen] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all', // all, active, suspended, deleted
    role: 'all' // all, admin, landlord, tenant
  });
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [setPasswordDialogOpen, setSetPasswordDialogOpen] = useState(false);
  const [userToSetPassword, setUserToSetPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState('');

  useEffect(() => {
    loadUsers();
  }, [includeDeleted]);

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

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminUserAPI.getAllUsers(includeDeleted);
      
      if (response.success) {
        setUsers(response.data || []);
      } else {
        setError(response.message || 'Failed to load users');
        openSnackbar({
          open: true,
          message: response.message || 'Failed to load users',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users');
      openSnackbar({
        open: true,
        message: 'Failed to load users',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      const response = await adminUserAPI.deleteUser(userToDelete.id);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'User deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setDeleteDialogOpen(false);
        setUserToDelete(null);
        loadUsers();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to delete user',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete user',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditDrawerOpen(true);
  };

  const handleEditDrawerClose = () => {
    setEditDrawerOpen(false);
    setSelectedUser(null);
  };

  const handleUpdateSuccess = () => {
    loadUsers();
  };

  const handleSuspendClick = (user) => {
    setUserToSuspend(user);
    setSuspendDialogOpen(true);
  };

  const handleSuspendConfirm = async () => {
    if (!userToSuspend) return;

    try {
      setLoading(true);
      const response = await adminUserAPI.suspendUser(userToSuspend.id);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'User suspended successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setSuspendDialogOpen(false);
        setUserToSuspend(null);
        loadUsers();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to suspend user',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      openSnackbar({
        open: true,
        message: 'Failed to suspend user',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendCancel = () => {
    setSuspendDialogOpen(false);
    setUserToSuspend(null);
  };

  const handleUnsuspendClick = (user) => {
    setUserToSuspend(user);
    setUnsuspendDialogOpen(true);
  };

  const handleUnsuspendConfirm = async () => {
    if (!userToSuspend) return;

    try {
      setLoading(true);
      const response = await adminUserAPI.unsuspendUser(userToSuspend.id);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'User unsuspended successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setUnsuspendDialogOpen(false);
        setUserToSuspend(null);
        loadUsers();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to unsuspend user',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error unsuspending user:', error);
      openSnackbar({
        open: true,
        message: 'Failed to unsuspend user',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsuspendCancel = () => {
    setUnsuspendDialogOpen(false);
    setUserToSuspend(null);
  };

  const handleSetPasswordClick = (user) => {
    setUserToSetPassword(user);
    setNewPassword('');
    setShowSetPassword(false);
    setSetPasswordError('');
    setSetPasswordDialogOpen(true);
  };

  const handleSetPasswordClose = () => {
    setSetPasswordDialogOpen(false);
    setUserToSetPassword(null);
    setNewPassword('');
    setShowSetPassword(false);
    setSetPasswordError('');
  };

  const handleSetPasswordConfirm = async () => {
    if (!userToSetPassword) return;
    setSetPasswordError('');
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setSetPasswordError(validationError);
      return;
    }
    try {
      setSetPasswordLoading(true);
      const response = await adminUserAPI.setPassword(userToSetPassword.id, newPassword);
      if (response.success) {
        openSnackbar({
          open: true,
          message: response.message || 'Password set successfully. User can sign in with email/password or Google.',
          variant: 'alert',
          alert: { color: 'success' }
        });
        handleSetPasswordClose();
      } else {
        setSetPasswordError(response.message || 'Failed to set password.');
      }
    } catch (error) {
      console.error('Error setting password:', error);
      setSetPasswordError(error?.response?.data?.message || 'Failed to set password.');
    } finally {
      setSetPasswordLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getRoleChips = (roles) => {
    if (!roles || roles.length === 0) {
      return <Chip label="No Role" size="small" color="default" />;
    }
    return roles.map((role, index) => (
      <Chip
        key={index}
        label={role}
        size="small"
        color={role.toLowerCase() === 'admin' ? 'error' : role.toLowerCase() === 'landlord' ? 'primary' : 'default'}
        sx={{ mr: 0.5 }}
      />
    ));
  };

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    let filtered = users || [];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((u) => {
        const firstName = u.firstName || u.firstname || '';
        const lastName = u.lastName || u.lastname || '';
        const name = `${firstName} ${lastName}`.trim().toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phoneNumber || '').toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower);
      });
    }

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        filtered = filtered.filter((u) => !u.isDeleted && !u.isSuspended);
      } else if (filters.status === 'suspended') {
        filtered = filtered.filter((u) => u.isSuspended && !u.isDeleted);
      } else if (filters.status === 'deleted') {
        filtered = filtered.filter((u) => u.isDeleted);
      }
    }

    // Apply role filter
    if (filters.role && filters.role !== 'all') {
      filtered = filtered.filter((u) => {
        const roles = u.roles || [];
        return roles.some((r) => r.toLowerCase() === filters.role.toLowerCase());
      });
    }

    // Apply organization filter
    if (selectedOrganizationId) {
      filtered = filtered.filter((u) => {
        // Check if user has organizationId or organization data
        return u.organizationId === selectedOrganizationId || 
               u.organization?.id === selectedOrganizationId ||
               (u.organizations && u.organizations.some(org => org.id === selectedOrganizationId));
      });
    }

    return filtered;
  }, [users, searchTerm, filters, selectedOrganizationId]);

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => !u.isDeleted && !u.isSuspended).length;
    const suspended = users.filter((u) => u.isSuspended && !u.isDeleted).length;
    const deleted = users.filter((u) => u.isDeleted).length;
    return { total, active, suspended, deleted };
  }, [users]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            Users Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage all users in the system
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh">
            <IconButton 
              onClick={loadUsers} 
              disabled={loading}
              sx={{
                color: 'primary.main',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <ReloadOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <UserOutlined style={{ fontSize: 24, color: '#1877F2' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Users
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {overviewStats.total}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <UserOutlined style={{ fontSize: 24, color: '#2e7d32' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Active Users
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {overviewStats.active}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <UserOutlined style={{ fontSize: 24, color: '#ed6c02' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Suspended Users
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {overviewStats.suspended}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <UserOutlined style={{ fontSize: 24, color: '#d32f2f' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Deleted Users
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {overviewStats.deleted}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <MainCard sx={{ mb: 3 }}>
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
            <TextField
              size="small"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                )
              }}
              sx={{ minWidth: 250 }}
            />
            {/* Filter Chips */}
            {filters.status && filters.status !== 'all' && (
              <Chip
                label={`Status: ${filters.status === 'active' ? 'Active' : filters.status === 'suspended' ? 'Suspended' : filters.status === 'deleted' ? 'Deleted' : 'All'}`}
                onClick={(e) => {
                  setClickedChipFilter('status');
                  setActiveSubMenu('status');
                  setFilterAnchorEl(e.currentTarget);
                  setSubMenuAnchorEl(e.currentTarget);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setFilters(prev => ({ ...prev, status: 'all' }));
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
            )}
            {filters.role && filters.role !== 'all' && (
              <Chip
                label={`Role: ${filters.role.charAt(0).toUpperCase() + filters.role.slice(1)}`}
                onClick={(e) => {
                  setClickedChipFilter('role');
                  setActiveSubMenu('role');
                  setFilterAnchorEl(e.currentTarget);
                  setSubMenuAnchorEl(e.currentTarget);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setFilters(prev => ({ ...prev, role: 'all' }));
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
            )}
            {selectedOrganizationId && (
              <Chip
                label={`Organization: ${availableOrganizations.find(org => org.id === selectedOrganizationId)?.name || 'Unknown'}`}
                onDelete={() => setSelectedOrganizationId(null)}
                deleteIcon={<FilterDeleteIcon fontSize={10} />}
                size="small"
                sx={{
                  flexShrink: 0,
                  '& .MuiChip-deleteIcon': {
                    marginLeft: 0.5,
                    marginRight: -0.5
                  }
                }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedOrganizationId || 'all'}
                onChange={(e) => setSelectedOrganizationId(e.target.value === 'all' ? null : e.target.value)}
                disabled={loadingOrganizations}
                displayEmpty
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
            <FormControlLabel
              control={
                <Switch
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  size="small"
                />
              }
              label="Include Deleted"
              sx={{ mr: 1 }}
            />
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
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('status');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Status" />
            {filters.status && filters.status !== 'all' && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {filters.status === 'active' ? 'Active' : filters.status === 'suspended' ? 'Suspended' : filters.status === 'deleted' ? 'Deleted' : 'All'}
              </Typography>
            )}
          </MenuItem>
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('role');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Role" />
            {filters.role && filters.role !== 'all' && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {filters.role.charAt(0).toUpperCase() + filters.role.slice(1)}
              </Typography>
            )}
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Submenu for Filter Options */}
      <Menu
        anchorEl={subMenuAnchorEl}
        open={Boolean(subMenuAnchorEl) && (activeSubMenu === 'status' || activeSubMenu === 'role')}
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
          {activeSubMenu === 'status' && (
            <>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: 'all' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'all'}
              >
                <ListItemText primary="All" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: 'active' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'active'}
              >
                <ListItemText primary="Active" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: 'suspended' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'suspended'}
              >
                <ListItemText primary="Suspended" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, status: 'deleted' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'deleted'}
              >
                <ListItemText primary="Deleted" />
              </MenuItem>
            </>
          )}
          {activeSubMenu === 'role' && (
            <>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, role: 'all' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.role === 'all'}
              >
                <ListItemText primary="All" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, role: 'admin' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.role === 'admin'}
              >
                <ListItemText primary="Admin" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, role: 'landlord' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.role === 'landlord'}
              >
                <ListItemText primary="Landlord" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setFilters(prev => ({ ...prev, role: 'tenant' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.role === 'tenant'}
              >
                <ListItemText primary="Tenant" />
              </MenuItem>
            </>
          )}
        </MenuList>
      </Menu>

      {/* Users Table */}
      <MainCard>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && users.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredUsers.length === 0 ? (
          <Box textAlign="center" py={5}>
            <UserOutlined style={{ fontSize: 64, color: '#ccc', marginBottom: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {users.length === 0 ? 'No users found' : 'No users match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {users.length === 0 ? 'Users will appear here once they register' : 'Try adjusting your search or filter criteria'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Phone</strong></TableCell>
                  <TableCell><strong>Roles</strong></TableCell>
                  <TableCell><strong>Auth Provider</strong></TableCell>
                  <TableCell><strong>Created Date</strong></TableCell>
                  <TableCell><strong>Last Login</strong></TableCell>
                  <TableCell><strong>Login Count</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {user.firstName || user.lastName || user.firstname || user.lastname
                            ? `${user.firstName || user.firstname || ''} ${user.lastName || user.lastname || ''}`.trim()
                            : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.email || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.phoneNumber || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {getRoleChips(user.roles)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.authProvider === 'Email,Google' ? 'Email, Google' : (user.authProvider || 'Email')}
                          size="small"
                          color={user.authProvider === 'Google' ? 'info' : user.authProvider === 'Email,Google' ? 'secondary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(user.createDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.lastLogin || user.LastLogin ? formatDateTime(user.lastLogin || user.LastLogin) : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.loginCount ?? user.LoginCount ?? 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {user.isDeleted ? (
                            <Chip
                              label="Deleted"
                              size="small"
                              color="error"
                            />
                          ) : user.isSuspended ? (
                            <Chip
                              label="Suspended"
                              size="small"
                              color="warning"
                            />
                          ) : (
                            <Chip
                              label="Active"
                              size="small"
                              color="success"
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {!user.isDeleted && (
                            <>
                              <Tooltip title="Edit User">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditClick(user)}
                                  color="primary"
                                  disabled={loading}
                                >
                                  <EditOutlined />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Set Password">
                                <IconButton
                                  size="small"
                                  onClick={() => handleSetPasswordClick(user)}
                                  sx={{ color: 'info.main' }}
                                  disabled={loading}
                                >
                                  <LockOutlined />
                                </IconButton>
                              </Tooltip>
                              {user.isSuspended ? (
                                <Tooltip title="Unsuspend User">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnsuspendClick(user)}
                                    color="success"
                                    disabled={loading}
                                  >
                                    <PlayCircleOutlined />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Suspend User">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSuspendClick(user)}
                                    color="warning"
                                    disabled={loading}
                                  >
                                    <StopOutlined />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Delete User">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteClick(user)}
                                  color="error"
                                  disabled={loading}
                                >
                                  <DeleteOutlined />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DeleteOutlined />
            <Typography variant="h6">Delete User</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Typography variant="h6" color="error" gutterBottom>
              WARNING: Complete Deletion
            </Typography>
            Are you sure you want to completely delete this user? This action will <strong>permanently remove</strong>:
            <ul>
              <li>The user account and all personal information</li>
              <li>All organizations owned by the user</li>
              <li>All properties, units, leases, and tenants</li>
              <li>All documents, payments, and expenses</li>
              <li>All conversations, messages, and notifications</li>
              <li>All subscriptions and related data</li>
              <li>All other data associated with this user or their organizations</li>
            </ul>
            <strong>
              User: {userToDelete?.firstName || userToDelete?.firstname || ''} {userToDelete?.lastName || userToDelete?.lastname || ''} ({userToDelete?.email || ''})
            </strong>
            <br />
            <br />
            <Typography variant="body2" color="error">
              <strong>This action cannot be undone. All data will be permanently deleted from the system.</strong>
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <DeleteOutlined />}
          >
            Delete User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suspend Confirmation Dialog */}
      <Dialog
        open={suspendDialogOpen}
        onClose={handleSuspendCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StopOutlined />
            <Typography variant="h6">Suspend User</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to suspend this user account? The user will not be able to:
            <ul>
              <li>Log in to their account</li>
              <li>Perform any actions in the system</li>
              <li>Access any features</li>
            </ul>
            <strong>
              User: {userToSuspend?.firstName || userToSuspend?.firstname || ''} {userToSuspend?.lastName || userToSuspend?.lastname || ''} ({userToSuspend?.email || ''})
            </strong>
            <br />
            <br />
            You can unsuspend the account at any time.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSuspendCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSuspendConfirm}
            variant="contained"
            color="warning"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <StopOutlined />}
          >
            Suspend User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsuspend Confirmation Dialog */}
      <Dialog
        open={unsuspendDialogOpen}
        onClose={handleUnsuspendCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PlayCircleOutlined />
            <Typography variant="h6">Unsuspend User</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to unsuspend this user account? The user will be able to:
            <ul>
              <li>Log in to their account</li>
              <li>Perform actions in the system</li>
              <li>Access all features</li>
            </ul>
            <strong>
              User: {userToSuspend?.firstName || userToSuspend?.firstname || ''} {userToSuspend?.lastName || userToSuspend?.lastname || ''} ({userToSuspend?.email || ''})
            </strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUnsuspendCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleUnsuspendConfirm}
            variant="contained"
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <PlayCircleOutlined />}
          >
            Unsuspend User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog
        open={setPasswordDialogOpen}
        onClose={handleSetPasswordClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LockOutlined />
            <Typography variant="h6">Set User Password</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Set a new password for this user. The current password is not required. This works for users who signed up
            with Google too — they can then sign in with email and this password or continue using Google.
          </DialogContentText>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {PASSWORD_REQUIREMENTS_TEXT}
          </Typography>
          {userToSetPassword && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              User: {userToSetPassword.firstName || userToSetPassword.firstname || ''}{' '}
              {userToSetPassword.lastName || userToSetPassword.lastname || ''} ({userToSetPassword.email})
            </Typography>
          )}
          {setPasswordError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSetPasswordError('')}>
              {setPasswordError}
            </Alert>
          )}
          <TextField
            fullWidth
            label="New Password"
            type={showSetPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            helperText={newPassword && validatePassword(newPassword)}
            error={Boolean(newPassword && validatePassword(newPassword))}
            sx={{ mb: 1 }}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showSetPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowSetPassword((s) => !s)}
                    edge="end"
                    size="small"
                  >
                    {showSetPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSetPasswordClose} disabled={setPasswordLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSetPasswordConfirm}
            variant="contained"
            color="primary"
            disabled={setPasswordLoading || !newPassword.trim()}
            startIcon={setPasswordLoading ? <CircularProgress size={16} /> : <LockOutlined />}
          >
            Set Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Drawer */}
      <UserEditDrawer
        user={selectedUser}
        open={editDrawerOpen}
        onClose={handleEditDrawerClose}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </Box>
  );
}

