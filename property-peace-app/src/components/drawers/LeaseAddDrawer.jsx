// LeaseAddDrawer.jsx
import { useEffect, useMemo, useState } from 'react';

// material-ui
import {
  Box, Button, Drawer, Divider, Grid, IconButton,
  Stack, Toolbar, Typography, alpha, useTheme,
  Stepper, Step, StepLabel, StepConnector, stepConnectorClasses, styled,
  FormControlLabel, Switch, Chip, TextField
} from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import { FileTextOutlined, CloudUploadOutlined, PlusOutlined } from '@ant-design/icons';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';

// app
import { useDrawer } from 'contexts/DrawerContext';
import { useNavigate } from 'react-router-dom';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { openSnackbar } from 'api/snackbar';
import Autocomplete from 'components/@extended/AutoComplete';
import axiosServices from 'utils/axios';

// hooks
import useAuth from 'hooks/useAuth';
import useIsSingleUnitProfile from 'hooks/useIsSingleUnitProfile';

// selectors
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { getProperties } from 'store/property/property.action';
import { leaseLengthOptions, rentDueDayOptions, rentFrequencyOptions } from 'utils/models';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';
import { useDispatch, useSelector } from 'react-redux';

// ---------- steps ----------
const STEP_PROPERTY = 0;
const STEP_DETAILS  = 1;
const STEP_SUCCESS  = 2;

// ---------- stepper ----------
const STEP_LABELS = ['Property & Lease Info', 'Lease Details'];

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main },
  [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.grey[300], borderTopWidth: 2, borderRadius: 1 }
}));

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toInputDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function firstOfNextMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

const getTermMonths = (leaseLength) => (Number(leaseLength) === -1 ? 1 : Number(leaseLength || 0));

const getPropertyName = (property) => property?.label ?? property?.name ?? property?.Name ?? property?.streetAddress ?? property?.StreetAddress ?? String(property?.id ?? property?.Id ?? '');

const getUnitName = (unit) => unit?.name || unit?.Name || unit?.unitNumber || unit?.UnitNumber || unit?.number || unit?.Number || '';

const formatPropertyUnitTitle = (property, unit = null) => {
  const propertyName = getPropertyName(property);
  const unitName = unit ? getUnitName(unit) : '';
  if (!unitName) return propertyName;
  const normalizedUnit = String(unitName).trim();
  return `${propertyName}, ${normalizedUnit.startsWith('#') ? normalizedUnit : `#${normalizedUnit}`}`;
};

const formatSingleUnitPropertyTitle = (property) => `${getPropertyName(property)} (single family property)`;

const getUnitLease = (unit) => unit?.lease || unit?.Lease || unit?.activeLease || unit?.ActiveLease || null;

const hasActiveLease = (lease) => {
  if (!lease) return false;
  const status = String(lease.status ?? lease.Status ?? '').toLowerCase();
  if (lease.isActive === false || lease.IsActive === false) return false;
  if (['inactive', 'ended', 'expired', 'cancelled', 'canceled', 'terminated'].includes(status)) return false;
  return true;
};

const isMultiUnitPropertyType = (property) => {
  const type = String(property?.propertyType ?? property?.PropertyType ?? '').toLowerCase();
  return type === 'multiunit' || type === 'smallmultifamily' || type === 'apartmentbuilding' || type === 'other';
};

const isSingleUnitProperty = (property) => !isMultiUnitPropertyType(property) || (property?.units || property?.Units || []).length <= 1;

const getFirstActiveLease = (property) => {
  const activeUnit = (property?.units || property?.Units || []).find((unit) => hasActiveLease(getUnitLease(unit)));
  return activeUnit ? getUnitLease(activeUnit) : null;
};

// ---------- initial values ----------
const buildInitialValues = (selectedProperty = null) => {
  const start = firstOfNextMonth();
  const defaultLeaseLen = 12;
  const end = addMonths(start, defaultLeaseLen);
  return {
    propertyId: selectedProperty?.id ?? selectedProperty?.Id ?? '',
    unitId: '',
    name: '',
    leaseStartDate: toInputDate(start),
    leaseEndDate: toInputDate(end),
    allPaymentsOnTime: false,
    rentFrequency: 'monthly',
    rentDueDay: 1,
    leaseLength: defaultLeaseLen,
    rentAmount: '',
    autoRenewLease: false,
    autoRenewLeaseLength: defaultLeaseLen,
    autoRenewRentIncrement: false,
    autoRenewRentIncrementType: 'percentage',
    autoRenewRentIncrementValue: ''
  };
};

