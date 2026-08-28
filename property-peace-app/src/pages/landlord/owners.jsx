import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  FormControlLabel,
  Switch,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Card,
  CardContent,
  alpha,
  useTheme,
  Menu,
  MenuList
} from '@mui/material';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  HomeOutlined,
  LinkOutlined,
  FilterOutlined,
  CloseOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { clientAPI } from 'api/client';
import {
  getClients,
  addClient,
  updateClient,
  deleteClient,
  linkPropertyToClient,
  unlinkPropertyFromClient
} from 'store/client/client.action';
import {
  selectClients,
  selectClientLoading
} from 'store/client/client.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import { organizationAPI } from 'api';
import { useOrganization } from 'contexts/OrganizationContext';

export default function Owners() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const { currentOrganization } = useOrganization();
  const clients = useSelector(selectClients);
  const loading = useSelector(selectClientLoading);
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const [filters, setFilters] = useState({
    status: 'active' // Default to active
  });
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkPropertyDialogOpen, setLinkPropertyDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPropertiesForLinking, setSelectedPropertiesForLinking] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    managementFeePercentage: '',
    managementFeeFlat: '',
    statementFrequency: 'Monthly',
    isActive: true
  });

  useEffect(() => {
    dispatch(getClients());
    propertiesRefetch();
  }, [dispatch, propertiesRefetch]);

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

  const filteredClients = useMemo(() => {
    let filtered = clients || [];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          c.phoneNumber?.includes(searchTerm) ||
          c.companyName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    const statusFilter = filters.status || 'active';
    if (statusFilter === 'active') {
      filtered = filtered.filter((c) => c.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((c) => !c.isActive);
    }
    // 'all' shows everything, so no filter needed

    // Apply organization filter
    if (selectedOrganizationIds.length > 0) {
      filtered = filtered.filter((c) => selectedOrganizationIds.includes(c.organizationId));
    }

    return filtered.sort((a, b) => {
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }, [clients, searchTerm, filters.status, selectedOrganizationIds]);

  const handleOpenDialog = (client = null) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phoneNumber: client.phoneNumber || '',
        companyName: client.companyName || '',
        managementFeePercentage: client.managementFeePercentage?.toString() || '',
        managementFeeFlat: client.managementFeeFlat?.toString() || '',
        statementFrequency: client.statementFrequency || 'Monthly',
        isActive: client.isActive !== false
      });
    } else {
      setSelectedClient(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        companyName: '',
        managementFeePercentage: '',
        managementFeeFlat: '',
        statementFrequency: 'Monthly',
        isActive: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedClient(null);
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      openSnackbar({
        open: true,
        message: 'First name and last name are required',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    const clientData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim() || '',
      phoneNumber: formData.phoneNumber.trim() || null,
      companyName: formData.companyName.trim() || null,
      managementFeePercentage: formData.managementFeePercentage
        ? parseFloat(formData.managementFeePercentage)
        : null,
      managementFeeFlat: formData.managementFeeFlat ? parseFloat(formData.managementFeeFlat) : null,
      statementFrequency: formData.statementFrequency,
      isActive: formData.isActive
    };

    let result;
    if (selectedClient) {
      result = await dispatch(updateClient(selectedClient.id, { ...clientData, id: selectedClient.id }));
    } else {
      result = await dispatch(addClient(clientData));
    }

    if (result.success) {
      openSnackbar({
        open: true,
        message: selectedClient ? 'Client updated successfully' : 'Client created successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      handleCloseDialog();
      dispatch(getClients());
    } else {
      openSnackbar({
        open: true,
        message: result.message || 'Failed to save client',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;

    const result = await dispatch(deleteClient(selectedClient.id));
    if (result.success) {
      openSnackbar({
        open: true,
        message: 'Client deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setDeleteDialogOpen(false);
      setSelectedClient(null);
      dispatch(getClients());
    } else {
      openSnackbar({
        open: true,
        message: result.message || 'Failed to delete client',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleResendInvite = async (client) => {
    if (!client.email) {
      openSnackbar({
        open: true,
        message: 'Client must have an email address to send an invite',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    if (client.userId) {
      openSnackbar({
        open: true,
        message: 'This client already has a portal account',
        variant: 'alert',
        alert: { color: 'info' }
      });
      return;
    }

    try {
      const response = await clientAPI.resendInvite(client.id);
      if (response?.success) {
        openSnackbar({
          open: true,
          message: response.message || 'Invite sent successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: response?.message || 'Failed to send invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'An error occurred while sending the invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };


  const handleOpenLinkPropertyDialog = (client) => {
    setSelectedClient(client);
    // Get properties already linked to this client by checking clientId
    const linkedPropertyIds =
      properties?.filter((p) => p.clientId === client.id).map((p) => p.id) || [];
    setSelectedPropertiesForLinking(linkedPropertyIds);
    setLinkPropertyDialogOpen(true);
  };

  const handleCloseLinkPropertyDialog = () => {
    setLinkPropertyDialogOpen(false);
    setSelectedClient(null);
    setSelectedPropertiesForLinking([]);
  };

  const handleTogglePropertySelection = (propertyId) => {
    setSelectedPropertiesForLinking((prev) => {
      if (prev.includes(propertyId)) {
        return prev.filter((id) => id !== propertyId);
      } else {
        return [...prev, propertyId];
      }
    });
  };

  const handleSavePropertyLinks = async () => {
    if (!selectedClient) return;

    try {
      // Get current linked properties by checking clientId
      const currentLinkedIds =
        properties?.filter((p) => p.clientId === selectedClient.id).map((p) => p.id) || [];
      
      // Properties to link (in selected but not in current)
      const toLink = selectedPropertiesForLinking.filter((id) => !currentLinkedIds.includes(id));
      
      // Properties to unlink (in current but not in selected)
      const toUnlink = currentLinkedIds.filter((id) => !selectedPropertiesForLinking.includes(id));

      // Perform link operations
      const linkPromises = toLink.map((propertyId) =>
        dispatch(linkPropertyToClient(selectedClient.id, propertyId))
      );

      // Perform unlink operations
      const unlinkPromises = toUnlink.map((propertyId) =>
        dispatch(unlinkPropertyFromClient(selectedClient.id, propertyId))
      );

      await Promise.all([...linkPromises, ...unlinkPromises]);

      openSnackbar({
        open: true,
        message: 'Properties updated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });

      handleCloseLinkPropertyDialog();
      dispatch(getClients());
      propertiesRefetch();
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to update property links',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const formatManagementFee = (client) => {
    if (client.managementFeePercentage) {
      return `${client.managementFeePercentage}%`;
    } else if (client.managementFeeFlat) {
      return `$${client.managementFeeFlat.toFixed(2)}`;
    }
    return 'N/A';
  };

  const activeClients = useMemo(() => clients.filter((c) => c.isActive), [clients]);
  const inactiveClients = useMemo(() => clients.filter((c) => !c.isActive), [clients]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            Clients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage clients, their properties, and management settings
          </Typography>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
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
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Total Clients
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {clients.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
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
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Active Clients
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {activeClients.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
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
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Inactive Clients
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {inactiveClients.length}
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
            <TextField
              size="small"
              placeholder="Search clients..."
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
            {filters.status && (
              <Chip
                label={`Status: ${filters.status === 'active' ? 'Active' : filters.status === 'inactive' ? 'Inactive' : 'All'}`}
                onClick={(e) => {
                  setClickedChipFilter('status');
                  setActiveSubMenu('status');
                  setFilterAnchorEl(e.currentTarget);
                  setSubMenuAnchorEl(e.currentTarget);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  if (filters.status !== 'active') {
                    setFilters(prev => ({ ...prev, status: 'active' }));
                  }
                }}
                deleteIcon={filters.status !== 'active' ? <FilterDeleteIcon fontSize={10} /> : undefined}
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
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={() => navigate('/landlord/clients/add')}
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
              Add Client
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
            {filters.status && (
              <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                {filters.status === 'active' ? 'Active' : filters.status === 'inactive' ? 'Inactive' : 'All'}
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
        </MenuList>
      </Menu>

      {/* Submenu for Filter Options */}
      <Menu
        anchorEl={subMenuAnchorEl}
        open={Boolean(subMenuAnchorEl) && (activeSubMenu === 'status' || activeSubMenu === 'organization')}
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
                  setFilters(prev => ({ ...prev, status: 'inactive' }));
                  setSubMenuAnchorEl(null);
                  setActiveSubMenu(null);
                  setFilterAnchorEl(null);
                  setClickedChipFilter(null);
                }}
                selected={filters.status === 'inactive'}
              >
                <ListItemText primary="Inactive" />
              </MenuItem>
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
        </MenuList>
      </Menu>

      {/* Owners Table */}
      <MainCard>
        {loading ? (
          <Box textAlign="center" py={5}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Loading clients...
            </Typography>
          </Box>
        ) : filteredClients.length === 0 ? (
          <Box textAlign="center" py={5}>
            <UserOutlined style={{ fontSize: 64, color: '#ccc', marginBottom: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {clients.length === 0 ? 'No clients yet' : 'No clients match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {clients.length === 0 ? 'Click "Add Client" to get started' : 'Try adjusting your search or filter criteria'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Properties</TableCell>
                  <TableCell>Management Fee</TableCell>
                  <TableCell>Statement Frequency</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Account</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {`${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unnamed Client'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {client.email && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MailOutlined style={{ fontSize: 14 }} />
                          <Typography variant="caption">{client.email}</Typography>
                        </Stack>
                      )}
                      {client.phoneNumber && (
                        <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                          <PhoneOutlined style={{ fontSize: 14 }} />
                          <Typography variant="caption">{client.phoneNumber}</Typography>
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.companyName ? (
                        <Typography variant="body2">{client.companyName}</Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={client.propertyCount || 0} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatManagementFee(client)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{client.statementFrequency || 'Monthly'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.isActive ? 'Active' : 'Inactive'}
                        color={client.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {(() => {
                        const hasAccount = !!client.userId;
                        return (
                          <Chip
                            label={hasAccount ? 'Account Created' : 'No Account'}
                            color={hasAccount ? 'success' : 'default'}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell align="right">
                      {!client.userId && client.email && (
                        <IconButton
                          size="small"
                          onClick={() => handleResendInvite(client)}
                          color="primary"
                          title="Resend Invite"
                        >
                          <MailOutlined />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleOpenLinkPropertyDialog(client)}
                        color="primary"
                        title="Link Properties"
                      >
                        <LinkOutlined />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(client)}
                        color="primary"
                        title="Edit Client"
                      >
                        <EditOutlined />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedClient(client);
                          setDeleteDialogOpen(true);
                        }}
                        color="error"
                        title="Delete Client"
                      >
                        <DeleteOutlined />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{selectedClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="First Name *"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Last Name *"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Phone Number"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                helperText="Optional - for corporate clients"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Management Fee Percentage"
                type="number"
                value={formData.managementFeePercentage}
                onChange={(e) => setFormData({ ...formData, managementFeePercentage: e.target.value })}
                helperText="e.g., 8.5 for 8.5%"
                InputProps={{
                  endAdornment: <Typography variant="body2">%</Typography>
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Management Fee Flat"
                type="number"
                value={formData.managementFeeFlat}
                onChange={(e) => setFormData({ ...formData, managementFeeFlat: e.target.value })}
                helperText="Flat monthly fee"
                InputProps={{
                  startAdornment: <Typography variant="body2">$</Typography>
                }}
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <Select
                  value={formData.statementFrequency}
                  onChange={(e) => setFormData({ ...formData, statementFrequency: e.target.value })}
                  label="Statement Frequency"
                >
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Quarterly">Quarterly</MenuItem>
                  <MenuItem value="Annually">Annually</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : 'this client'}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Properties Dialog */}
      <Dialog open={linkPropertyDialogOpen} onClose={handleCloseLinkPropertyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Link Properties - {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : 'Client'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select properties to link to this client
          </Typography>
          {properties && properties.length > 0 ? (
            <List>
              {properties.map((property) => (
                <ListItem key={property.id} button>
                  <Checkbox
                    checked={selectedPropertiesForLinking.includes(property.id)}
                    onChange={() => handleTogglePropertySelection(property.id)}
                  />
                  <ListItemText
                    primary={property.name}
                    secondary={property.streetAddress ? `${property.streetAddress}, ${property.city}` : property.city}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No properties available
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLinkPropertyDialog}>Cancel</Button>
          <Button onClick={handleSavePropertyLinks} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
