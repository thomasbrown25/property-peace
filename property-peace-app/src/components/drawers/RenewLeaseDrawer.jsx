import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';

// material-ui
import { Box, Button, Divider, Grid, IconButton, InputLabel, Stack, Toolbar, Typography } from '@mui/material';
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
import Autocomplete from 'components/@extended/AutoComplete';

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
import { getProperties } from 'store/property/property.action';
import { useNavigate } from 'react-router-dom';

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

// ---------- validation ----------
const LeaseSchema = Yup.object().shape({
  propertyId: Yup.mixed().required('Property is required'),
  unitId: Yup.mixed().nullable(),
  leaseStartDate: Yup.string().required('Lease start date is required'),
  leaseEndDate: Yup.string().required('Lease end date is required'),
  rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required(),
  rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required'),
  leaseLength: Yup.number().min(0).required('Lease length is required'),
  rentAmount: Yup.number().typeError('Enter a valid amount').min(0).required('Rent amount is required')
});

export default function RenewLeaseDrawer({ unitsByProperty = {}, onRenewSuccess }) {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const navigate = useNavigate();
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

  // ----- build initial values from existing lease for renewal -----
  const initialValues = useMemo(() => {
    if (!lease) return {};
    
    // Calculate renewal start date (day after current lease ends)
    const currentEndDate = new Date(lease.endDate);
    const renewalStartDate = new Date(currentEndDate);
    renewalStartDate.setDate(renewalStartDate.getDate() + 1);
    
    // Calculate renewal end date (same length as current lease, starting from renewal start)
    const renewalLength = lease.leaseLength || 12;
    const renewalEndDate = addMonths(renewalStartDate, renewalLength);
    
    return {
      propertyId: lease.propertyId || selectedProperty?.id || '',
      unitId: lease.unitId || '',
      leaseStartDate: toInputDate(renewalStartDate),
      leaseEndDate: toInputDate(renewalEndDate),
      rentFrequency: lease.rentFrequency?.toLowerCase() ?? 'monthly',
      rentDueDay: lease.rentDueDay ?? 1,
      leaseLength: lease.leaseLength ?? 12,
      rentAmount: lease.rentAmount ?? ''
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

        // Create a NEW lease (not updating existing one)
        const payload = {
          Id: 0, // 0 means create new lease
          PropertyId: Number(values.propertyId),
          UnitId: isPropertySingleFamily ? property?.units?.[0]?.id || 0 : Number(values.unitId || 0),
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          RentAmount: Number(values.rentAmount),
          LeaseLength: Number(values.leaseLength),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay),
          DepositAmount: lease?.depositAmount || 0,
          IsActive: true
        };

        const result = await dispatch(addOrUpdateLease(payload));
        await mutate(dashboardEndpoints.summary(user.id));
        
        // Refresh properties to get the new lease
        await dispatch(getProperties());

        openSnackbar({
          open: true,
          message: 'Lease renewal created successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        drawer.closeRenewLeaseDrawer();

        // Trigger refresh callback if provided
        if (onRenewSuccess) {
          onRenewSuccess();
        }

        // Navigate to the new lease if we have the ID
        if (result?.data?.id) {
          navigate(`/landlord/leases/${result.data.id}`);
        } else {
          // Fallback: navigate to leases page
          navigate('/landlord/leases');
        }
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to create lease renewal.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue } = formik;

  // recompute end date when start/length changes
  useEffect(() => {
    const len = Number(values.leaseLength || 0);
    if (len === 0) return;
    const start = values.leaseStartDate ? new Date(values.leaseStartDate) : null;
    if (!start) return;
    const end = addMonths(start, len);
    const formatted = toInputDate(end);
    if (formatted !== values.leaseEndDate) {
      setFieldValue('leaseEndDate', formatted, false);
    }
  }, [values.leaseStartDate, values.leaseLength]);

  // Unit options from selected property
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

  // Selected unit value for Autocomplete
  const selectedUnit = useMemo(() => {
    if (!values.unitId) return null;
    return unitOptions.find((u) => String(u.id) === String(values.unitId)) || null;
  }, [values.unitId, unitOptions]);

  // Auto-set unitId for single family properties, or clear if property changes
  useEffect(() => {
    if (currentProperty) {
      if (isSingleFamilyProperty) {
        // Auto-select first unit for single family properties
        const firstUnit = currentProperty.units?.[0];
        if (firstUnit && String(values.unitId) !== String(firstUnit.id)) {
          setFieldValue('unitId', firstUnit.id);
        }
      } else {
        // For multi-unit properties, check if current unitId is valid
        const currentUnit = currentProperty.units?.find((u) => String(u.id) === String(values.unitId));
        if (!currentUnit) {
          setFieldValue('unitId', '');
        }
      }
    }
  }, [currentProperty, isSingleFamilyProperty, setFieldValue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" justifyContent="center">
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  if (!lease) {
    return null;
  }

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenRenewLease}
      onClose={drawer.closeRenewLeaseDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520, md: 560 },
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
            {/* Header */}
            <Toolbar sx={{ px: 2.5 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Renew Lease
              </Typography>
              <IconButton onClick={drawer.closeRenewLeaseDrawer} size="large">
                <CloseOutlined />
              </IconButton>
            </Toolbar>
            <Divider />

            {/* Body */}
            <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create a new lease renewal starting after the current lease ends. You can modify the terms as needed.
              </Typography>
              
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormSelect
                    name="propertyId"
                    label="Property"
                    options={propertyOptions}
                    value={values.propertyId}
                    setFieldValue={(n, v) => {
                      setFieldValue('propertyId', v);
                      setFieldValue('unitId', '');
                    }}
                    touched={touched.propertyId}
                    errorText={errors.propertyId}
                    placeholder="Select property"
                    valueType="number"
                    displayEmpty
                    disabled
                  />
                </Grid>
                {!isSingleFamilyProperty && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={1}>
                      <InputLabel htmlFor="unitId" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Unit Number
                      </InputLabel>
                      <Autocomplete
                        options={unitOptions}
                        width="100%"
                        label="Select Unit"
                        value={selectedUnit}
                        onChange={(_, value) => {
                          setFieldValue('unitId', value?.id || '');
                        }}
                        isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                        getOptionLabel={(option) => option?.label ?? ''}
                        disabled={!currentProperty || unitOptions.length === 0}
                        disablePortal={false}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1
                          }
                        }}
                      />
                      {touched.unitId && errors.unitId && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                          {errors.unitId}
                        </Typography>
                      )}
                    </Stack>
                  </Grid>
                )}

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormInput
                    name="leaseStartDate"
                    label="Renewal Start Date"
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
                    label="Renewal End Date"
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

                <Grid size={{ xs: 12, md: 6 }}>
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

                <Grid size={{ xs: 12, md: 6 }}>
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

                <Grid size={{ xs: 12, md: 6 }}>
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
                    placeholder="Select lease length"
                    valueType="number"
                    displayEmpty
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Footer */}
            <Stack direction="row" sx={{ p: 2.5, gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" color="inherit" onClick={drawer.closeRenewLeaseDrawer}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting || !values.propertyId}>
                {isSubmitting ? 'Creating...' : 'Create Renewal'}
              </Button>
            </Stack>
          </Form>
        </LocalizationProvider>
      </FormikProvider>
    </ThemeAdaptiveDrawer>
  );
}

RenewLeaseDrawer.propTypes = {
  unitsByProperty: PropTypes.object,
  onRenewSuccess: PropTypes.func
};