// ---------- validation ----------
const LeaseSchema = Yup.object().shape({
  propertyId: Yup.mixed().required('Property is required'),
  unitId: Yup.mixed().nullable(),
  leaseStartDate: Yup.string().required('Lease start date is required'),
  leaseEndDate: Yup.string().required('Lease end date is required'),
  rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required('Rent frequency is required'),
  rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required'),
  leaseLength: Yup.number().min(-1).required('Lease length is required'),
  rentAmount: Yup.number().typeError('Enter a valid amount').min(0, 'Must be ≥ 0').required('Rent amount is required'),
  autoRenewLeaseLength: Yup.number().when('autoRenewLease', {
    is: true,
    then: (schema) => schema.required('Renewal term is required'),
    otherwise: (schema) => schema.nullable()
  })
});

export default function LeaseAddDrawer() {
  const drawer  = useDrawer();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme   = useTheme();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const { isSingleUnitProfile } = useIsSingleUnitProfile();

  const properties     = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);

  const [step, setStep] = useState(STEP_PROPERTY);
  const [stepError, setStepError] = useState('');
  const [createdLease, setCreatedLease] = useState(null);

  // Reset on close; pre-fill property+unit on open
  useEffect(() => {
    if (!drawer.isOpenLeaseAdd) {
      setStep(STEP_PROPERTY);
      setStepError('');
      setCreatedLease(null);
    } else {
      if (drawer.leaseAddProperty) {
        formik.setFieldValue('propertyId', Number(drawer.leaseAddProperty.id ?? drawer.leaseAddProperty.Id));
      }
      if (drawer.leaseAddUnitId) {
        formik.setFieldValue('unitId', String(drawer.leaseAddUnitId));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.isOpenLeaseAdd]);

  const propertyOptions = useMemo(() => {
    const toOptions = (p) => {
      const propertyId = Number(p.value ?? p.id ?? p.Id);
      const units = p.units || p.Units || [];

      if (!units.length) {
        const activeLease = getFirstActiveLease(p);
        const displayTitle = formatSingleUnitPropertyTitle(p);
        return [{
          id: `${propertyId}-property`,
          value: propertyId,
          unitId: '',
          label: displayTitle,
          displayTitle,
          property: p,
          hasLease: Boolean(activeLease),
          activeLease,
          isSingleUnit: true
        }];
      }

      return units.map((unit) => {
        const unitId = unit.id ?? unit.Id;
        const activeLease = hasActiveLease(getUnitLease(unit)) ? getUnitLease(unit) : null;
        const isSingleUnit = isSingleUnitProperty(p);
        const displayTitle = isSingleUnit ? formatSingleUnitPropertyTitle(p) : formatPropertyUnitTitle(p, unit);

        return {
          id: `${propertyId}-${unitId || 'unit'}`,
          value: propertyId,
          unitId: unitId || '',
          label: displayTitle,
          displayTitle,
          property: p,
          unit,
          hasLease: Boolean(activeLease),
          activeLease,
          isSingleUnit
        };
      });
    };

    const fromStore = (properties || []).flatMap(toOptions);
    if (drawer.leaseAddProperty) {
      const preId = Number(drawer.leaseAddProperty.id ?? drawer.leaseAddProperty.Id);
      if (!fromStore.some((o) => o.value === preId)) {
        return [...toOptions(drawer.leaseAddProperty), ...fromStore];
      }
    }
    return fromStore;
  }, [properties, drawer.leaseAddProperty]);

  const formik = useFormik({
    initialValues: (() => {
      const initial = buildInitialValues(selectedProperty);
      const pendingUnitId = sessionStorage.getItem('pendingLeaseUnitId');
      if (pendingUnitId) {
        initial.unitId = pendingUnitId;
        sessionStorage.removeItem('pendingLeaseUnitId');
      }
      return initial;
    })(),
    validationSchema: LeaseSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const property = properties.find((p) => Number(p.id ?? p.Id) === Number(values.propertyId));

        // Resolve unit ID: prefer explicitly selected unit, then cached units,
        // then fetch from API (properties list may not include nested units)
        const propertyUnits = property?.units || property?.Units || [];
        let resolvedUnitId = isSingleUnitProfile
          ? (propertyUnits[0]?.id ?? propertyUnits[0]?.Id)
          : (Number(values.unitId) || propertyUnits[0]?.id || propertyUnits[0]?.Id);

        if (!resolvedUnitId) {
          try {
            const unitsRes = await axiosServices.get(`/api/unit/${values.propertyId}`);
            const fetched = unitsRes.data?.data || unitsRes.data || [];
            resolvedUnitId = Array.isArray(fetched) ? fetched[0]?.id : undefined;
          } catch { /* fall through — backend will return a clear error */ }
        }

        const payload = {
          PropertyId: Number(values.propertyId) || 0,
          UnitId: resolvedUnitId || 0,
          Name: values.name?.trim() || null,
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          RentAmount: Number(values.rentAmount || 0),
          LeaseLength: Number(values.leaseLength || 0),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay),
          AutoRenewLease: Boolean(values.autoRenewLease),
          AutoRenewLeaseLength: values.autoRenewLease ? Number(values.autoRenewLeaseLength || values.leaseLength || 12) : null,
          AutoRenewRentIncrement: values.autoRenewLease ? Boolean(values.autoRenewRentIncrement) : false,
          AutoRenewRentIncrementType: values.autoRenewLease && values.autoRenewRentIncrement ? values.autoRenewRentIncrementType : null,
          AutoRenewRentIncrementValue: values.autoRenewLease && values.autoRenewRentIncrement ? Number(values.autoRenewRentIncrementValue || 0) : null,
          MarkPastPaymentsAsPaid: Boolean(values.allPaymentsOnTime)
        };

        const response = await axiosServices.post('/api/lease', payload);
        await mutate(dashboardEndpoints.summary(user.id));
        if (user?.id) await dispatch(getProperties());

        if (response.data?.success && response.data?.data) {
          setCreatedLease(response.data.data);
          setStep(STEP_SUCCESS);
        } else {
          openSnackbar({ open: true, message: 'Lease added successfully.', variant: 'alert', alert: { color: 'success' } });
          resetForm();
          drawer.closeLeaseAddDrawer();
        }
      } catch (error) {
        console.error(error);
        openSnackbar({ open: true, message: error?.response?.data?.message || 'Failed to add lease.', variant: 'alert', alert: { color: 'error' } });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue } = formik;

  const currentProperty = useMemo(() => {
    const id = Number(values.propertyId);
    if (Number(selectedProperty?.id ?? selectedProperty?.Id) === id) return selectedProperty;
    const fromStore = properties?.find((p) => Number(p.id ?? p.Id) === id);
    if (fromStore) return fromStore;
    if (drawer.leaseAddProperty && Number(drawer.leaseAddProperty.id ?? drawer.leaseAddProperty.Id) === id) return drawer.leaseAddProperty;
    return null;
  }, [selectedProperty, values.propertyId, properties, drawer.leaseAddProperty]);

  // Clear unitId when property changes
  useEffect(() => {
    if (currentProperty) {
      const pendingUnitId = sessionStorage.getItem('pendingLeaseUnitId');
      if (pendingUnitId) {
        const units = currentProperty.units || currentProperty.Units || [];
        const unitExists = units.some((u) => String(u.id ?? u.Id) === String(pendingUnitId));
        if (unitExists) {
          setFieldValue('unitId', pendingUnitId);
          sessionStorage.removeItem('pendingLeaseUnitId');
          return;
        }
      }
      const units = currentProperty.units || currentProperty.Units || [];
      const currentUnit = units.find((u) => String(u.id ?? u.Id) === String(values.unitId));
      if (!currentUnit) setFieldValue('unitId', '');
    }
  }, [currentProperty, setFieldValue, values.unitId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update EndDate when StartDate or LeaseLength changes
  useEffect(() => {
    const len = Number(values.leaseLength || 0);
    if (len === 0) return;
    const start = values.leaseStartDate ? new Date(values.leaseStartDate) : null;
    if (!start) return;
    const formatted = toInputDate(addMonths(start, getTermMonths(len)));
    if (formatted !== values.leaseEndDate) setFieldValue('leaseEndDate', formatted, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.leaseStartDate, values.leaseLength]);

  useEffect(() => {
    if (values.autoRenewLease && !values.autoRenewLeaseLength) {
      setFieldValue('autoRenewLeaseLength', values.leaseLength || 12, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.autoRenewLease, values.leaseLength]);

  const handleNextStep = () => {
    setStepError('');
    if (!values.propertyId) {
      setStepError('Please select a property.');
      return;
    }
    setStep(STEP_DETAILS);
  };

  const handleSuccessAction = (action) => {
    const finalPropertyId = Number(values.propertyId);
    const finalUnitId = Number(values.unitId) || null;
    const lid = createdLease?.id;

    if (action === 'createAgreement') {
      drawer.closeLeaseAddDrawer();
      if (lid) {
        const q = `leaseId=${lid}&propertyId=${finalPropertyId}${finalUnitId ? `&unitId=${finalUnitId}` : ''}`;
        navigate(`/landlord/leases/build-lease-agreement?${q}`);
      } else {
        navigate('/landlord/leases/builder');
      }
    } else if (action === 'uploadAgreement') {
      drawer.closeLeaseAddDrawer();
      navigate(`/landlord/property/${finalPropertyId}?tab=documents`);
    } else if (action === 'createAnother') {
      formik.resetForm();
      setCreatedLease(null);
      setStep(STEP_PROPERTY);
    }
  };

  // -------- step content --------
  const renderStep = () => {
    // Step 1: Property, Unit, Lease Name
    if (step === STEP_PROPERTY) {
      return (
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Property / Unit *
            </Typography>
            <Autocomplete
              options={propertyOptions}
              width="100%"
              value={propertyOptions.find((o) => (
                o.value === Number(values.propertyId) && String(o.unitId || '') === String(values.unitId || '')
              )) || propertyOptions.find((o) => o.value === Number(values.propertyId)) || null}
              onChange={(_, option) => {
                if (option?.hasLease && option?.activeLease) {
                  drawer.closeLeaseAddDrawer();
                  navigate(`/landlord/leases/${option.activeLease.id ?? option.activeLease.Id}/settings`);
                  return;
                }
                setFieldValue('propertyId', option ? option.value : '');
                setFieldValue('unitId', option?.unitId ? String(option.unitId) : '');
                setStepError('');
              }}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              getOptionLabel={(option) => option?.label ?? ''}
              filterOptions={(options, state) => {
                const input = state.inputValue.trim().toLowerCase();
                if (!input) return options;
                return options.filter((option) => `${option.displayTitle} ${option.hasLease ? 'active lease' : ''}`.toLowerCase().includes(input));
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                    <Typography variant="body2" fontWeight={600}>
                      {option.displayTitle}
                    </Typography>
                    {option.hasLease && (
                      <Chip
                        size="small"
                        label="Active lease"
                        color="success"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    )}
                  </Stack>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search property or unit"
                  fullWidth
                />
              )}
              disablePortal={false}
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
            {touched.propertyId && errors.propertyId && (
              <Typography variant="caption" color="error" sx={{ ml: 1.75 }}>
                {errors.propertyId}
              </Typography>
            )}
          </Stack>

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
              helperText="Leave blank to auto-generate: {Street Address} - {Month Year}"
            />
          </Stack>

          {stepError && (
            <Typography variant="caption" color="error">{stepError}</Typography>
          )}
        </Stack>
      );
    }

    // Step 2: Lease details
    if (step === STEP_DETAILS) {
      return (
        <Grid container spacing={3}>
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

          <Grid size={{ xs: 12, md: 6 }}>
            <FormSelect
              name="leaseLength"
              label="Lease Length"
              options={leaseLengthOptions}
              value={values.leaseLength}
              setFieldValue={(n, v) => {
                const len = Number(v);
                setFieldValue('leaseLength', len);
                if (len !== 0 && values.leaseStartDate) {
                  setFieldValue('leaseEndDate', toInputDate(addMonths(new Date(values.leaseStartDate), getTermMonths(len))));
                }
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

          <Grid size={{ xs: 12, md: 6 }}>
            <FormInput
              name="rentAmount"
              label="Rent Amount"
              type="text"
              valueType="currency"
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

          {Number(values.leaseLength) === 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <FormInput
                name="customLeaseLengthMonths"
                label="Custom Length (months)"
                type="number"
                placeholder="e.g. 15"
                value={values.customLeaseLengthMonths}
                setFieldValue={setFieldValue}
                touched={Boolean(touched.customLeaseLengthMonths)}
                errorText={errors.customLeaseLengthMonths}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2, bgcolor: 'background.paper' }}>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(values.autoRenewLease)}
                      onChange={(event) => {
                        setFieldValue('autoRenewLease', event.target.checked);
                        if (event.target.checked) setFieldValue('autoRenewLeaseLength', values.leaseLength || 12);
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
      );
    }

    // Step 3: Success
    if (step === STEP_SUCCESS) {
      return (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: theme.palette.success.main, marginBottom: 12 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Lease created!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {createdLease?.name || currentProperty?.name || 'Your lease has been created successfully.'}
          </Typography>

          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            What would you like to do next?
          </Typography>

          <Stack spacing={1.5}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<FileTextOutlined />}
              onClick={() => handleSuccessAction('createAgreement')}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              Create a lease agreement
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<CloudUploadOutlined />}
              onClick={() => handleSuccessAction('uploadAgreement')}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              Upload lease agreement
            </Button>
            <Button
              variant="text"
              fullWidth
              startIcon={<PlusOutlined />}
              onClick={() => handleSuccessAction('createAnother')}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              Create another lease
            </Button>
          </Stack>
        </Box>
      );
    }
  };

  const isSuccess = step === STEP_SUCCESS;

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenLeaseAdd}
      onClose={drawer.closeLeaseAddDrawer}
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
            <Toolbar sx={{ px: 2.5, justifyContent: 'space-between' }}>
              <Typography variant="h6">
                {isSuccess ? 'Lease Created' : 'Create Lease'}
              </Typography>
              <IconButton onClick={drawer.closeLeaseAddDrawer} size="large">
                <CloseOutlined />
              </IconButton>
            </Toolbar>
            <Divider />

            {/* Stepper — only shown on form steps */}
            {!isSuccess && (
              <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
                <Stepper
                  activeStep={step}
                  alternativeLabel
                  connector={<CustomStepConnector />}
                >
                  {STEP_LABELS.map((label, index) => (
                    <Step key={label} completed={index < step}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            )}
            <Divider />

            {/* Content */}
            <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
              {renderStep()}
            </Box>

            {/* Footer — hidden on success */}
            {!isSuccess && (
              <>
                <Divider />
                <Stack direction="row" sx={{ p: 2.5, gap: 2, justifyContent: 'space-between' }}>
                  {step === STEP_DETAILS ? (
                    <Button
                      variant="text"
                      startIcon={<ArrowLeftOutlined />}
                      onClick={() => setStep(STEP_PROPERTY)}
                      sx={{ textTransform: 'none' }}
                    >
                      Back
                    </Button>
                  ) : (
                    <Button variant="outlined" color="inherit" onClick={drawer.closeLeaseAddDrawer} sx={{ textTransform: 'none' }}>
                      Cancel
                    </Button>
                  )}

                  {step === STEP_PROPERTY ? (
                    <Button variant="contained" onClick={handleNextStep} sx={{ textTransform: 'none', px: 4 }}>
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting || !values.propertyId}
                      sx={{ textTransform: 'none', px: 4 }}
                    >
                      {isSubmitting ? 'Creating…' : 'Create Lease'}
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </Form>
        </LocalizationProvider>
      </FormikProvider>
    </Drawer>
  );
}
