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
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  CircularProgress,
  useTheme,
  alpha,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';
import MainCard from 'components/MainCard';
import BuildLeaseAgreementHeader from 'sections/landlord/lease-builder/BuildLeaseAgreementHeader';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import { updateLease, updateLeaseAgreement } from 'store/lease/lease.action';
import { ThunderboltOutlined, ToolOutlined, KeyOutlined, PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const REQUIRED_UTILITY_NAMES = ['Electricity', 'Gas', 'Sewer / Septic', 'Trash', 'Water'];

const KEY_TYPES = [
  { value: 'Property', label: 'Property' },
  { value: 'Mailbox', label: 'Mailbox' },
  { value: 'Garage', label: 'Garage' },
  { value: 'Other', label: 'Other' }
];

const MAINTENANCE_NOTIFICATION_OPTIONS = [
  { id: 'platform', label: 'Platform (Property Peace) maintenance requests' },
  { id: 'usMail', label: 'U.S. mail' },
  { id: 'email', label: 'Email' },
  { id: 'text', label: 'Text message' },
  { id: 'other', label: 'Other' }
];

const SHARED_UTILITIES_DISCLOSURE_PLACEHOLDER = 'List all shared utilities and how they are divided (e.g., formula, billing, charges, shared maintenance).';
const HABITABILITY_INFO = 'Landlords have a legal obligation to maintain habitable premises. Tenants have rights to request repairs for issues that affect habitability. Specifying how tenants should notify you helps ensure timely repairs and compliance with local laws.';
const LOST_KEY_INFO = 'Lost Key: The tenant(s) are responsible for the full cost of rekeying if any keys are lost.';
const KEYS_RETURN_DISCLAIMER = "Your tenant(s) is required to return copies of these keys and/or garage door openers when the lease ends.";

function normalizeUtility(u) {
  return {
    id: u?.id ?? u?.Id,
    name: u?.name ?? u?.Name ?? '',
    responsibility: u?.responsibility ?? u?.Responsibility ?? 'Tenant',
    isRequired: u?.isRequired ?? u?.IsRequired ?? false
  };
}

function normalizeMaintenance(m) {
  return {
    id: m?.id ?? m?.Id,
    name: m?.name ?? m?.Name ?? '',
    description: m?.description ?? m?.Description ?? '',
    responsibility: m?.responsibility ?? m?.Responsibility ?? 'Landlord'
  };
}

function normalizeKey(k) {
  return {
    id: k?.id ?? k?.Id,
    keyType: k?.keyType ?? k?.KeyType ?? 'Property',
    copies: k?.copies ?? k?.Copies ?? 1
  };
}

export default function UtilitiesMaintenanceKeysPage({ embedded = false, onSaved } = {}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const propertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const unitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  const [lease, setLease] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [utilities, setUtilities] = useState([]);
  const [hasSharedUtilities, setHasSharedUtilities] = useState(false);
  const [sharedUtilitiesDisclosure, setSharedUtilitiesDisclosure] = useState('');
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [maintenanceNotificationMethods, setMaintenanceNotificationMethods] = useState([]);
  const [leaseKeys, setLeaseKeys] = useState([]);

  useEffect(() => {
    const loadData = async () => {
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
      const targetUnit = unitId
        ? foundProperty.units?.find((u) => u.id === unitId)
        : foundProperty.units?.[0];
      if (targetUnit) {
        setUnit(targetUnit);
        const unitLease = targetUnit.lease || targetUnit.Lease;
        if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
          setLease(unitLease);
          const rawUtils = unitLease.utilityServiceResponsibilities ?? unitLease.UtilityServiceResponsibilities;
          if (Array.isArray(rawUtils) && rawUtils.length > 0) {
            setUtilities(rawUtils.map(normalizeUtility));
          } else {
            setUtilities([]);
          }
          setHasSharedUtilities(unitLease.hasSharedUtilities ?? unitLease.HasSharedUtilities ?? false);
          setSharedUtilitiesDisclosure(unitLease.sharedUtilitiesDisclosure ?? unitLease.SharedUtilitiesDisclosure ?? '');
          const rawMaint = unitLease.maintenanceResponsibilities ?? unitLease.MaintenanceResponsibilities;
          if (Array.isArray(rawMaint) && rawMaint.length > 0) {
            setMaintenanceItems(rawMaint.map(normalizeMaintenance));
          } else {
            setMaintenanceItems([]);
          }
          const rawMethods = unitLease.maintenanceNotificationMethods ?? unitLease.MaintenanceNotificationMethods;
          if (rawMethods) {
            try {
              const arr = typeof rawMethods === 'string' ? JSON.parse(rawMethods) : rawMethods;
              setMaintenanceNotificationMethods(Array.isArray(arr) ? arr : []);
            } catch {
              setMaintenanceNotificationMethods([]);
            }
          } else {
            setMaintenanceNotificationMethods([]);
          }
          const rawKeys = unitLease.leaseKeys ?? unitLease.LeaseKeys;
          if (Array.isArray(rawKeys) && rawKeys.length > 0) {
            setLeaseKeys(rawKeys.map(normalizeKey));
          } else {
            setLeaseKeys([{ id: null, keyType: 'Property', copies: 1 }]);
          }
        }
      }
      setLoading(false);
    };
    if (properties && properties.length >= 0) loadData();
  }, [leaseId, propertyId, unitId, properties]);

  useEffect(() => {
    if (leaseId && propertyId) propertiesRefetch();
  }, [leaseId, propertyId, propertiesRefetch]);

  const handleBack = () => {
    if (embedded) {
      onSaved?.();
      return;
    }
    navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
  };

  const buildUpdatePayload = (currentLeaseId) => {
    const payload = {
      id: currentLeaseId,
      propertyId: property?.id || propertyId,
      unitId: unit?.id || unitId,
      name: lease?.name || lease?.Name,
      startDate: lease?.startDate || lease?.StartDate,
      endDate: lease?.endDate || lease?.EndDate,
      rentAmount: lease?.rentAmount ?? lease?.RentAmount,
      depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
      leaseLength: lease?.leaseLength ?? lease?.LeaseLength,
      rentFrequency: (lease?.rentFrequency ?? lease?.RentFrequency) || 'Monthly',
      rentDueDay: lease?.rentDueDay ?? lease?.RentDueDay,
      isUtilitiesMaintenanceKeysComplete: true,
      hasSharedUtilities: hasSharedUtilities,
      sharedUtilitiesDisclosure: hasSharedUtilities ? sharedUtilitiesDisclosure : null,
      maintenanceNotificationMethods: maintenanceNotificationMethods.length > 0 ? JSON.stringify(maintenanceNotificationMethods) : null,
      utilityServiceResponsibilities: utilities.map((u) => ({
        id: u.id || 0,
        name: u.name?.trim() || '',
        responsibility: u.responsibility || 'Tenant',
        isRequired: u.isRequired
      })),
      maintenanceResponsibilities: maintenanceItems.map((m) => ({
        id: m.id || 0,
        name: m.name?.trim() || '',
        description: m.description?.trim() || null,
        responsibility: m.responsibility || 'Landlord'
      })),
      leaseKeys: leaseKeys.map((k) => ({
        id: k.id || 0,
        keyType: k.keyType || 'Property',
        copies: Math.max(1, parseInt(k.copies, 10) || 1)
      })),
      isLeaseSpecificsComplete: lease?.isLeaseSpecificsComplete ?? lease?.IsLeaseSpecificsComplete,
      isRentDepositFeesComplete: lease?.isRentDepositFeesComplete ?? lease?.IsRentDepositFeesComplete,
      isPeopleOnLeaseComplete: lease?.isPeopleOnLeaseComplete ?? lease?.IsPeopleOnLeaseComplete,
      isPetsSmokingOtherComplete: lease?.isPetsSmokingOtherComplete ?? lease?.IsPetsSmokingOtherComplete,
      isProvisionsAttachmentsComplete: lease?.isProvisionsAttachmentsComplete ?? lease?.IsProvisionsAttachmentsComplete
    };
    return payload;
  };

  const handleSaveDraft = async () => {
    if (!leaseId || !lease) return;
    const currentLeaseId = lease?.id ?? lease?.Id ?? leaseId;
    try {
      await dispatch(updateLease(buildUpdatePayload(currentLeaseId)));
      await dispatch(updateLeaseAgreement(currentLeaseId, { isUtilitiesMaintenanceKeysComplete: true }));
      await propertiesRefetch();
      openSnackbar({ open: true, message: 'Draft saved successfully', variant: 'alert', alert: { color: 'success' } });
      if (embedded) {
        onSaved?.();
      } else {
        navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
      }
    } catch (e) {
      console.error('Error saving draft:', e);
      openSnackbar({ open: true, message: e?.message || 'Failed to save draft', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleSaveAndNext = async () => {
    if (!leaseId || !lease) return;
    if (hasSharedUtilities && !sharedUtilitiesDisclosure?.trim()) {
      openSnackbar({ open: true, message: 'Please list shared utilities and how they are divided.', variant: 'alert', alert: { color: 'error' } });
      return;
    }
    const currentLeaseId = lease?.id ?? lease?.Id ?? leaseId;
    setSaving(true);
    try {
      const result = await dispatch(updateLease(buildUpdatePayload(currentLeaseId)));
      if (result?.success) await dispatch(updateLeaseAgreement(currentLeaseId, { isUtilitiesMaintenanceKeysComplete: true }));
      if (result?.success) {
        await propertiesRefetch();
        openSnackbar({ open: true, message: 'Saved successfully', variant: 'alert', alert: { color: 'success' } });
        if (embedded) {
          onSaved?.();
        } else {
          navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
        }
      } else {
        openSnackbar({ open: true, message: result?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (e) {
      console.error('Error saving:', e);
      openSnackbar({ open: true, message: e?.response?.data?.message || e?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  const updateUtilityResponsibility = (index, value) => {
    if (value === null) return;
    setUtilities((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], responsibility: value };
      return next;
    });
  };

  const updateUtilityName = (index, value) => {
    setUtilities((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: value };
      return next;
    });
  };

  const addUtility = () => {
    setUtilities((prev) => [...prev, { id: null, name: '', responsibility: 'Tenant', isRequired: false }]);
  };

  const removeUtility = (index) => {
    const u = utilities[index];
    if (u?.isRequired || REQUIRED_UTILITY_NAMES.includes(u?.name)) return;
    setUtilities((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMaintenance = (index, field, value) => {
    setMaintenanceItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addMaintenance = () => {
    setMaintenanceItems((prev) => [...prev, { id: null, name: 'New maintenance item', description: '', responsibility: 'Landlord' }]);
  };

  const removeMaintenance = (index) => {
    setMaintenanceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleNotificationMethod = (id) => {
    setMaintenanceNotificationMethods((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const updateKey = (index, field, value) => {
    setLeaseKeys((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addKey = () => {
    setLeaseKeys((prev) => [...prev, { id: null, keyType: 'Property', copies: 1 }]);
  };

  const removeKey = (index) => {
    if (leaseKeys.length <= 1) return;
    setLeaseKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const isUtilityRequired = (u) => u?.isRequired || REQUIRED_UTILITY_NAMES.includes(u?.name);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={embedded ? { bgcolor: 'transparent' } : { minHeight: '100vh', bgcolor: 'background.default', display: 'flex', justifyContent: 'center' }}>
      <Container maxWidth={embedded ? false : "md"} disableGutters={embedded} sx={{ py: embedded ? 0 : 3 }}>
        {!embedded && <BuildLeaseAgreementHeader onBack={handleBack} onSaveDraft={handleSaveDraft} showTitle={false} />}
        <MainCard>
          <Stack spacing={4}>
            {!embedded && (
              <>
                <Box>
                  <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                    Utilities, Maintenance, & Keys
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Indicate who is responsible for utilities and maintenance, and which keys tenants will receive.
                  </Typography>
                </Box>
                <Divider />
              </>
            )}

            {/* Utilities & Services */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <ThunderboltOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>
                  Utilities & Services
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Indicate who is responsible for the following.
              </Typography>
              {utilities.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No utilities added yet. Add defaults by saving this step after the backend has run the backfill script, or add manually below.
                </Typography>
              ) : null}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                  mb: 2
                }}
              >
                {utilities.map((u, index) => (
                  <Stack
                    key={index}
                    direction="row"
                    alignItems="center"
                    spacing={2}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                    }}
                  >
                    <TextField
                      size="small"
                      placeholder="Utility or service name"
                      value={u.name}
                      onChange={(e) => updateUtilityName(index, e.target.value)}
                      sx={{ minWidth: 0, flex: 1 }}
                      inputProps={{ readOnly: isUtilityRequired(u) }}
                      InputProps={{
                        sx: isUtilityRequired(u)
                          ? {
                              '& .MuiInputBase-input': { color: 'text.primary', WebkitTextFillColor: 'unset' }
                            }
                          : undefined
                      }}
                    />
                    <ToggleButtonGroup
                      value={u.responsibility}
                      exclusive
                      onChange={(_, v) => updateUtilityResponsibility(index, v)}
                      size="small"
                      aria-label="responsibility"
                      sx={{
                        '& .MuiToggleButton-root.Mui-selected': {
                          backgroundColor: 'primary.main',
                          color: 'white',
                          '&:hover': { backgroundColor: 'primary.dark', color: 'white' }
                        }
                      }}
                    >
                      <ToggleButton value="Tenant" aria-label="Tenant">Tenant</ToggleButton>
                      <ToggleButton value="Landlord" aria-label="Landlord">Landlord</ToggleButton>
                    </ToggleButtonGroup>
                    <IconButton
                      size="small"
                      onClick={() => removeUtility(index)}
                      aria-label="Remove utility"
                      disabled={isUtilityRequired(u)}
                      sx={{ color: 'text.secondary', flexShrink: 0 }}
                    >
                      <DeleteOutlined style={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Box>
              <Button startIcon={<PlusOutlined />} onClick={addUtility} variant="outlined" size="small" sx={{ textTransform: 'none' }}>
                Add Utility or Service
              </Button>
            </Box>
            <Divider />

            {/* Shared utilities */}
            <Box>
              <FormControl component="fieldset">
                <FormLabel sx={{ mb: 1 }}>Are there any shared utilities that are separate from rent?</FormLabel>
                <RadioGroup
                  row
                  value={hasSharedUtilities ? 'yes' : 'no'}
                  onChange={(e) => setHasSharedUtilities(e.target.value === 'yes')}
                >
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                </RadioGroup>
              </FormControl>
              {hasSharedUtilities && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Include formula, billing, charges, and shared maintenance.
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={sharedUtilitiesDisclosure}
                    onChange={(e) => setSharedUtilitiesDisclosure(e.target.value.slice(0, 2000))}
                    placeholder={SHARED_UTILITIES_DISCLOSURE_PLACEHOLDER}
                    size="small"
                    required
                    helperText={`${sharedUtilitiesDisclosure.length}/2000`}
                    inputProps={{ maxLength: 2000 }}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) }
                    }}
                  />
                </Box>
              )}
            </Box>
            <Divider />

            {/* Maintenance */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <ToolOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>
                  Maintenance
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Customize maintenance responsibilities. We&apos;ve pre-selected what&apos;s common.
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  mb: 2
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <InfoCircleOutlined style={{ fontSize: 18, color: theme.palette.info.main, marginTop: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    {HABITABILITY_INFO}
                  </Typography>
                </Stack>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                  mb: 2
                }}
              >
                {maintenanceItems.map((m, index) => (
                  <Stack
                    key={index}
                    direction="row"
                    alignItems="center"
                    spacing={2}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                    }}
                  >
                    <TextField
                      size="small"
                      value={m.name}
                      sx={{ minWidth: 0, flex: 1 }}
                      inputProps={{ readOnly: true }}
                      InputProps={{
                        sx: {
                          '& .MuiInputBase-input': { color: 'text.primary', WebkitTextFillColor: 'unset' }
                        }
                      }}
                    />
                    <ToggleButtonGroup
                      value={m.responsibility}
                      exclusive
                      onChange={(_, v) => v != null && updateMaintenance(index, 'responsibility', v)}
                      size="small"
                      aria-label="responsibility"
                      sx={{
                        '& .MuiToggleButton-root.Mui-selected': {
                          backgroundColor: 'primary.main',
                          color: 'white',
                          '&:hover': { backgroundColor: 'primary.dark', color: 'white' }
                        }
                      }}
                    >
                      <ToggleButton value="Tenant" aria-label="Tenant">Tenant</ToggleButton>
                      <ToggleButton value="Landlord" aria-label="Landlord">Landlord</ToggleButton>
                    </ToggleButtonGroup>
                    <IconButton
                      size="small"
                      onClick={() => removeMaintenance(index)}
                      aria-label="Remove maintenance"
                      sx={{ color: 'text.secondary', flexShrink: 0 }}
                    >
                      <DeleteOutlined style={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Box>
              <Button startIcon={<PlusOutlined />} onClick={addMaintenance} variant="outlined" size="small" sx={{ textTransform: 'none', mb: 3 }}>
                Add Maintenance item
              </Button>

              <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                <FormLabel sx={{ mb: 1 }}>
                  How should tenants notify you of maintenance needs to comply with habitability standards and tenant&apos;s rights for repairs?
                </FormLabel>
                <FormGroup sx={{ pl: 4 }}>
                  {MAINTENANCE_NOTIFICATION_OPTIONS.map((opt) => (
                    <FormControlLabel
                      key={opt.id}
                      control={
                        <Checkbox
                          checked={maintenanceNotificationMethods.includes(opt.id)}
                          onChange={() => toggleNotificationMethod(opt.id)}
                        />
                      }
                      label={opt.label}
                    />
                  ))}
                </FormGroup>
              </FormControl>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.grey[500], 0.08),
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                }}
              >
                <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Habitability standards & tenant&apos;s right for repairs
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {HABITABILITY_INFO}
                </Typography>
              </Box>
            </Box>
            <Divider />

            {/* Keys */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <KeyOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>
                  Keys
                </Typography>
              </Stack>
              <FormLabel sx={{ mb: 1 }}>Which keys will your tenant(s) receive?</FormLabel>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {KEYS_RETURN_DISCLAIMER}
              </Typography>
              {leaseKeys.map((k, index) => (
                <Stack
                  key={index}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ sm: 'center' }}
                  spacing={2}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                  }}
                >
                  <FormControl size="small" sx={{ minWidth: { sm: 160 } }}>
                    <InputLabel>Key type</InputLabel>
                    <Select
                      value={k.keyType || 'Property'}
                      label="Key type"
                      onChange={(e) => updateKey(index, 'keyType', e.target.value)}
                    >
                      {KEY_TYPES.map((t) => (
                        <MenuItem key={t.value} value={t.value}>
                          {t.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    type="number"
                    label="Copies"
                    value={k.copies}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      updateKey(index, 'copies', isNaN(v) || v < 1 ? 1 : v);
                    }}
                    inputProps={{ min: 1 }}
                    sx={{ width: { xs: '100%', sm: 100 } }}
                  />
                  {leaseKeys.length > 1 && (
                    <IconButton size="small" onClick={() => removeKey(index)} aria-label="Remove key" sx={{ color: 'text.secondary' }}>
                      <DeleteOutlined style={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                </Stack>
              ))}
              <Button startIcon={<PlusOutlined />} onClick={addKey} variant="outlined" size="small" sx={{ textTransform: 'none', mb: 2 }}>
                ADD ADDITIONAL KEY
              </Button>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {LOST_KEY_INFO}
                </Typography>
              </Box>
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
    </Box>
  );
}
