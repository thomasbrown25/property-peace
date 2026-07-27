import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Stack,
  Chip,
  alpha,
  useTheme
} from '@mui/material';

// project imports
import useFetchProperties from 'hooks/useFetchProperties';
import Autocomplete from 'components/@extended/AutoComplete';

const getValue = (obj, camelKey, pascalKey = camelKey.charAt(0).toUpperCase() + camelKey.slice(1)) => obj?.[camelKey] ?? obj?.[pascalKey];

const getLeaseId = (lease) => getValue(lease, 'id');
const getPropertyId = (property) => getValue(property, 'id');
const getUnitId = (unit) => getValue(unit, 'id');

const isLeaseDeleted = (lease) => {
  const isDeleted = getValue(lease, 'isDeleted');
  return isDeleted === true || isDeleted === 1;
};

const isLeaseDraft = (lease) => {
  const agreement = getValue(lease, 'leaseAgreement');
  return (
    getValue(agreement, 'isDrafted') === true ||
    getValue(lease, 'isDrafted') === true
  );
};

const isLeaseRecordable = (lease) => {
  if (!lease || getValue(lease, 'hasLease') === false || isLeaseDeleted(lease)) return false;

  const isActive = getValue(lease, 'isActive');
  if (!(isActive === true || isActive === 1) || isLeaseDraft(lease)) return false;

  const startDateValue = getValue(lease, 'startDate');
  if (!startDateValue) return false;

  const leaseStart = new Date(startDateValue);
  if (Number.isNaN(leaseStart.getTime())) return false;
  leaseStart.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (leaseStart > today) return false;

  const endDateValue = getValue(lease, 'endDate');
  if (!endDateValue) return true;

  const leaseEnd = new Date(endDateValue);
  if (Number.isNaN(leaseEnd.getTime())) return false;
  leaseEnd.setHours(23, 59, 59, 999);
  return leaseEnd >= today;
};

const getTenantName = (tenant) => {
  if (!tenant) return 'No tenant';
  const first = getValue(tenant, 'firstname') || getValue(tenant, 'firstName') || '';
  const last = getValue(tenant, 'lastname') || getValue(tenant, 'lastName') || '';
  const name = `${first} ${last}`.trim();
  return name || getValue(tenant, 'email') || 'Unnamed tenant';
};

const getLeaseTenants = (lease) => {
  const tenants = getValue(lease, 'tenants') || [];
  return Array.isArray(tenants) ? tenants : [];
};

const isSingleUnitProperty = (property, lease) => {
  const propertyType = getValue(property, 'propertyType') || getValue(lease, 'propertyType') || getValue(lease?.unit?.property, 'propertyType') || '';
  const normalizedType = propertyType.toString().toLowerCase();
  return ['singlefamily', 'singleunit', 'townhouse', 'condominium'].includes(normalizedType);
};

const buildPaymentTarget = ({ lease, property, unit = null }) => {
  const tenants = getLeaseTenants(lease);
  const primaryTenant = tenants[0] || null;
  const tenantName = primaryTenant ? getTenantName(primaryTenant) : 'No tenant';
  const propertyName = getValue(property, 'name') || getValue(lease, 'propertyName') || getValue(lease?.unit?.property, 'name') || 'Unknown property';
  const unitName = unit
    ? (getValue(unit, 'name') || getValue(unit, 'unitNumber') || getValue(unit, 'number'))
    : (getValue(lease, 'unitName') || getValue(lease?.unit, 'name') || 'No unit');
  const leaseId = getLeaseId(lease);
  const propertyId = getPropertyId(property) ?? getValue(lease, 'propertyId') ?? getValue(lease?.unit, 'propertyId');
  const unitId = unit ? getUnitId(unit) : (getValue(lease, 'unitId') ?? getValue(lease?.unit, 'id'));
  const showUnitName = Boolean(unitName && unitName !== 'No unit' && !isSingleUnitProperty(property, lease));
  const locationLabel = showUnitName ? `${propertyName} - ${unitName}` : propertyName;
  const isRecordable = isLeaseRecordable(lease);

  return {
    id: `${leaseId || 'lease'}-${propertyId || 'property'}-${unitId || 'property-level'}`,
    leaseId,
    lease: {
      ...lease,
      id: leaseId,
      propertyId,
      propertyName,
      unitId,
      unitName,
      tenants
    },
    tenant: primaryTenant,
    tenantName,
    property,
    propertyId,
    propertyName,
    unit,
    unitId,
    unitName,
    locationLabel,
    isRecordable,
    label: primaryTenant ? `${tenantName} - ${locationLabel}` : locationLabel
  };
};

// ==============================|| PAYMENT TARGET SELECTOR ||============================== //

