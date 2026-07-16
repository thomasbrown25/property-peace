import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Checkbox,
  ListItemText,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Divider,
  FormControlLabel
} from '@mui/material';
import { UserAddOutlined } from '@ant-design/icons';

// project imports
import { useSelector, useDispatch } from 'react-redux';
import { selectTenants } from 'store/tenant/tenant.selector';
import { TENANT_ACTION_TYPES } from 'store/tenant/tenant.types';
import { getAllTenants } from 'store/tenant/tenant.action';
import useFetchAllTenants from 'hooks/useFetchAllTenants';
import { openSnackbar } from 'api/snackbar';
import { tenantInviteAPI } from 'api';
import axiosServices from 'utils/axios';

// ==============================|| TENANT SELECTOR ||============================== //

export default function TenantSelector({
  selectedTenants,
  onSelectTenants,
  propertyId,
  unitId
}) {
  const dispatch = useDispatch();
  const { isLoading } = useFetchAllTenants(); // Ensure tenants are loaded and get loading state
  const allTenants = useSelector(selectTenants) || [];
  const [availableTenants, setAvailableTenants] = useState([]);
  const [error, setError] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phoneNumber: '',
    sendInvite: true // Default to sending invite
  });

  useEffect(() => {
    // Filter tenants to show only those who are not currently on a lease
    // This includes: tenants with no lease, or tenants whose lease has ended
    // Excludes: tenants with active leases or leases that haven't started yet
    if (allTenants && allTenants.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      const filtered = allTenants.filter(tenant => {
        // Get lease info (handle both camelCase and PascalCase)
        const leaseId = tenant.leaseId || tenant.LeaseId;
        const leaseStartDate = tenant.leaseStartDate || tenant.LeaseStartDate;
        const leaseEndDate = tenant.leaseEndDate || tenant.LeaseEndDate;
        
        // If tenant has no lease, include them
        if (!leaseId) {
          return true;
        }
        
        // If no lease dates, exclude (shouldn't happen, but safety check)
        if (!leaseStartDate || !leaseEndDate) {
          return false;
        }
        
        // Convert to Date objects for comparison
        const startDate = new Date(leaseStartDate);
        const endDate = new Date(leaseEndDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        // Include only if lease has ended (endDate < today)
        // This excludes:
        // - Active leases (startDate <= today && endDate >= today)
        // - Future leases (startDate > today) - these are excluded because if startDate > today, then endDate > today too
        return endDate < today;
      });
      
      setAvailableTenants(filtered);
    } else {
      setAvailableTenants([]);
    }
  }, [allTenants]);

  // Ensure selected tenants are always in availableTenants (for newly created tenants)
  useEffect(() => {
    if (selectedTenants && selectedTenants.length > 0) {
      setAvailableTenants(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const missingTenants = selectedTenants.filter(t => t.id && !existingIds.has(t.id));
        if (missingTenants.length > 0) {
          return [...prev, ...missingTenants];
        }
        return prev;
      });
    }
  }, [selectedTenants]);

  const handleTenantChange = (event) => {
    const value = event.target.value;
    const selected = availableTenants.filter(t => value.includes(t.id));
    onSelectTenants(selected);
  };

  const handleCreateTenant = async () => {
    // Validate form
    if (!inviteForm.firstname || !inviteForm.lastname) {
      openSnackbar('error', 'Please fill in First name and Last name');
      return;
    }

    // Email is required if sending invite
    if (inviteForm.sendInvite && !inviteForm.email) {
      openSnackbar('error', 'Email is required when sending an invite');
      return;
    }

    // Validate email format if provided
    if (inviteForm.email && !inviteForm.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      openSnackbar('error', 'Please enter a valid email address');
      return;
    }

    // Check if tenant with this email already exists (if email provided)
    if (inviteForm.email) {
      const emailToCheck = inviteForm.email.trim().toLowerCase();
      const existingTenant = allTenants.find(
        t => t.email && t.email.toLowerCase() === emailToCheck
      );

      if (existingTenant) {
        // Tenant already exists - add them to selected tenants if not already selected
        const isAlreadySelected = selectedTenants.some(t => t.id === existingTenant.id);
        if (!isAlreadySelected) {
          const newSelectedTenants = [...selectedTenants, existingTenant];
          onSelectTenants(newSelectedTenants);
          openSnackbar('info', `Tenant with email ${inviteForm.email} already exists. Added to selection.`);
        } else {
          openSnackbar('info', `Tenant with email ${inviteForm.email} is already selected.`);
        }
        
        // Reset form and close dialog
        setInviteForm({
          firstname: '',
          lastname: '',
          email: '',
          phoneNumber: '',
          sendInvite: true
        });
        setInviteDialogOpen(false);
        return;
      }
    }

    setInviting(true);
    try {
      // Create tenant payload
      const tenantPayload = {
        PropertyId: propertyId || null,
        UnitId: unitId || null,
        LeaseId: null,
        Firstname: inviteForm.firstname.trim(),
        Lastname: inviteForm.lastname.trim(),
        Email: inviteForm.email?.trim() || null,
        PhoneNumber: inviteForm.phoneNumber?.trim() || null
      };

      // Save tenant first
      const saveResponse = await axiosServices.post('/api/tenant', tenantPayload);
      const tenantId = saveResponse.data?.data?.Id || saveResponse.data?.data?.id;
      const savedTenant = saveResponse.data?.data;

      if (!tenantId) {
        openSnackbar('error', 'Failed to create tenant.');
        setInviting(false);
        return;
      }

      // Update Redux store with the saved tenant
      if (savedTenant) {
        dispatch({
          type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS,
          payload: savedTenant
        });
      }

      // Send invite if requested and email is provided
      if (inviteForm.sendInvite && inviteForm.email) {
        try {
          await tenantInviteAPI.createTenantInvite({
            tenantId: tenantId,
            email: inviteForm.email.trim()
          });
        } catch (inviteError) {
          // Log error but don't fail the tenant creation
          console.error('Error sending invite:', inviteError);
          openSnackbar('warning', 'Tenant created but failed to send invite. You can send it later.');
        }
      }

      // Refresh tenant list to include the new tenant
      await dispatch(getAllTenants());

      // Ensure the saved tenant has the correct structure for selection
      const tenantToAdd = {
        id: savedTenant.id || savedTenant.Id || tenantId,
        firstname: savedTenant.firstname || savedTenant.Firstname || inviteForm.firstname.trim(),
        lastname: savedTenant.lastname || savedTenant.Lastname || inviteForm.lastname.trim(),
        email: savedTenant.email || savedTenant.Email || inviteForm.email?.trim() || null,
        phoneNumber: savedTenant.phoneNumber || savedTenant.PhoneNumber || inviteForm.phoneNumber?.trim() || null,
        propertyId: savedTenant.propertyId || savedTenant.PropertyId || propertyId || null,
        unitId: savedTenant.unitId || savedTenant.UnitId || unitId || null
      };

      // Add the new tenant to availableTenants immediately so it shows in the Select
      setAvailableTenants(prev => {
        // Check if tenant already exists in the list
        const exists = prev.some(t => t.id === tenantToAdd.id);
        if (exists) {
          return prev;
        }
        return [...prev, tenantToAdd];
      });

      // Add tenant to selected tenants - this will make it show as selected
      const isAlreadySelected = selectedTenants.some(t => t.id === tenantToAdd.id);
      if (!isAlreadySelected) {
        const newSelectedTenants = [...selectedTenants, tenantToAdd];
        onSelectTenants(newSelectedTenants);
      }

      // Show success message
      if (inviteForm.sendInvite && inviteForm.email) {
        openSnackbar('success', `Tenant created and invite sent to ${inviteForm.email}`);
      } else {
        openSnackbar('success', 'Tenant created successfully');
      }
      
      // Reset form and close dialog
      setInviteForm({
        firstname: '',
        lastname: '',
        email: '',
        phoneNumber: '',
        sendInvite: true
      });
      setInviteDialogOpen(false);
    } catch (inviteError) {
      console.error('Error creating tenant or sending invite:', inviteError);
      openSnackbar('error', inviteError?.response?.data?.message || 'Failed to create tenant or send invite');
    } finally {
      setInviting(false);
    }
  };

  // Use the loading state from the hook, not based on tenant count
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Removed property/unit requirement - we show all organization tenants

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Select Tenants (Optional)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select one or more tenants for this lease agreement. You can skip this step and add tenants later.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Tenants</InputLabel>
              <Select
                multiple
                value={selectedTenants.map(t => t.id)}
                label="Select Tenants"
                onChange={handleTenantChange}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => {
                      // First check selectedTenants, then availableTenants
                      const tenant = selectedTenants.find(t => t.id === id) || availableTenants.find(t => t.id === id);
                      return tenant ? (
                        <Chip key={id} label={`${tenant.firstname || tenant.Firstname || ''} ${tenant.lastname || tenant.Lastname || ''}`} size="small" />
                      ) : null;
                    })}
                  </Box>
                )}
              >
                {availableTenants.length === 0 ? (
                  <MenuItem disabled>No tenants available in your organization</MenuItem>
                ) : (
                  availableTenants.map((tenant) => (
                    <MenuItem key={tenant.id} value={tenant.id}>
                      <Checkbox checked={selectedTenants.some(t => t.id === tenant.id)} />
                      <ListItemText
                        primary={`${tenant.firstname} ${tenant.lastname}`}
                        secondary={tenant.email || tenant.phoneNumber}
                      />
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<UserAddOutlined />}
              onClick={() => setInviteDialogOpen(true)}
              sx={{ minWidth: 'auto', whiteSpace: 'nowrap' }}
            >
              Add Tenant
            </Button>
          </Stack>
        </Grid>

        {selectedTenants.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Selected Tenants ({selectedTenants.length})
                </Typography>
                {selectedTenants.map((tenant) => (
                  <Typography key={tenant.id} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    • {tenant.firstname} {tenant.lastname}
                    {tenant.email && ` (${tenant.email})`}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Add Tenant Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => !inviting && setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Tenant</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Enter the tenant's information. You can optionally send them an invitation email to create an account.
            </Typography>
            <TextField
              fullWidth
              label="First Name *"
              value={inviteForm.firstname}
              onChange={(e) => setInviteForm({ ...inviteForm, firstname: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Last Name *"
              value={inviteForm.lastname}
              onChange={(e) => setInviteForm({ ...inviteForm, lastname: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              helperText={inviteForm.sendInvite ? "Required if sending invite" : "Optional"}
            />
            <TextField
              fullWidth
              label="Phone Number"
              value={inviteForm.phoneNumber}
              onChange={(e) => setInviteForm({ ...inviteForm, phoneNumber: e.target.value })}
            />
            <Divider />
            <FormControlLabel
              control={
                <Checkbox
                  checked={inviteForm.sendInvite}
                  onChange={(e) => setInviteForm({ ...inviteForm, sendInvite: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Send invitation email to create account
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    The tenant will receive an email with a link to create their account
                  </Typography>
                </Box>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)} disabled={inviting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTenant}
            disabled={inviting || !inviteForm.firstname || !inviteForm.lastname || (inviteForm.sendInvite && !inviteForm.email)}
            startIcon={inviting ? <CircularProgress size={16} /> : null}
          >
            {inviting 
              ? (inviteForm.sendInvite ? 'Creating & Sending Invite...' : 'Creating...')
              : (inviteForm.sendInvite ? 'Create & Send Invite' : 'Create Tenant')
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

TenantSelector.propTypes = {
  selectedTenants: PropTypes.array.isRequired,
  onSelectTenants: PropTypes.func.isRequired,
  propertyId: PropTypes.number,
  unitId: PropTypes.number
};
