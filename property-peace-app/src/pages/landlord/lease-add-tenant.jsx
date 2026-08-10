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
  Alert,
  alpha
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ArrowLeftOutlined, UserOutlined, PlusOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const {
    properties: fetchedProperties,
    propertiesRefetch,
    isLoading: propertiesLoading,
    propertiesError,
    propertiesLoadedAt
  } = useFetchProperties();
  const propsList = properties || fetchedProperties || [];

  const [lease, setLease] = useState(null);
  const [allOrgTenants, setAllOrgTenants] = useState([]);
  const [leaseTenants, setLeaseTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantLoadError, setTenantLoadError] = useState(null);
  const [tenantLoadRequest, setTenantLoadRequest] = useState(0);
  const [existingSelected, setExistingSelected] = useState(null);
  const [addingExisting, setAddingExisting] = useState(false);
  const [invitingTenantId, setInvitingTenantId] = useState(null);

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
  const requestedTenantId = Number(searchParams.get('tenantId'));
  const targetTenantId = Number.isSafeInteger(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : null;

  useEffect(() => {
    const found = propsList?.flatMap((p) => (p.units || []).filter((u) => u.lease).map((u) => ({ ...u.lease, unit: u, property: p })))?.find((l) => String(l?.id ?? l?.Id) === String(leaseId));
    setLease(found || null);
  }, [propsList, leaseId]);

  useEffect(() => {
    const load = async () => {
      setLoadingTenants(true);
      setTenantLoadError(null);
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
        setTenantLoadError('Unable to load tenants. Check your connection and try again.');
        setAllOrgTenants([]);
        setLeaseTenants([]);
      } finally {
        setLoadingTenants(false);
      }
    };
    load();
  }, [dispatch, leaseId, tenantLoadRequest]);

  const retryTenantLoad = () => setTenantLoadRequest((request) => request + 1);

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

  const handleInviteExisting = async (tenant) => {
    const tenantId = tenant?.id ?? tenant?.Id;
    const email = tenant?.email ?? tenant?.Email;
    if (!tenantId || !email?.trim()) {
      openSnackbar({
        open: true,
        message: 'Add an email address before inviting this tenant to the portal',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setInvitingTenantId(Number(tenantId));
    try {
      await tenantInviteAPI.createTenantInvite({ tenantId: Number(tenantId), email: email.trim() });
      openSnackbar({
        open: true,
        message: `A tenant portal invitation was sent to ${email.trim()}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to send the tenant portal invitation',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setInvitingTenantId(null);
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
      let inviteFailed = false;
      if (newId && newTenantForm.sendInvite && newTenantForm.email?.trim()) {
        try {
          await tenantInviteAPI.createTenantInvite({ tenantId: newId, email: newTenantForm.email.trim() });
        } catch {
          inviteFailed = true;
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
        message: inviteFailed
          ? 'Tenant added, but the portal invitation failed. Use Send portal invite to try again.'
          : 'Tenant created and added to this lease',
        variant: 'alert',
        alert: { color: inviteFailed ? 'warning' : 'success' }
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

  if (propertiesError && !propertiesLoadedAt) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', py: 4 }}>
        <Stack spacing={2}>
          <Alert severity="error">
            <strong>Unable to load properties.</strong> Check your connection and try again before opening this lease.
          </Alert>
          <Button variant="contained" onClick={propertiesRefetch} sx={{ minHeight: 44, alignSelf: 'flex-start' }}>
            Retry
          </Button>
        </Stack>
      </Box>
    );
  }

  if (propertiesLoading || !propertiesLoadedAt) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!lease) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', py: 4 }}>
        <Stack spacing={2}>
          <Alert severity="warning">
            <strong>Unable to open this lease.</strong> It may no longer exist, or it may not be available in the selected organization.
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" onClick={() => navigate('/landlord/leases')} sx={{ minHeight: 44 }}>
              Choose a lease
            </Button>
            <Button variant="outlined" onClick={propertiesRefetch} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          </Stack>
        </Stack>
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
      <Typography component="h1" variant="h4" fontWeight={600} sx={{ mb: 1 }}>
        Add tenant to lease
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {lease?.unit?.name || lease?.unitName || 'This unit'} · {lease?.property?.name || lease?.propertyName || 'Property'}
      </Typography>

      {tenantLoadError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={(
            <Button color="inherit" size="small" onClick={retryTenantLoad} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          )}
        >
          {tenantLoadError}
        </Alert>
      )}

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
                sx={{ minHeight: 44, textTransform: 'none' }}
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
                  sx={{ minHeight: 44, textTransform: 'none' }}
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
        {tenantLoadError ? (
          <Typography variant="body2" color="error.main">
            Tenant information is unavailable until the request succeeds.
          </Typography>
        ) : leaseTenants.length === 0 ? (
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
                <ListItem
                  key={id}
                  aria-current={Number(id) === targetTenantId ? 'true' : undefined}
                  sx={{
                    alignItems: { xs: 'stretch', sm: 'center' },
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    gap: { xs: 1, sm: 0 },
                    bgcolor: Number(id) === targetTenantId ? (theme) => alpha(theme.palette.primary.main, 0.1) : undefined
                  }}
                >
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
                  {email?.trim?.() ? (
                    <Button
                      size="small"
                      variant={Number(id) === targetTenantId ? 'contained' : 'outlined'}
                      onClick={() => handleInviteExisting(t)}
                      aria-label={`Send portal invite to ${name}`}
                      disabled={invitingTenantId === Number(id)}
                      sx={{ minHeight: 44, ml: { sm: 1 }, width: { xs: '100%', sm: 'auto' }, flexShrink: 0, textTransform: 'none' }}
                    >
                      {invitingTenantId === Number(id) ? 'Sending…' : 'Send portal invite'}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/landlord/tenants/${id}`)}
                      aria-label={`Add email for ${name}`}
                      sx={{ minHeight: 44, ml: { sm: 1 }, width: { xs: '100%', sm: 'auto' }, flexShrink: 0, textTransform: 'none' }}
                    >
                      Add email
                    </Button>
                  )}
                </ListItem>
              );
            })}
          </List>
        )}
      </MainCard>
    </Box>
  );
}