export default function TenantPaymentSelector({
  selectedLease,
  selectedProperty,
  selectedUnit,
  onSelectTenant,
  onSelectProperty,
  onSelectUnit,
  onConfirmLease
}) {
  const theme = useTheme();
  const { properties, loading: loadingProperties, isLoading } = useFetchProperties();

  const paymentTargets = useMemo(() => {
    if (!Array.isArray(properties)) return [];

    const targets = [];

    properties.forEach((property) => {
      const propertyLeases = [getValue(property, 'lease'), ...(getValue(property, 'leases') || [])].filter(Boolean);
      propertyLeases.forEach((lease) => {
        if (!isLeaseDeleted(lease)) {
          targets.push(buildPaymentTarget({ lease, property }));
        }
      });

      const units = getValue(property, 'units') || [];
      units.forEach((unit) => {
        const unitLeases = [getValue(unit, 'lease'), ...(getValue(unit, 'leases') || [])].filter(Boolean);
        unitLeases.forEach((lease) => {
          if (!isLeaseDeleted(lease)) {
            targets.push(buildPaymentTarget({ lease, property, unit }));
          }
        });
      });
    });

    const seen = new Set();
    return targets.filter((target) => {
      const key = `${target.leaseId || target.id}-${target.propertyId || ''}-${target.unitId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [properties]);

  const selectedOption = useMemo(() => {
    if (!selectedLease) return null;
    const selectedLeaseId = getLeaseId(selectedLease);
    const selectedUnitId = getValue(selectedLease, 'unitId') ?? getValue(selectedLease?.unit, 'id');
    const matchedTarget = paymentTargets.find((target) => (
      target.leaseId === selectedLeaseId && (!selectedUnitId || target.unitId === selectedUnitId)
    ));

    if (matchedTarget) return matchedTarget;

    const fallbackProperty = selectedProperty || {
      id: getValue(selectedLease, 'propertyId') ?? getValue(selectedLease?.unit, 'propertyId'),
      name: getValue(selectedLease, 'propertyName')
    };

    return buildPaymentTarget({
      lease: selectedLease,
      property: fallbackProperty,
      unit: selectedUnit || selectedLease?.unit || null
    });
  }, [selectedLease, selectedProperty, selectedUnit, paymentTargets]);

  const displayTargets = useMemo(() => {
    if (!selectedOption || paymentTargets.some((target) => target.id === selectedOption.id)) return paymentTargets;
    return [selectedOption, ...paymentTargets];
  }, [selectedOption, paymentTargets]);

  const handleTargetChange = (newValue) => {
    if (!newValue || !newValue.isRecordable) {
      onSelectTenant(null);
      onSelectProperty(null);
      onSelectUnit(null);
      onConfirmLease(null);
      return;
    }

    onSelectTenant(newValue.tenant || null);
    onSelectProperty(newValue.property || null);
    onSelectUnit(newValue.unit || null);
    onConfirmLease(newValue.lease || null);
  };

  useEffect(() => {
    if (!selectedOption || paymentTargets.length === 0) return;
    const matchedTarget = paymentTargets.find((target) => target.id === selectedOption.id);
    if (!matchedTarget || !matchedTarget.isRecordable) return;
    onSelectTenant(matchedTarget.tenant || null);
    onSelectProperty(matchedTarget.property || null);
    onSelectUnit(matchedTarget.unit || null);
    onConfirmLease(matchedTarget.lease || null);
  }, [selectedOption?.id, paymentTargets, onSelectTenant, onSelectProperty, onSelectUnit, onConfirmLease]);

  if (loadingProperties || isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1.5 }}>
        Who paid?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select an active lease record. Leases that have not started yet are shown but cannot be selected for payment.
      </Typography>

      <Stack spacing={0.75}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          Lease *
        </Typography>
        <Autocomplete
          options={displayTargets}
          value={selectedOption}
          onChange={(event, newValue) => handleTargetChange(newValue)}
          getOptionLabel={(option) => option?.label || ''}
          isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
          getOptionDisabled={(option) => !option?.isRecordable}
          filterOptions={(options, state) => {
            const input = state.inputValue.trim().toLowerCase();
            if (!input) return options;
            return options.filter((option) => option.label.toLowerCase().includes(input));
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Stack spacing={0.25} sx={{ width: '100%' }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={600}>
                    {option.locationLabel}
                  </Typography>
                  <Chip
                    size="small"
                    label={option.isRecordable ? 'Active lease' : 'No active lease'}
                    color={option.isRecordable ? 'success' : 'default'}
                    variant={option.isRecordable ? 'filled' : 'outlined'}
                  />
                </Stack>
                {option.tenant && (
                  <Typography variant="caption" color="text.secondary">
                    {option.tenantName}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search tenant, property, or unit"
              fullWidth
            />
          )}
          noOptionsText="No lease records found. Create a lease before recording a payment."
          sx={{
            '& .MuiOutlinedInput-root': {
              minHeight: 34,
              borderRadius: 1,
              bgcolor: 'background.paper',
              py: 0.25,
              '& fieldset': { borderColor: alpha(theme.palette.grey[500], 0.24) },
              '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.45) },
              '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: 1 }
            },
            '& .MuiInputBase-input': {
              fontSize: '0.875rem'
            }
          }}
        />
      </Stack>

      {displayTargets.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          No lease records were found. Create a lease before recording a payment.
        </Alert>
      )}
    </Box>
  );
}

TenantPaymentSelector.propTypes = {
  selectedLease: PropTypes.object,
  selectedProperty: PropTypes.object,
  selectedUnit: PropTypes.object,
  onSelectTenant: PropTypes.func.isRequired,
  onSelectProperty: PropTypes.func.isRequired,
  onSelectUnit: PropTypes.func.isRequired,
  onConfirmLease: PropTypes.func.isRequired
};
