import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Divider,
  TextField,
  FormControl,
  FormLabel,
  InputLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  useTheme,
  CircularProgress,
  IconButton,
  FormHelperText,
  Chip
} from '@mui/material';
import MainCard from 'components/MainCard';
import BuildLeaseAgreementHeader from 'sections/landlord/lease-builder/BuildLeaseAgreementHeader';
import AddTenantDialog from 'components/dialogs/AddTenantDialog';
import AddressAutocomplete from 'components/input/AddressAutocomplete';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import { setProperty as setReduxProperty } from 'store/property/property.action';
import { setUnit as setReduxUnit } from 'store/unit/unit.action';
import { updateLease, updateLeaseAgreement } from 'store/lease/lease.action';
import { removeTenantFromLease } from 'api/lease';
import {
  TeamOutlined,
  HomeOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import { STATE_NAMES } from 'api/stateDepositLaw';

const US_STATES_OPTIONS = Object.entries(STATE_NAMES).map(([value, label]) => ({ value, label }));

const defaultLandlord = () => ({
  entityType: 'Individual',
  firstName: '',
  lastName: '',
  companyName: '',
  email: '',
  phone: '',
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  sortOrder: 0
});

const defaultSigner = () => ({ firstName: '', lastName: '', email: '', sortOrder: 0 });
const defaultOccupant = () => ({ firstName: '', lastName: '', email: '', sortOrder: 0 });

export default function PeopleOnLeasePage({ embedded = false, onSaved } = {}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  const { user } = useAuth();
  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const propertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const unitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  const [lease, setLease] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tenants
  const [addTenantsLater, setAddTenantsLater] = useState(false);
  const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);

  // Landlords
  const [landlords, setLandlords] = useState([defaultLandlord()]);

  // Other scenarios
  const [tenantMailingDiffers, setTenantMailingDiffers] = useState(false);
  const [tenantMailingStreet, setTenantMailingStreet] = useState('');
  const [tenantMailingCity, setTenantMailingCity] = useState('');
  const [tenantMailingState, setTenantMailingState] = useState('');
  const [tenantMailingZip, setTenantMailingZip] = useState('');
  const [hasCoSigners, setHasCoSigners] = useState(false);
  const [coSigners, setCoSigners] = useState([]);
  const [newCoSigner, setNewCoSigner] = useState(defaultSigner());
  const [hasAdditionalSigners, setHasAdditionalSigners] = useState(false);
  const [additionalSigners, setAdditionalSigners] = useState([]);
  const [newAdditionalSigner, setNewAdditionalSigner] = useState(defaultSigner());
  // Other occupants (people who live there but are not on the lease)
  const [occupants, setOccupants] = useState([]);
  const [newOccupant, setNewOccupant] = useState(defaultOccupant());

  useEffect(() => {
    const load = async () => {
      if (!leaseId || !propertyId) {
        setLoading(false);
        return;
      }
      const foundProperty = properties?.find((p) => p.id === propertyId);
      if (!foundProperty) {
        setLoading(false);
        return;
      }
      setProperty(foundProperty);
      const foundUnit = unitId
        ? foundProperty.units?.find((u) => u.id === unitId)
        : foundProperty.units?.[0];
      if (foundUnit) {
        setUnit(foundUnit);
        const unitLease = foundUnit.lease || foundUnit.Lease;
        if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
          setLease(unitLease);
        }
      }
      setLoading(false);
    };
    if (properties?.length) load();
  }, [leaseId, propertyId, unitId, properties]);

  // Prefill from lease
  useEffect(() => {
    if (!lease) return;
    setAddTenantsLater(lease.addTenantsLater ?? lease.AddTenantsLater ?? false);
    setTenantMailingDiffers(lease.tenantMailingAddressDiffers ?? lease.TenantMailingAddressDiffers ?? false);
    setTenantMailingStreet(lease.tenantMailingStreetAddress ?? lease.TenantMailingStreetAddress ?? '');
    setTenantMailingCity(lease.tenantMailingCity ?? lease.TenantMailingCity ?? '');
    setTenantMailingState(lease.tenantMailingState ?? lease.TenantMailingState ?? '');
    setTenantMailingZip(lease.tenantMailingZipCode ?? lease.TenantMailingZipCode ?? '');
    const ll = lease.leaseLandlords ?? lease.LeaseLandlords ?? [];
    if (ll.length) setLandlords(ll.map((l) => ({
      entityType: l.entityType ?? 'Individual',
      firstName: l.firstName ?? '',
      lastName: l.lastName ?? '',
      companyName: l.companyName ?? '',
      email: l.email ?? '',
      phone: l.phone ?? '',
      streetAddress: l.streetAddress ?? '',
      city: l.city ?? '',
      state: l.state ?? '',
      zipCode: l.zipCode ?? '',
      sortOrder: l.sortOrder ?? 0
    })));
    const cs = lease.leaseCoSigners ?? lease.LeaseCoSigners ?? [];
    if (cs.length) {
      setHasCoSigners(true);
      setCoSigners(cs.map((s) => ({ firstName: s.firstName ?? '', lastName: s.lastName ?? '', email: s.email ?? '', sortOrder: s.sortOrder ?? 0 })));
    }
    const as = lease.leaseAdditionalSigners ?? lease.LeaseAdditionalSigners ?? [];
    if (as.length) {
      setHasAdditionalSigners(true);
      setAdditionalSigners(as.map((s) => ({ firstName: s.firstName ?? '', lastName: s.lastName ?? '', email: s.email ?? '', sortOrder: s.sortOrder ?? 0 })));
    }
    const occ = lease.leaseOccupants ?? lease.LeaseOccupants ?? [];
    if (occ.length) setOccupants(occ.map((o) => ({ firstName: o.firstName ?? '', lastName: o.lastName ?? '', email: o.email ?? '', sortOrder: o.sortOrder ?? 0 })));
  }, [lease]);

  // Pre-fill first landlord from current user when no saved landlords
  useEffect(() => {
    if (loading || !lease || !property || !user) return;
    setLandlords((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      const hasSavedData = first.firstName || first.lastName || first.email || first.streetAddress;
      if (hasSavedData) return prev;
      return [{
        ...first,
        firstName: user.firstName ?? user.firstname ?? '',
        lastName: user.lastName ?? user.lastname ?? '',
        email: user.email ?? '',
        phone: user.phoneNumber ?? user.phone ?? ''
      }, ...prev.slice(1)];
    });
  }, [loading, lease, property, user]);

  const handleBack = () => {
    if (embedded) {
      onSaved?.();
      return;
    }
    navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
  };

  const tenantsOnLease = lease?.tenants ?? lease?.Tenants ?? [];

  const handleOpenAddTenantDialog = () => {
    if (property) dispatch(setReduxProperty(property));
    if (unit) dispatch(setReduxUnit(unit));
    setAddTenantDialogOpen(true);
  };

  const removeTenant = async (tenantId) => {
    if (!leaseId) return;
    try {
      await removeTenantFromLease(leaseId, tenantId);
      await propertiesRefetch();
      openSnackbar({ open: true, message: 'Tenant removed from lease', variant: 'alert', alert: { color: 'success' } });
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to remove tenant', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const addLandlord = () => setLandlords((prev) => [...prev, { ...defaultLandlord(), sortOrder: prev.length }]);
  const removeLandlord = (idx) => setLandlords((prev) => prev.filter((_, i) => i !== idx));
  const updateLandlord = (idx, field, value) => {
    setLandlords((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const updateLandlordFields = (idx, fields) => {
    setLandlords((prev) => prev.map((l, i) => (i === idx ? { ...l, ...fields } : l)));
  };

  const saveCoSigner = () => {
    if (!newCoSigner.firstName?.trim() || !newCoSigner.lastName?.trim() || !newCoSigner.email?.trim()) return;
    setCoSigners((prev) => [...prev, { ...newCoSigner, sortOrder: prev.length }]);
    setNewCoSigner(defaultSigner());
  };
  const removeCoSigner = (idx) => setCoSigners((prev) => prev.filter((_, i) => i !== idx));

  const saveAdditionalSigner = () => {
    if (!newAdditionalSigner.firstName?.trim() || !newAdditionalSigner.lastName?.trim() || !newAdditionalSigner.email?.trim()) return;
    setAdditionalSigners((prev) => [...prev, { ...newAdditionalSigner, sortOrder: prev.length }]);
    setNewAdditionalSigner(defaultSigner());
  };
  const removeAdditionalSigner = (idx) => setAdditionalSigners((prev) => prev.filter((_, i) => i !== idx));

  const saveOccupant = () => {
    if (!newOccupant.firstName?.trim() || !newOccupant.lastName?.trim()) return;
    setOccupants((prev) => [...prev, { ...newOccupant, sortOrder: prev.length }]);
    setNewOccupant(defaultOccupant());
  };
  const removeOccupant = (idx) => setOccupants((prev) => prev.filter((_, i) => i !== idx));

  const buildPayload = () => {
    const currentLeaseId = lease?.id ?? lease?.Id ?? leaseId;
    const payload = {
      id: currentLeaseId,
      propertyId: property?.id ?? propertyId,
      unitId: unit?.id ?? unitId,
      name: lease?.name ?? lease?.Name,
      startDate: lease?.startDate ?? lease?.StartDate,
      endDate: lease?.endDate ?? lease?.EndDate,
      rentAmount: lease?.rentAmount ?? lease?.RentAmount,
      depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
      organizationId: lease?.organizationId ?? lease?.OrganizationId ?? property?.organizationId,
      isPeopleOnLeaseComplete: true,
      addTenantsLater: addTenantsLater,
      tenantMailingAddressDiffers: tenantMailingDiffers,
      tenantMailingStreetAddress: tenantMailingDiffers ? tenantMailingStreet || undefined : undefined,
      tenantMailingCity: tenantMailingDiffers ? tenantMailingCity || undefined : undefined,
      tenantMailingState: tenantMailingDiffers ? tenantMailingState || undefined : undefined,
      tenantMailingZipCode: tenantMailingDiffers ? tenantMailingZip || undefined : undefined,
      leaseLandlords: landlords.map((l, i) => ({
        id: 0,
        entityType: l.entityType,
        firstName: l.firstName || undefined,
        lastName: l.lastName || undefined,
        companyName: l.companyName || undefined,
        email: l.email || undefined,
        phone: l.phone || undefined,
        streetAddress: l.streetAddress || undefined,
        city: l.city || undefined,
        state: l.state || undefined,
        zipCode: l.zipCode || undefined,
        sortOrder: i
      })),
      leaseCoSigners: hasCoSigners ? coSigners.map((s, i) => ({ id: 0, ...s, sortOrder: i })) : [],
      leaseAdditionalSigners: hasAdditionalSigners ? additionalSigners.map((s, i) => ({ id: 0, ...s, sortOrder: i })) : [],
      leaseOccupants: occupants.map((o, i) => ({ id: 0, firstName: o.firstName || undefined, lastName: o.lastName || undefined, email: o.email || undefined, sortOrder: i })),
      isLeaseSpecificsComplete: lease?.isLeaseSpecificsComplete ?? lease?.IsLeaseSpecificsComplete,
      isRentDepositFeesComplete: lease?.isRentDepositFeesComplete ?? lease?.IsRentDepositFeesComplete,
      isPetsSmokingOtherComplete: lease?.isPetsSmokingOtherComplete ?? lease?.IsPetsSmokingOtherComplete,
      isUtilitiesMaintenanceKeysComplete: lease?.isUtilitiesMaintenanceKeysComplete ?? lease?.IsUtilitiesMaintenanceKeysComplete,
      isProvisionsAttachmentsComplete: lease?.isProvisionsAttachmentsComplete ?? lease?.IsProvisionsAttachmentsComplete
    };
    return payload;
  };

  const handleSaveDraft = async () => {
    if (!leaseId) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const currentLeaseId = lease?.id ?? lease?.Id ?? leaseId;
      await dispatch(updateLease(payload));
      await dispatch(updateLeaseAgreement(currentLeaseId, { isPeopleOnLeaseComplete: true }));
      await propertiesRefetch();
      openSnackbar({ open: true, message: 'Draft saved successfully', variant: 'alert', alert: { color: 'success' } });
      if (embedded) {
        onSaved?.();
      } else {
        navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    if (!leaseId) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const leaseIdForAgreement = lease?.id ?? lease?.Id ?? leaseId;
      const result = await dispatch(updateLease(payload));
      if (result?.success) await dispatch(updateLeaseAgreement(leaseIdForAgreement, { isPeopleOnLeaseComplete: true }));
      if (result?.success !== true && result?.success !== undefined) {
        openSnackbar({ open: true, message: result?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
        setSaving(false);
        return;
      }
      await propertiesRefetch();
      openSnackbar({ open: true, message: 'Saved successfully', variant: 'alert', alert: { color: 'success' } });
      if (embedded) {
        onSaved?.();
      } else {
        navigate(`/landlord/leases/build-lease-agreement/pets-smoking-other?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!lease || !property) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>Lease Not Found</Typography>
        <Button onClick={handleBack} variant="contained">Go Back</Button>
      </Box>
    );
  }

  return (
    <Box sx={embedded ? { bgcolor: 'transparent' } : { minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth={embedded ? false : "md"} disableGutters={embedded} sx={{ py: embedded ? 0 : 3 }}>
        {!embedded && <BuildLeaseAgreementHeader onBack={handleBack} onSaveDraft={handleSaveDraft} showTitle={false} />}

        <MainCard>
          <Stack spacing={4}>
            {!embedded && (
              <>
                <Box>
                  <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>People on the Lease</Typography>
                  <Typography variant="body2" color="text.secondary">Confirm the landlord and tenant info.</Typography>
                </Box>
                <Divider />
              </>
            )}

            {/* Tenants */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <TeamOutlined style={{ fontSize: 22, color: theme.palette.primary.main }} />
                <Typography variant="h6" fontWeight={600}>Tenants</Typography>
              </Stack>
              {tenantsOnLease.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                  {tenantsOnLease.map((t) => (
                    <Chip
                      key={t.id ?? t.Id}
                      label={
                        <span>
                          {(t.firstname ?? t.firstName ?? '')} {(t.lastname ?? t.lastName ?? '')}
                          {t.email ? ` — ${t.email}` : ''}
                        </span>
                      }
                      onDelete={() => removeTenant(t.id ?? t.Id)}
                      variant="outlined"
                      sx={{ maxWidth: '100%' }}
                    />
                  ))}
                </Stack>
              )}
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlusOutlined />}
                  onClick={handleOpenAddTenantDialog}
                  sx={{ textTransform: 'none', mr: 3 }}
                >
                  Add tenant
                </Button>
                <FormControlLabel
                  control={
                    <Radio
                      checked={addTenantsLater}
                      onChange={() => setAddTenantsLater(true)}
                      name="addLater"
                    />
                  }
                  label="I'll add my tenants later"
                />
              </Stack>
              {addTenantsLater && (
                <FormControlLabel
                  control={
                    <Radio
                      checked={!addTenantsLater}
                      onChange={() => setAddTenantsLater(false)}
                      name="addLaterNo"
                    />
                  }
                  label="I want to add tenants now"
                />
              )}
            </Box>
            <Divider />

            {/* Other occupants (not on the lease) */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <UserOutlined style={{ fontSize: 22, color: theme.palette.primary.main }} />
                <Typography variant="h6" fontWeight={600}>Other occupants</Typography>
              </Stack>
              <FormHelperText sx={{ mt: -1, mb: 1.5 }}>
                People who will live at the property but are not on the lease (e.g. minor children, other family members).
              </FormHelperText>
              {occupants.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                  {occupants.map((o, i) => (
                    <Chip
                      key={i}
                      label={
                        <span>
                          {o.firstName} {o.lastName}
                          {o.email ? ` — ${o.email}` : ''}
                        </span>
                      }
                      onDelete={() => removeOccupant(i)}
                      variant="outlined"
                      sx={{ maxWidth: '100%' }}
                    />
                  ))}
                </Stack>
              )}
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                  <TextField
                    size="small"
                    placeholder="First name"
                    value={newOccupant.firstName}
                    onChange={(e) => setNewOccupant((p) => ({ ...p, firstName: e.target.value }))}
                    sx={{ width: 130 }}
                  />
                  <TextField
                    size="small"
                    placeholder="Last name"
                    value={newOccupant.lastName}
                    onChange={(e) => setNewOccupant((p) => ({ ...p, lastName: e.target.value }))}
                    sx={{ width: 130 }}
                  />
                  <TextField
                    size="small"
                    placeholder="Email (optional)"
                    type="email"
                    value={newOccupant.email}
                    onChange={(e) => setNewOccupant((p) => ({ ...p, email: e.target.value }))}
                    sx={{ width: 200 }}
                  />
                </Stack>
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PlusOutlined />}
                    onClick={saveOccupant}
                    sx={{ textTransform: 'none' }}
                  >
                    Add occupant
                  </Button>
                </Box>
              </Stack>
            </Box>
            <Divider />

            {/* Landlord(s) */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <HomeOutlined style={{ fontSize: 22, color: theme.palette.primary.main }} />
                <Typography variant="h6" fontWeight={600}>Landlord</Typography>
              </Stack>
              {landlords.map((ll, idx) => (
                <Stack key={idx} spacing={2} sx={{ mb: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">Landlord {idx + 1}</Typography>
                    {landlords.length > 1 && (
                      <IconButton size="small" onClick={() => removeLandlord(idx)} color="error" aria-label="Remove landlord"><DeleteOutlined /></IconButton>
                    )}
                  </Stack>
                  <FormControl>
                    <FormLabel>Entity type</FormLabel>
                    <RadioGroup
                      row
                      value={ll.entityType}
                      onChange={(e) => updateLandlord(idx, 'entityType', e.target.value)}
                    >
                      <FormControlLabel value="Individual" control={<Radio size="small" />} label="Individual" />
                      <FormControlLabel value="Company" control={<Radio size="small" />} label="Company" />
                    </RadioGroup>
                  </FormControl>
                  {ll.entityType === 'Individual' ? (
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>First name</InputLabel>
                        <TextField size="small" fullWidth value={ll.firstName} onChange={(e) => updateLandlord(idx, 'firstName', e.target.value)} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>Last name</InputLabel>
                        <TextField size="small" fullWidth value={ll.lastName} onChange={(e) => updateLandlord(idx, 'lastName', e.target.value)} />
                      </Box>
                    </Stack>
                  ) : (
                    <Box>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>Company name</InputLabel>
                      <TextField size="small" fullWidth value={ll.companyName} onChange={(e) => updateLandlord(idx, 'companyName', e.target.value)} />
                    </Box>
                  )}
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>Email</InputLabel>
                      <TextField size="small" type="email" fullWidth value={ll.email} onChange={(e) => updateLandlord(idx, 'email', e.target.value)} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>Phone</InputLabel>
                      <TextField size="small" fullWidth value={ll.phone} onChange={(e) => updateLandlord(idx, 'phone', e.target.value)} />
                    </Box>
                  </Stack>
                  <Typography variant="subtitle2" color="text.secondary">
                    Landlord mailing address — An address must be listed in case your tenant(s) need to mail you a notice.
                  </Typography>
                  <AddressAutocomplete
                    label="Street address"
                    value={ll.streetAddress}
                    onChange={(v) => updateLandlord(idx, 'streetAddress', v)}
                    onAddressSelected={({ city, state, zipCode }) => updateLandlordFields(idx, { city, state, zipCode })}
                  />
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>City</InputLabel>
                      <TextField size="small" fullWidth value={ll.city} onChange={(e) => updateLandlord(idx, 'city', e.target.value)} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>State</InputLabel>
                      <TextField size="small" select SelectProps={{ native: true }} fullWidth value={ll.state} onChange={(e) => updateLandlord(idx, 'state', e.target.value)}>
                        <option value="" />
                        {US_STATES_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </TextField>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>Zip code</InputLabel>
                      <TextField size="small" fullWidth value={ll.zipCode} onChange={(e) => updateLandlord(idx, 'zipCode', e.target.value)} />
                    </Box>
                  </Stack>
                </Stack>
              ))}
              <Button variant="outlined" size="small" startIcon={<PlusOutlined />} onClick={addLandlord} sx={{ textTransform: 'none' }}>
                Add another landlord
              </Button>
            </Box>
            <Divider />

            {/* Other scenarios */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <InfoCircleOutlined style={{ fontSize: 22, color: theme.palette.primary.main }} />
                <Typography variant="h6" fontWeight={600}>Other scenarios</Typography>
              </Stack>

              <FormControl component="fieldset" sx={{ display: 'block', mb: 2 }}>
                <FormLabel>Will the tenant(s) have a mailing address that differs from the rental property address (e.g. a PO box)?</FormLabel>
                <RadioGroup row value={tenantMailingDiffers ? 'yes' : 'no'} onChange={(e) => setTenantMailingDiffers(e.target.value === 'yes')}>
                  <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                </RadioGroup>
              </FormControl>
              {tenantMailingDiffers && (
                <Stack spacing={1.5} sx={{ pl: 2, mb: 2 }}>
                  <AddressAutocomplete
                    label="Street address"
                    value={tenantMailingStreet}
                    onChange={setTenantMailingStreet}
                    onAddressSelected={({ city, state, zipCode }) => {
                      setTenantMailingCity(city);
                      setTenantMailingState(state);
                      setTenantMailingZip(zipCode);
                    }}
                  />
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>City</InputLabel>
                      <TextField size="small" fullWidth value={tenantMailingCity} onChange={(e) => setTenantMailingCity(e.target.value)} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>State</InputLabel>
                      <TextField size="small" select SelectProps={{ native: true }} fullWidth value={tenantMailingState} onChange={(e) => setTenantMailingState(e.target.value)}>
                        <option value="" />
                        {US_STATES_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </TextField>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>Zip code</InputLabel>
                      <TextField size="small" fullWidth value={tenantMailingZip} onChange={(e) => setTenantMailingZip(e.target.value)} />
                    </Box>
                  </Stack>
                </Stack>
              )}

              <FormControl component="fieldset" sx={{ display: 'block', mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <FormLabel sx={{ mb: 0 }}>Are there any co-signers?</FormLabel>
                  <InfoCircleOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                </Stack>
                <FormHelperText sx={{ mt: 0 }}>Add any co-signers that need to sign this document.</FormHelperText>
                <RadioGroup row value={hasCoSigners ? 'yes' : 'no'} onChange={(e) => setHasCoSigners(e.target.value === 'yes')}>
                  <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                </RadioGroup>
              </FormControl>
              {hasCoSigners && (
                <Box sx={{ pl: 2, mb: 2 }}>
                  {coSigners.map((s, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="body2">{s.firstName} {s.lastName} — {s.email}</Typography>
                      <IconButton size="small" onClick={() => removeCoSigner(i)} color="error"><DeleteOutlined /></IconButton>
                    </Stack>
                  ))}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                    <TextField size="small" placeholder="First name" value={newCoSigner.firstName} onChange={(e) => setNewCoSigner((p) => ({ ...p, firstName: e.target.value }))} sx={{ width: 120 }} />
                    <TextField size="small" placeholder="Last name" value={newCoSigner.lastName} onChange={(e) => setNewCoSigner((p) => ({ ...p, lastName: e.target.value }))} sx={{ width: 120 }} />
                    <TextField size="small" placeholder="Email" type="email" value={newCoSigner.email} onChange={(e) => setNewCoSigner((p) => ({ ...p, email: e.target.value }))} sx={{ width: 200 }} />
                    <Button variant="contained" size="small" onClick={saveCoSigner} sx={{ textTransform: 'none' }}>Save</Button>
                  </Stack>
                  <FormHelperText>Please double-check their email. Whoever receives this email will be able to access and sign the document.</FormHelperText>
                </Box>
              )}

              <FormControl component="fieldset" sx={{ display: 'block' }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <FormLabel sx={{ mb: 0 }}>Are there any additional signers?</FormLabel>
                  <InfoCircleOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                </Stack>
                <FormHelperText sx={{ mt: 0 }}>Add any non-tenant that needs to sign this document.</FormHelperText>
                <RadioGroup row value={hasAdditionalSigners ? 'yes' : 'no'} onChange={(e) => setHasAdditionalSigners(e.target.value === 'yes')}>
                  <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                </RadioGroup>
              </FormControl>
              {hasAdditionalSigners && (
                <Box sx={{ pl: 2, mt: 1 }}>
                  {additionalSigners.map((s, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="body2">{s.firstName} {s.lastName} — {s.email}</Typography>
                      <IconButton size="small" onClick={() => removeAdditionalSigner(i)} color="error"><DeleteOutlined /></IconButton>
                    </Stack>
                  ))}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                    <TextField size="small" placeholder="First name" value={newAdditionalSigner.firstName} onChange={(e) => setNewAdditionalSigner((p) => ({ ...p, firstName: e.target.value }))} sx={{ width: 120 }} />
                    <TextField size="small" placeholder="Last name" value={newAdditionalSigner.lastName} onChange={(e) => setNewAdditionalSigner((p) => ({ ...p, lastName: e.target.value }))} sx={{ width: 120 }} />
                    <TextField size="small" placeholder="Email" type="email" value={newAdditionalSigner.email} onChange={(e) => setNewAdditionalSigner((p) => ({ ...p, email: e.target.value }))} sx={{ width: 200 }} />
                    <Button variant="contained" size="small" onClick={saveAdditionalSigner} sx={{ textTransform: 'none' }}>Save</Button>
                  </Stack>
                </Box>
              )}
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              <Button variant="outlined" onClick={handleSaveDraft} disabled={saving} sx={{ textTransform: 'none' }}>
                Save
              </Button>
              <Button variant="contained" onClick={handleSaveAndNext} disabled={saving} sx={{ textTransform: 'none' }}>
                {saving ? <CircularProgress size={24} /> : 'Save & Next'}
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Container>

      {/* Add tenant dialog (same as Finish Setting Up page) */}
      <AddTenantDialog
        open={addTenantDialogOpen}
        onClose={() => setAddTenantDialogOpen(false)}
        onSuccess={() => {
          setAddTenantDialogOpen(false);
          propertiesRefetch();
        }}
        property={property}
        unitId={unit?.id ?? unit?.Id ?? unitId ?? null}
        leaseId={lease?.id ?? lease?.Id ?? leaseId ?? null}
      />
    </Box>
  );
}
