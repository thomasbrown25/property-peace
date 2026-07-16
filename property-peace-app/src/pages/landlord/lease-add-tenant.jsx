import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  Autocomplete,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  useTheme,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  alpha
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ArrowLeftOutlined, UserOutlined, PlusOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { tenantInviteAPI } from 'api';
import { addTenantToLease } from 'api/lease';
import { selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import { getAllTenants, getTenants } from 'store/tenant/tenant.action';
import { TENANT_ACTION_TYPES } from 'store/tenant/tenant.types';

export default function LeaseAddTenantPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const { properties: fetchedProperties, isLoading: propertiesLoading } = useFetchProperties();
  const propsList = properties || fetchedProperties || [];

  const [lease, setLease] = useState(null);
  const [allOrgTenants, setAllOrgTenants] = useState([]);
  const [leaseTenants, setLeaseTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [existingSelected, setExistingSelected] = useState(null);
  const [addingExisting, setAddingExisting] = useState(false);

  const [newTenantForm, setNewTenantForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phoneNumber: '',
    sendInvite: true
  });
  const [creating, setCreating] = useState(false);

  const leaseUnitId = lease?.unitId ?? lease?.UnitId ?? lease?.unit?.id ?? lease?.unit?.Id;
  const leaseUnit = lease?.unit;

  useEffect(() => {
    const found = propsList?.flatMap((p) => (p.units || []).filter((u) => u.lease).map((u) => ({ ...u.lease, unit: u, property: p })))?.find((l) => String(l?.id ?? l?.Id) === String(leaseId));
    setLease(found || null);
  }, [propsList, leaseId]);

  useEffect(() => {
    const load = async () => {
      setLoadingTenants(true);
      try {
        await dispatch(getAllTenants());
        const orgRes = await axiosServices.get('/api/tenant/organization');
        const orgList = orgRes.data?.data || [];
        setAllOrgTenants(Array.isArray(orgList) ? orgList : []);

        if (leaseId) {
          const leaseRes = await axiosServices.get(`/api/tenant/lease/${leaseId}`);
          const onLease = leaseRes.data?.data || [];
          setLeaseTenants(Array.isArray(onLease) ? onLease : []);
        } else {
          setLeaseTenants([]);
        }
      } catch (e) {
        console.error(e);
        setAllOrgTenants([]);
        setLeaseTenants([]);
      } finally {
        setLoadingTenants(false);
      }
    };
    load();
  }, [dispatch, leaseId]);

  const tenantIdsOnLease = useMemo(() => new Set(leaseTenants.map((t) => t.id ?? t.Id)), [leaseTenants]);
  const availableExistingTenants = useMemo(
    () => allOrgTenants.filter((t) => !tenantIdsOnLease.has(t.id ?? t.Id)),
    [allOrgTenants, tenantIdsOnLease]
  );

  const handleAddExisting = async () => {
    if (!existingSelected || !leaseId) return;
    const tid = existingSelected.id ?? existingSelected.Id;
    const name = [existingSelected.firstname ?? existingSelected.Firstname, existingSelected.lastname ?? existingSelected.Lastname].filter(Boolean).join(' ') || 'Tenant';
    const email = existingSelected.email ?? existingSelected.Email ?? null;
    setAddingExisting(true);
    try {
      await addTenantToLease(Number(leaseId), Number(tid));
      if (leaseUnitId != null) {
        const payload = {
          Id: tid,
          Firstname: existingSelected.firstname ?? existingSelected.Firstname,
          Lastname: existingSelected.lastname ?? existingSelected.Lastname,
          Email: existingSelected.email ?? existingSelected.Email ?? null,
          PhoneNumber: existingSelected.phoneNumber ?? existingSelected.PhoneNumber ?? null,
          UnitId: leaseUnitId,
          LeaseId: Number(leaseId),
          OrganizationId: existingSelected.organizationId ?? existingSelected.OrganizationId,
          UserId: existingSelected.userId ?? existingSelected.UserId ?? null
        };
        await axiosServices.post('/api/tenant', payload);
      }
      dispatch(getTenants(Number(leaseId)));
      dispatch(getAllTenants());
      const leaseRes = await axiosServices.get(`/api/tenant/lease/${leaseId}`);
      const onLease = leaseRes.data?.data || [];
      setLeaseTenants(Array.isArray(onLease) ? onLease : []);
      openSnackbar({
        open: true,
        message: `${name} has been added to this lease`,
        variant: 'alert',
        alert: { color: 'success' }
      });
      setExistingSelected(null);
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to add tenant to lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setAddingExisting(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newTenantForm.firstname?.trim() || !newTenantForm.lastname?.trim()) {
      openSnackbar({
        open: true,
        message: 'First name and last name are required',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }
    if (newTenantForm.sendInvite && !newTenantForm.email?.trim()) {
      openSnackbar({
        open: true,
        message: 'Email is required when sending an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }
    setCreating(true);
    try {
      const tenantPayload = {
        PropertyId: lease?.property?.id ?? lease?.property?.Id ?? null,
        UnitId: leaseUnitId ?? null,
        LeaseId: leaseId ? Number(leaseId) : null,
        Firstname: newTenantForm.firstname.trim(),
        Lastname: newTenantForm.lastname.trim(),
        Email: newTenantForm.email?.trim() || null,
        PhoneNumber: newTenantForm.phoneNumber?.trim() || null
      };
      const saveResponse = await axiosServices.post('/api/tenant', tenantPayload);
      const saved = saveResponse.data?.data;
      const newId = saved?.Id ?? saved?.id;
      if (newId && newTenantForm.sendInvite && newTenantForm.email?.trim()) {
        try {
          await tenantInviteAPI.createTenantInvite({ tenantId: newId, email: newTenantForm.email.trim() });
        } catch (inviteErr) {
          console.warn(inviteErr);
        }
      }
      dispatch({ type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS, payload: saved });
      await dispatch(getAllTenants());
      await dispatch(getTenants(Number(leaseId)));
      const leaseRes = await axiosServices.get(`/api/tenant/lease/${leaseId}`);
      const onLease = leaseRes.data?.data || [];
      setLeaseTenants(Array.isArray(onLease) ? onLease : []);
      openSnackbar({
        open: true,
        message: 'Tenant created and added to this lease',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setNewTenantForm({ firstname: '', lastname: '', email: '', phoneNumber: '', sendInvite: true });
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to create tenant',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setCreating(false);
    }
  };

  if (propertiesLoading || !lease) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs />
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Button startIcon={<ArrowLeftOutlined />} onClick={() => navigate(`/landlord/leases/${leaseId}`)} sx={{ textTransform: 'none' }}>
          Back to lease
        </Button>
      </Stack>
      <Typography variant="h4" fontWeight={600} sx={{ mb: 1 }}>
        Add tenant to lease
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {lease?.unit?.name || lease?.unitName || 'This unit'} · {lease?.property?.name || lease?.propertyName || 'Property'}
      </Typography>

      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Left: Add new tenant */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard title="Add new tenant" sx={{ height: '100%' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the tenant's information. They can be invited to the portal by email.
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="First name *"
                value={newTenantForm.firstname}
                onChange={(e) => setNewTenantForm((f) => ({ ...f, firstname: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Last name *"
                value={newTenantForm.lastname}
                onChange={(e) => setNewTenantForm((f) => ({ ...f, lastname: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newTenantForm.email}
                onChange={(e) => setNewTenantForm((f) => ({ ...f, email: e.target.value }))}
                helperText={newTenantForm.sendInvite ? 'Required if sending invite' : 'Optional'}
              />
              <TextField
                fullWidth
                label="Phone number"
                value={newTenantForm.phoneNumber}
                onChange={(e) => setNewTenantForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newTenantForm.sendInvite}
                    onChange={(e) => setNewTenantForm((f) => ({ ...f, sendInvite: e.target.checked }))}
                  />
                }
                label="Invite to Tenant Portal"
              />
              <Button
                variant="contained"
                onClick={handleCreateNew}
                disabled={creating || !newTenantForm.firstname?.trim() || !newTenantForm.lastname?.trim()}
                startIcon={creating ? <CircularProgress size={18} /> : <PlusOutlined />}
                sx={{ textTransform: 'none' }}
              >
                {creating ? 'Creating…' : 'Create and add to lease'}
              </Button>
            </Stack>
          </MainCard>
        </Grid>

        {/* Right: Add existing tenant + list of added tenants */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard title="Add existing tenant" sx={{ height: '100%' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose a tenant already in your organization to add to this lease.
            </Typography>
            {loadingTenants ? (
              <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Autocomplete
                  options={availableExistingTenants}
                  getOptionLabel={(t) => {
                    const first = t.firstname ?? t.Firstname ?? '';
                    const last = t.lastname ?? t.Lastname ?? '';
                    const em = t.email ?? t.Email ?? '';
                    return [first, last].filter(Boolean).join(' ') || em || 'Unknown';
                  }}
                  value={existingSelected}
                  onChange={(_, v) => setExistingSelected(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Select tenant" placeholder="Search by name or email" />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id ?? option.Id}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <UserOutlined style={{ color: theme.palette.text.secondary }} />
                        <Box>
                          <Typography variant="body2">
                            {(option.firstname ?? option.Firstname ?? '')} {(option.lastname ?? option.Lastname ?? '')}
                          </Typography>
                          {(option.email ?? option.Email) && (
                            <Typography variant="caption" color="text.secondary">
                              {option.email ?? option.Email}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </li>
                  )}
                />
                <Button
                  variant="contained"
                  onClick={handleAddExisting}
                  disabled={!existingSelected || addingExisting}
                  startIcon={addingExisting ? <CircularProgress size={18} /> : <PlusOutlined />}
                  sx={{ textTransform: 'none' }}
                >
                  {addingExisting ? 'Adding…' : 'Add to lease'}
                </Button>
              </Stack>
            )}
          </MainCard>
        </Grid>
      </Grid>

      {/* Tenants section: all tenants on this lease (existing + added on this page) */}
      <MainCard title="Tenants" sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tenants on this lease. Add more above using &quot;Add new tenant&quot; or &quot;Add existing tenant&quot;.
        </Typography>
        {leaseTenants.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No tenants on this lease yet.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderRadius: 1 }}>
            {leaseTenants.map((t) => {
              const id = t.id ?? t.Id;
              const name = [t.firstname ?? t.Firstname, t.lastname ?? t.Lastname].filter(Boolean).join(' ') || 'Tenant';
              const email = t.email ?? t.Email ?? null;
              return (
                <ListItem key={id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: (theme) => theme.palette.primary.main }}>
                      <UserOutlined style={{ fontSize: 18 }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={name}
                    secondary={email || null}
                    primaryTypographyProps={{ fontWeight: 500 }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </MainCard>
    </Box>
  );
}
