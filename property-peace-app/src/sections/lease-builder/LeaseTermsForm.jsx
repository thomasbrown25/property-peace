import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Alert,
  FormControlLabel,
  Checkbox,
  Stack
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// project imports
import FormInput from 'components/input/FormInput';
import FormNumberInput from 'components/input/FormNumberInput';
import FormSelect from 'components/input/FormSelect';

// ==============================|| LEASE TERMS FORM ||============================== //

// Date helper functions (same as LeaseAddDrawer)
function firstOfNextMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  // next month 1st
  const next = new Date(y, m + 1, 1);
  return next;
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  // keep day where possible; for 1st it's safe
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

export default function LeaseTermsForm({ leaseTerms, onChange, property, unit }) {
  // Calculate default dates (first of next month, 12 months later)
  const getDefaultDates = () => {
    const start = firstOfNextMonth();
    const defaultLeaseLen = 12;
    const end = addMonths(start, defaultLeaseLen);
    return {
      startDate: start,
      endDate: end
    };
  };

  const defaultsSetRef = useRef(false);
  const [localTerms, setLocalTerms] = useState(() => {
    // Initialize with defaults if dates are missing
    const defaults = getDefaultDates();
    const hasDates = leaseTerms?.startDate && leaseTerms?.endDate;
    if (!hasDates) {
      defaultsSetRef.current = true;
    }
    return {
      startDate: leaseTerms?.startDate || defaults.startDate,
      endDate: leaseTerms?.endDate || defaults.endDate,
      monthlyRent: leaseTerms?.monthlyRent ?? null,
      securityDeposit: leaseTerms?.securityDeposit ?? null,
      rentDueDay: leaseTerms?.rentDueDay ?? 1,
      markPastPaymentsAsPaid: leaseTerms?.markPastPaymentsAsPaid ?? false,
      rentIncreaseType: leaseTerms?.rentIncreaseType ?? '', // 'percentage' or 'amount'
      rentIncreaseValue: leaseTerms?.rentIncreaseValue ?? null,
      rentIncreaseInterval: leaseTerms?.rentIncreaseInterval ?? null // months
    };
  });

  // Set defaults on mount if not provided
  useEffect(() => {
    if (!leaseTerms?.startDate || !leaseTerms?.endDate) {
      if (!defaultsSetRef.current) {
        const defaults = getDefaultDates();
        const updated = {
          startDate: defaults.startDate,
          endDate: defaults.endDate,
          monthlyRent: leaseTerms?.monthlyRent ?? null,
          securityDeposit: leaseTerms?.securityDeposit ?? null,
          rentDueDay: leaseTerms?.rentDueDay ?? 1,
          markPastPaymentsAsPaid: leaseTerms?.markPastPaymentsAsPaid ?? false,
          rentIncreaseType: leaseTerms?.rentIncreaseType ?? '',
          rentIncreaseValue: leaseTerms?.rentIncreaseValue ?? null,
          rentIncreaseInterval: leaseTerms?.rentIncreaseInterval ?? null
        };
        setLocalTerms(updated);
        onChange(updated);
        defaultsSetRef.current = true;
      }
    } else {
      // Update with provided leaseTerms
      setLocalTerms(leaseTerms);
    }
  }, []); // Only run on mount

  // Update when leaseTerms changes (user edits from parent)
  useEffect(() => {
    if (leaseTerms && (leaseTerms.startDate || leaseTerms.endDate)) {
      // Ensure rentDueDay is always between 1 and 31, default to 1 if null/invalid
      const rentDueDay = leaseTerms.rentDueDay;
      let validRentDueDay = 1;
      if (rentDueDay != null && !isNaN(rentDueDay)) {
        validRentDueDay = Math.max(1, Math.min(31, Number(rentDueDay)));
      }
      
      setLocalTerms(prev => ({
        ...prev,
        ...leaseTerms,
        rentDueDay: validRentDueDay
      }));
    }
  }, [leaseTerms?.startDate, leaseTerms?.endDate, leaseTerms?.monthlyRent, leaseTerms?.securityDeposit, leaseTerms?.rentDueDay, leaseTerms?.markPastPaymentsAsPaid, leaseTerms?.rentIncreaseType, leaseTerms?.rentIncreaseValue, leaseTerms?.rentIncreaseInterval]);

  const handleChange = (field, value) => {
    // Special handling for rentDueDay to ensure it's always valid
    if (field === 'rentDueDay') {
      // Ensure value is never null and is between 1 and 31
      if (value == null || isNaN(value)) {
        value = 1;
      } else {
        value = Math.max(1, Math.min(31, Number(value)));
      }
    }
    const updated = { ...localTerms, [field]: value };
    setLocalTerms(updated);
    onChange(updated);
  };

  // Calculate default end date (1 year from start)
  const handleStartDateChange = (date) => {
    if (!date || isNaN(new Date(date).getTime())) {
      handleChange('startDate', null);
      return;
    }
    handleChange('startDate', date);
    if (date && !localTerms.endDate) {
      const endDate = new Date(date);
      if (!isNaN(endDate.getTime())) {
        endDate.setFullYear(endDate.getFullYear() + 1);
        handleChange('endDate', endDate);
      }
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Lease Terms
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the lease terms. Required fields are marked with *.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Lease Start Date *"
              value={localTerms.startDate}
              onChange={handleStartDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true
                }
              }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Lease End Date *"
              value={localTerms.endDate}
              onChange={(date) => handleChange('endDate', date)}
              minDate={localTerms.startDate || undefined}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true
                }
              }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormInput
            name="monthlyRent"
            label="Monthly Rent *"
            value={localTerms.monthlyRent ?? ''}
            valueType="currency"
            setFieldValue={(name, value) => {
              handleChange('monthlyRent', value);
            }}
            fullWidth
            required
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormInput
            name="securityDeposit"
            label="Security Deposit"
            value={localTerms.securityDeposit ?? ''}
            valueType="currency"
            setFieldValue={(name, value) => {
              handleChange('securityDeposit', value);
            }}
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormNumberInput
            name="rentDueDay"
            label="Rent Due Day *"
            value={localTerms.rentDueDay ?? 1}
            onChange={(e) => {
              const val = e.target.value;
              // If empty, default to 1
              if (val === '') {
                handleChange('rentDueDay', 1);
                return;
              }
              // Parse and clamp to valid range
              const parsed = parseInt(val, 10);
              if (isNaN(parsed)) {
                handleChange('rentDueDay', 1);
                return;
              }
              // Force value to be between 1 and 31
              const clamped = Math.max(1, Math.min(31, parsed));
              handleChange('rentDueDay', clamped);
            }}
            onBlur={(e) => {
              // Ensure value is clamped when field loses focus
              const currentValue = localTerms.rentDueDay ?? 1;
              const clamped = Math.max(1, Math.min(31, Number(currentValue)));
              if (clamped !== currentValue) {
                handleChange('rentDueDay', clamped);
              }
            }}
            min={1}
            max={31}
            fullWidth
            required
            helperText="Day of the month when rent is due (1-31)"
          />
        </Grid>

        {/* Mark Past Payments as Paid - only show if start date is in the past */}
        {localTerms.startDate && new Date(localTerms.startDate) < new Date() && (
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localTerms.markPastPaymentsAsPaid || false}
                  onChange={(e) => handleChange('markPastPaymentsAsPaid', e.target.checked)}
                />
              }
              label={
                <>
                  <Typography variant="body2" fontWeight={500}>
                    Mark all past payments as paid
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4.5 }}>
                    Automatically create payment records for all rent periods from the lease start date to today
                  </Typography>
                </>
              }
            />
          </Grid>
        )}

        {/* Automatic Rent Increase Section */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Would you like to add an automatic rent increase?
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormSelect
                name="rentIncreaseType"
                label="Increase Type"
                value={localTerms.rentIncreaseType || ''}
                valueType="string"
                onChange={(e) => {
                  const value = e.target.value;
                  handleChange('rentIncreaseType', value);
                  // Clear value and interval when type is cleared
                  if (!value) {
                    handleChange('rentIncreaseValue', null);
                    handleChange('rentIncreaseInterval', null);
                  }
                }}
                options={[
                  { value: '', label: 'None' },
                  { value: 'percentage', label: 'Percentage Increase' },
                  { value: 'amount', label: 'Fixed Dollar Amount' }
                ]}
                placeholder="Select increase type"
                fullWidth
              />
            </Grid>

            {/* Show value input only when type is selected */}
            {localTerms.rentIncreaseType && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  {localTerms.rentIncreaseType === 'percentage' ? (
                    <FormNumberInput
                      name="rentIncreaseValue"
                      label="Increase Percentage"
                      value={localTerms.rentIncreaseValue ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const numVal = val === '' ? null : (isNaN(parseFloat(val)) ? null : parseFloat(val));
                        handleChange('rentIncreaseValue', numVal);
                      }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      fullWidth
                      min={0}
                      max={100}
                      step={0.1}
                    />
                  ) : (
                    <FormInput
                      name="rentIncreaseValue"
                      label="Increase Amount"
                      value={localTerms.rentIncreaseValue ?? ''}
                      valueType="currency"
                      setFieldValue={(name, value) => {
                        handleChange('rentIncreaseValue', value);
                      }}
                      fullWidth
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormSelect
                    name="rentIncreaseInterval"
                    label="Increase Frequency"
                    value={localTerms.rentIncreaseInterval || ''}
                    onChange={(e) => handleChange('rentIncreaseInterval', e.target.value ? Number(e.target.value) : null)}
                    options={[
                      { value: '', label: 'Select frequency' },
                      { value: 1, label: 'Monthly' },
                      { value: 2, label: 'Every 2 months' },
                      { value: 3, label: 'Quarterly (every 3 months)' },
                      { value: 4, label: 'Every 4 months' },
                      { value: 6, label: 'Semi-annually (every 6 months)' },
                      { value: 12, label: 'Annually (every 12 months)' }
                    ]}
                    placeholder="Select frequency"
                    fullWidth
                  />
                </Grid>
              </>
            )}
          </Grid>
        </Grid>

        {localTerms.startDate && localTerms.endDate && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Lease Duration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(() => {
                    const start = new Date(localTerms.startDate);
                    const end = new Date(localTerms.endDate);
                    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid dates';
                    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                    const months = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 365.25) * 12);
                    return `${days} days (${months} months)`;
                  })()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {localTerms.startDate && localTerms.endDate && (() => {
          const start = new Date(localTerms.startDate);
          const end = new Date(localTerms.endDate);
          return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start;
        })() && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="warning">
              End date must be after start date.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

LeaseTermsForm.propTypes = {
  leaseTerms: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  property: PropTypes.object,
  unit: PropTypes.object
};
