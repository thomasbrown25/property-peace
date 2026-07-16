import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';

// material-ui
import { Box, Button, Drawer, Divider, Grid, IconButton, Stack, Toolbar, Typography, FormControlLabel, Switch } from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';

// app
import { useDrawer } from 'contexts/DrawerContext';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { openSnackbar } from 'api/snackbar';

// hooks
import useAuth from 'hooks/useAuth';
import useIsSingleUnitProfile from 'hooks/useIsSingleUnitProfile';

// selectors
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { selectLease } from 'store/lease/lease.selector';

// options
import { leaseLengthOptions, rentDueDayOptions, rentFrequencyOptions } from 'utils/models';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';
import { useDispatch, useSelector } from 'react-redux';
import { addOrUpdateLease } from 'store/lease/lease.action';

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toInputDate = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() !== day) d.setDate(0);
  return d;
}
const getTermMonths = (leaseLength) => (Number(leaseLength) === -1 ? 1 : Number(leaseLength || 0));

// ---------- validation ----------
const LeaseSchema = Yup.object().shape({
  name: Yup.string().nullable(),
  leaseStartDate: Yup.string().required('Lease start date is required'),
  leaseEndDate: Yup.string().required('Lease end date is required'),
  rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required(),
  rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required'),
  leaseLength: Yup.number().min(-1).required('Lease length is required'),
  rentAmount: Yup.number().typeError('Enter a valid amount').min(0).required('Rent amount is required'),
  autoRenewLeaseLength: Yup.number().when('autoRenewLease', {
    is: true,
    then: (schema) => schema.required('Renewal term is required'),
    otherwise: (schema) => schema.nullable()
  })
});

