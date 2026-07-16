import React, { useEffect } from 'react';
import { Grid, FormControlLabel, Checkbox, Typography } from '@mui/material';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { leaseLengthOptions, rentDueDayOptions, rentFrequencyOptions } from 'utils/models';

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toInputDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function firstOfNextMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return new Date(y, m + 1, 1);
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

// ---------- initial defaults builder ----------
export const buildInitialValues = (selectedProperty = null) => {
  const start = firstOfNextMonth();
  const defaultLeaseLen = 12;
  const end = addMonths(start, defaultLeaseLen);

  return {
    propertyId: selectedProperty?.id || '',
    unitId: '',
    leaseStartDate: toInputDate(start),
    leaseEndDate: toInputDate(end),
    rentFrequency: 'monthly',
    rentDueDay: 1,
    leaseLength: defaultLeaseLen, // 0 = Custom
    rentAmount: 0,
    markPastPaymentsAsPaid: false
  };
};

// ---------- LeaseFields component ----------
export function LeaseFields({ values, errors, touched, setFieldValue }) {
  // Auto-fill defaults if fields are blank (e.g., toggled on later)
  useEffect(() => {
    if (!values.leaseStartDate) {
      const start = firstOfNextMonth();
      setFieldValue('leaseStartDate', toInputDate(start), false);
    }
    if (!values.leaseEndDate) {
      const end = addMonths(firstOfNextMonth(), 12);
      setFieldValue('leaseEndDate', toInputDate(end), false);
    }
    if (!values.rentFrequency) setFieldValue('rentFrequency', 'monthly', false);
    if (!values.rentDueDay) setFieldValue('rentDueDay', 1, false);
    if (!values.leaseLength) setFieldValue('leaseLength', 12, false);
  }, [values.showLease]);

  // Auto-update end date when start or length changes (unless custom)
  useEffect(() => {
    const len = Number(values.leaseLength || 0);
    if (!values.leaseStartDate || len === 0) return;
    const end = toInputDate(addMonths(new Date(values.leaseStartDate), len));
    if (end !== values.leaseEndDate) setFieldValue('leaseEndDate', end, false);
  }, [values.leaseStartDate, values.leaseLength]);

  return (
    <>
      <Grid size={{ xs: 12, md: 6 }}>
        <FormInput
          name="leaseStartDate"
          label="Lease Start Date"
          type="date"
          value={values.leaseStartDate}
          setFieldValue={setFieldValue}
          touched={touched.leaseStartDate}
          errorText={errors.leaseStartDate}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormInput
          name="leaseEndDate"
          label="Lease End Date"
          type="date"
          value={values.leaseEndDate}
          setFieldValue={setFieldValue}
          touched={touched.leaseEndDate}
          errorText={errors.leaseEndDate}
          onChange={(e) => {
            const val = e?.target?.value || e;
            setFieldValue('leaseEndDate', val);
            // user manually changed → mark as Custom
            if (Number(values.leaseLength) !== 0) setFieldValue('leaseLength', 0);
          }}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormInput
          name="rentAmount"
          label="Rent Amount"
          type="text"
          valueType="currency"
          placeholder="e.g. 1500"
          value={values.rentAmount}
          setFieldValue={setFieldValue}
          touched={touched.rentAmount}
          errorText={errors.rentAmount}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormSelect
          name="rentFrequency"
          label="Rent Frequency"
          valueType="string"
          options={rentFrequencyOptions}
          value={values.rentFrequency}
          setFieldValue={setFieldValue}
          touched={touched.rentFrequency}
          errorText={errors.rentFrequency}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormSelect
          name="rentDueDay"
          label="Rent Due Day"
          options={rentDueDayOptions}
          value={values.rentDueDay}
          setFieldValue={setFieldValue}
          touched={touched.rentDueDay}
          errorText={errors.rentDueDay}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormSelect
          name="leaseLength"
          label="Lease Length"
          options={leaseLengthOptions}
          value={values.leaseLength}
          setFieldValue={(n, v) => {
            const len = Number(v);
            setFieldValue('leaseLength', len);
            if (len > 0 && values.leaseStartDate) {
              const nextEnd = toInputDate(addMonths(new Date(values.leaseStartDate), len));
              setFieldValue('leaseEndDate', nextEnd);
            }
          }}
          touched={touched.leaseLength}
          errorText={errors.leaseLength}
        />
      </Grid>

      {/* Mark Past Payments as Paid - only show if start date is in the past */}
      {values.leaseStartDate && new Date(values.leaseStartDate) < new Date() && (
        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={values.markPastPaymentsAsPaid || false}
                onChange={(e) => setFieldValue('markPastPaymentsAsPaid', e.target.checked)}
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
    </>
  );
}
