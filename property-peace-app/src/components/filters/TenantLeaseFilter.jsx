import { useId } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DownOutlined from '@ant-design/icons/DownOutlined';
import { filterControlSx, leaseSelectorLabelSx } from '../../themes/filterControlStyles.js';
import { isDetachedSingleUnitType } from '../../utils/propertyType.js';

const getLeaseId = (lease) => lease.id ?? lease.Id;

function getLeaseLabel(lease) {
  const unit = lease.unit ?? lease.Unit;
  const property = unit?.property ?? unit?.Property;
  const propertyName = property?.name || property?.Name || lease.propertyName || lease.PropertyName || 'Property';
  const propertyType = property?.propertyType ?? property?.PropertyType ?? lease.propertyType ?? lease.PropertyType;
  const unitName = unit?.name || unit?.Name || lease.unitName || lease.UnitName;
  const normalizedUnitName = String(unitName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const showUnit = unitName && !isDetachedSingleUnitType(propertyType) && normalizedUnitName !== 'unit1';
  const label = showUnit ? `${propertyName} · ${unitName}` : propertyName;

  return (lease.isActive ?? lease.IsActive) === false ? `${label} (Inactive)` : label;
}

export default function TenantLeaseFilter({ leases, selectedLeaseId, onChange, labelAbove = false, labelInline = false, sx }) {
  const id = useId();
  const widthSx = { width: { xs: '100%', sm: 240 }, ...sx };
  const prefix = labelInline ? 'Lease: ' : '';

  const handleChange = (event) => {
    const lease = leases.find((option) => String(getLeaseId(option)) === event.target.value);
    if (lease) onChange(getLeaseId(lease));
  };

  const select = (
    <TextField
      id={id}
      select
      size="small"
      label={labelAbove || labelInline ? undefined : 'Lease'}
      value={selectedLeaseId ?? ''}
      disabled={!leases.length}
      onChange={handleChange}
      slotProps={{
        select: {
          native: true,
          ...(labelInline && { IconComponent: DownOutlined, inputProps: { 'aria-label': 'Lease' } })
        },
        inputLabel: { shrink: true },
        input: { sx: filterControlSx }
      }}
      fullWidth={labelAbove}
      sx={labelAbove ? undefined : widthSx}
    >
      <option value="" disabled>{labelInline ? 'Lease: None selected' : 'Select a lease'}</option>
      {leases.map((lease) => (
        <option key={getLeaseId(lease)} value={getLeaseId(lease)}>{prefix + getLeaseLabel(lease)}</option>
      ))}
    </TextField>
  );

  if (!labelAbove) return select;

  return (
    <Stack spacing={0.5} sx={widthSx}>
      <Typography component="label" htmlFor={id} variant="caption" sx={leaseSelectorLabelSx}>
        Select Lease
      </Typography>
      {select}
    </Stack>
  );
}

TenantLeaseFilter.propTypes = {
  leases: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedLeaseId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  labelAbove: PropTypes.bool,
  labelInline: PropTypes.bool,
  sx: PropTypes.object
};