export default function LeaseEditDrawer({ unitsByProperty = {}, onUpdateSuccess }) {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const { isSingleUnitProfile } = useIsSingleUnitProfile();

  const properties = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);
  const lease = useSelector(selectLease);

  const [loading, setLoading] = useState(true);
  useEffect(() => setLoading(false), []);

  const propertyOptions = useMemo(
    () =>
      (properties || []).map((p) => ({
        value: Number(p.value ?? p.id),
        label: p.label ?? p.name ?? String(p.id)
      })),
    [properties]
  );

  // ----- build initial values from existing lease -----
  const initialValues = useMemo(() => {
    if (!lease) return {};
    return {
      name: lease.name ?? '',
      propertyId: lease.propertyId || selectedProperty?.id || '',
      unitId: lease.unitId || '',
      leaseStartDate: toInputDate(new Date(lease.startDate)),
      leaseEndDate: toInputDate(new Date(lease.endDate)),
      allPaymentsOnTime: false,
      rentFrequency: lease.rentFrequency?.toLowerCase() ?? 'monthly',
      rentDueDay: lease.rentDueDay ?? 1,
      leaseLength: lease.leaseLength ?? 12,
      rentAmount: lease.rentAmount ?? '',
      autoRenewLease: Boolean(lease.autoRenewLease ?? lease.AutoRenewLease),
      autoRenewLeaseLength: lease.autoRenewLeaseLength ?? lease.AutoRenewLeaseLength ?? lease.leaseLength ?? 12,
      autoRenewRentIncrement: Boolean(lease.autoRenewRentIncrement ?? lease.AutoRenewRentIncrement),
      autoRenewRentIncrementType: lease.autoRenewRentIncrementType ?? lease.AutoRenewRentIncrementType ?? 'percentage',
      autoRenewRentIncrementValue: lease.autoRenewRentIncrementValue ?? lease.AutoRenewRentIncrementValue ?? ''
    };
  }, [lease, selectedProperty]);

  const formik = useFormik({
    initialValues,
    validationSchema: LeaseSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const property = properties.find((p) => Number(p.id) === Number(values.propertyId));
        const propertyType = property?.propertyType?.toLowerCase();
        const isPropertySingleFamily = propertyType === 'singlefamily' || propertyType === 'single-family';

        const organizationId = lease?.organizationId ?? lease?.OrganizationId ?? property?.organizationId;
        const payload = {
          Id: lease.id,
          Name: values.name?.trim() || null,
          PropertyId: Number(lease.propertyId),
          UnitId: isPropertySingleFamily ? property?.units?.[0]?.id || 0 : Number(lease.unitId || 0),
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          RentAmount: Number(values.rentAmount),
          LeaseLength: Number(values.leaseLength),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay),
          AutoRenewLease: Boolean(values.autoRenewLease),
          AutoRenewLeaseLength: values.autoRenewLease ? Number(values.autoRenewLeaseLength || values.leaseLength || 12) : null,
          AutoRenewRentIncrement: values.autoRenewLease ? Boolean(values.autoRenewRentIncrement) : false,
          AutoRenewRentIncrementType: values.autoRenewLease && values.autoRenewRentIncrement ? values.autoRenewRentIncrementType : null,
          AutoRenewRentIncrementValue: values.autoRenewLease && values.autoRenewRentIncrement ? Number(values.autoRenewRentIncrementValue || 0) : null,
          MarkPastPaymentsAsPaid: Boolean(values.allPaymentsOnTime),
          ...(organizationId != null && { organizationId: Number(organizationId) })
        };

        await dispatch(addOrUpdateLease(payload));
        await mutate(dashboardEndpoints.summary(user.id));

        openSnackbar({
          open: true,
          message: 'Lease updated successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        drawer.closeLeaseEditDrawer();

        // Trigger refresh callback if provided
        if (onUpdateSuccess) {
          onUpdateSuccess();
        }
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update lease.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue } = formik;

  // Auto-recalculate end date when start date or lease length changes
  useEffect(() => {
    const len = Number(values.leaseLength);
    if (len === 0 || !values.leaseStartDate) return;
    const start = new Date(values.leaseStartDate);
    if (Number.isNaN(start.getTime())) return;
    const formatted = toInputDate(addMonths(start, getTermMonths(len)));
    if (formatted !== values.leaseEndDate) setFieldValue('leaseEndDate', formatted, false);
  }, [values.leaseStartDate, values.leaseLength]);

  // Unit options from selected property (similar to LeaseAddDrawer)
  // Use selectedProperty from Redux if available, otherwise find from properties array
  const currentProperty = useMemo(() => {
    if (selectedProperty?.id === Number(values.propertyId)) return selectedProperty;
    return properties?.find((p) => Number(p.id) === Number(values.propertyId));
  }, [selectedProperty, values.propertyId, properties]);

  // Check if current property is single family
  const isSingleFamilyProperty = useMemo(() => {
    if (!currentProperty) return false;
    const propertyType = currentProperty.propertyType?.toLowerCase();
    return propertyType === 'singlefamily' || propertyType === 'single-family';
  }, [currentProperty]);

  const unitOptions = useMemo(() => {
    if (!currentProperty?.units || currentProperty.units.length === 0) return [];
    return currentProperty.units.map((u) => ({
      label: u.name || `Unit ${u.id}`,
      id: u.id
    }));
  }, [currentProperty]);

  // Selected unit value for display
  const selectedUnit = useMemo(() => {
    if (!lease?.unitId) return null;
    return unitOptions.find((u) => String(u.id) === String(lease.unitId)) || null;
  }, [lease?.unitId, unitOptions]);

  if (loading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" justifyContent="center">
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenLeaseEdit}
      onClose={drawer.closeLeaseEditDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520, md: 560 },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
            {/* Header */}
            <Toolbar sx={{ px: 2.5, flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', mb: 1 }}>
                <Typography variant="h6">
                  Edit Lease
                </Typography>
                <IconButton onClick={drawer.closeLeaseEditDrawer} size="large">
                  <CloseOutlined />
                </IconButton>
              </Stack>
              {lease && (
                <Typography variant="body1" fontWeight={600} color="text.primary" sx={{ width: '100%' }}>
                  {currentProperty?.name || 'Property'}
                  {!isSingleFamilyProperty && selectedUnit && ` - ${selectedUnit.label}`}
                </Typography>
              )}
            </Toolbar>
            <Divider />

            {/* Body */}
            <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      Lease Name (Optional)
                    </Typography>
                    <FormInput
                      name="name"
                      label=""
                      placeholder="e.g. 1317 Shannonhouse - Roberts"
                      value={values.name}
                      setFieldValue={setFieldValue}
                      touched={Boolean(touched.name)}
                      errorText={errors.name}
                      helperText="Leave blank to keep existing name"
                    />
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormInput
                    name="leaseStartDate"
                    label="Lease Start Date"
                    type="date"
                    value={values.leaseStartDate}
                    setFieldValue={setFieldValue}
                    touched={Boolean(touched.leaseStartDate)}
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
                    touched={Boolean(touched.leaseEndDate)}
                    errorText={errors.leaseEndDate}
                    onChange={(e) => {
                      const val = e?.target?.value || e;
                      setFieldValue('leaseEndDate', val);
                      if (Number(values.leaseLength) !== 0) setFieldValue('leaseLength', 0);
                    }}
                  />
                </Grid>

                {values.leaseStartDate && new Date(values.leaseStartDate) < new Date(new Date().toDateString()) && (
                  <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(values.allPaymentsOnTime)}
                          onChange={(e) => setFieldValue('allPaymentsOnTime', e.target.checked)}
                        />
                      }
                      label={
                        <Stack spacing={0}>
                          <Typography variant="body2" fontWeight={600}>All previous payments made on time</Typography>
                          <Typography variant="caption" color="text.secondary">Mark past-due payments as paid through today</Typography>
                        </Stack>
                      }
                    />
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <FormInput
                    name="rentAmount"
                    label="Rent Amount"
                    type="number"
                    placeholder="e.g. 1500"
                    value={values.rentAmount}
                    setFieldValue={setFieldValue}
                    touched={Boolean(touched.rentAmount)}
                    errorText={errors.rentAmount}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormSelect
                    name="leaseLength"
                    label="Lease Length"
                    options={leaseLengthOptions}
                    value={values.leaseLength}
                    setFieldValue={(n, v) => {
                      const len = Number(v);
                      setFieldValue('leaseLength', len);
                      if (!values.autoRenewLeaseLength || Number(values.autoRenewLeaseLength) === Number(values.leaseLength)) {
                        setFieldValue('autoRenewLeaseLength', len);
                      }
                    }}
                    touched={touched.leaseLength}
                    errorText={errors.leaseLength}
                    placeholder="Select lease length"
                    valueType="number"
                    displayEmpty
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormSelect
                    name="rentFrequency"
                    label="Rent Frequency"
                    options={rentFrequencyOptions}
                    value={values.rentFrequency}
                    setFieldValue={setFieldValue}
                    touched={touched.rentFrequency}
                    errorText={errors.rentFrequency}
                    placeholder="Select frequency"
                    valueType="string"
                    displayEmpty
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormSelect
                    name="rentDueDay"
                    label="Rent Due Day"
                    options={rentDueDayOptions}
                    value={values.rentDueDay}
                    setFieldValue={setFieldValue}
                    touched={touched.rentDueDay}
                    errorText={errors.rentDueDay}
                    placeholder="Select due day"
                    valueType="number"
                    displayEmpty
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2, bgcolor: 'background.paper' }}>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(values.autoRenewLease)}
                            onChange={(event) => {
                              setFieldValue('autoRenewLease', event.target.checked);
                              if (event.target.checked) setFieldValue('autoRenewLeaseLength', values.autoRenewLeaseLength || values.leaseLength || 12);
                            }}
                          />
                        }
                        label={<Typography variant="body2" fontWeight={600}>Auto-renew lease</Typography>}
                      />
                      {values.autoRenewLease && (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <FormSelect
                              name="autoRenewLeaseLength"
                              label="Renewal Term"
                              options={leaseLengthOptions}
                              value={values.autoRenewLeaseLength}
                              setFieldValue={setFieldValue}
                              touched={touched.autoRenewLeaseLength}
                              errorText={errors.autoRenewLeaseLength}
                              placeholder="Select renewal term"
                              valueType="number"
                              displayEmpty
                            />
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={Boolean(values.autoRenewRentIncrement)}
                                  onChange={(event) => setFieldValue('autoRenewRentIncrement', event.target.checked)}
                                />
                              }
                              label={<Typography variant="body2">Increase rent on renewal</Typography>}
                            />
                          </Grid>
                          {values.autoRenewRentIncrement && (
                            <>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormSelect
                                  name="autoRenewRentIncrementType"
                                  label="Increase Type"
                                  options={[{ label: 'Percentage', value: 'percentage' }, { label: 'Dollar amount', value: 'amount' }]}
                                  value={values.autoRenewRentIncrementType}
                                  setFieldValue={setFieldValue}
                                  valueType="string"
                                  displayEmpty
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormInput
                                  name="autoRenewRentIncrementValue"
                                  label="Increase Value"
                                  type="number"
                                  placeholder={values.autoRenewRentIncrementType === 'percentage' ? 'e.g. 3' : 'e.g. 100'}
                                  value={values.autoRenewRentIncrementValue}
                                  setFieldValue={setFieldValue}
                                />
                              </Grid>
                            </>
                          )}
                        </Grid>
                      )}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Footer */}
            <Stack direction="row" sx={{ p: 2.5, gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" color="inherit" onClick={drawer.closeLeaseEditDrawer}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting || !lease}>
                Update
              </Button>
            </Stack>
          </Form>
        </LocalizationProvider>
      </FormikProvider>
    </Drawer>
  );
}

LeaseEditDrawer.propTypes = {
  unitsByProperty: PropTypes.object,
  onUpdateSuccess: PropTypes.func
};
