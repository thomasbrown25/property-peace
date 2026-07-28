import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import PropTypes from 'prop-types';
import { useEffect, useState, useRef, useMemo } from 'react';

// material-ui
import { 
  Box, 
  Button, 
  Divider, 
  Grid, 
  IconButton, 
  Stack, 
  Toolbar, 
  Typography, 
  Card, 
  CardContent, 
  Tooltip, 
  Paper, 
  Chip,
  FormControlLabel,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  FormHelperText,
  TextField,
  alpha,
  RadioGroup,
  Radio,
  useTheme
} from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import { UserOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider, FieldArray } from 'formik';

// app
import { useDrawer } from 'contexts/DrawerContext';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import Autocomplete from 'components/@extended/AutoComplete';
import { openSnackbar } from 'api/snackbar';
import { strengthColor, strengthIndicator } from 'utils/password-strength';
import axiosServices from 'utils/axios';

// hooks
import { useDispatch, useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import useFetchTenants from 'hooks/useFetchTenants';
import useFetchProperties from 'hooks/useFetchProperties';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';

// api
import { addOrUpdateTenant } from 'store/tenant/tenant.action';
import { TENANT_ACTION_TYPES } from 'store/tenant/tenant.types';
import { tenantInviteAPI } from 'api';

// selectors
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import { setLease } from 'store/lease/lease.action';

// ---------- validation ----------
const TenantSchema = Yup.object().shape({
  tenants: Yup.array().of(
    Yup.object().shape({
      accountCreationMethod: Yup.string().oneOf(['create', 'invite']).required(),
      email: Yup.string()
        .email('Invalid email')
        .required('Email is required'),
      firstname: Yup.string().required('First name is required'),
      lastname: Yup.string().required('Last name is required'),
      phoneNumber: Yup.string().nullable(),
      createAccount: Yup.boolean(),
      password: Yup.string().when('accountCreationMethod', {
        is: 'create',
        then: (schema) => schema
          .required('Password is required when creating an account')
          .test('no-leading-trailing-whitespace', 'Password cannot start or end with spaces', (value) => value === value.trim())
          .min(8, 'Password must be at least 8 characters')
          .max(50, 'Password must be less than 50 characters'),
        otherwise: (schema) => schema.nullable()
      })
    })
  )
});

const buildInitialValues = () => ({
  tenants: [
    { firstname: '', lastname: '', email: '', phoneNumber: '', accountCreationMethod: 'invite', createAccount: false, password: '' } // start with one tenant, invite pre-selected
  ]
});

const getPropertyId = (property) => property?.id ?? property?.Id ?? null;
const getUnitId = (unit) => unit?.id ?? unit?.Id ?? null;
const getPropertyUnits = (property) => property?.units || property?.Units || [];

const isMultiUnitProperty = (property) => {
  const propertyType = String(property?.propertyType || property?.PropertyType || '').toLowerCase();
  return ['multiunit', 'multifamily', 'smallmultifamily', 'apartmentbuilding', 'other'].includes(propertyType)
    || getPropertyUnits(property).length > 1;
};

const getPropertyName = (property) => (
  property?.name || property?.Name || property?.streetAddress || property?.StreetAddress || 'Unnamed property'
);

const getUnitName = (unit) => unit?.name || unit?.Name || unit?.unitNumber || unit?.UnitNumber || `Unit ${unit?.id ?? unit?.Id}`;

const formatPropertyUnitLabel = (property, unit) => {
  const propertyName = getPropertyName(property);
  if (!unit || !isMultiUnitProperty(property)) return propertyName;
  const unitName = String(getUnitName(unit)).trim();
  return `${propertyName}, ${unitName.startsWith('#') ? unitName : `#${unitName}`}`;
};

export default function TenantAddDrawer() {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const theme = useTheme();

  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const { properties = [] } = useFetchProperties();
  const { tenants = [], refetch: refetchTenants } = useFetchTenants();

  const propertyUnitOptions = useMemo(() => {
    const sourceProperties = [...properties];
    const selectedPropertyId = getPropertyId(selectedProperty);
    if (selectedPropertyId && !sourceProperties.some((property) => String(getPropertyId(property)) === String(selectedPropertyId))) {
      sourceProperties.unshift(selectedProperty);
    }

    return sourceProperties.flatMap((property) => {
      const propertyId = getPropertyId(property);
      const units = getPropertyUnits(property);
      if (isMultiUnitProperty(property)) {
        if (!units.length) {
          return [{ id: `${propertyId}-property`, property, unit: null, label: getPropertyName(property) }];
        }
        return units.map((unit) => ({
          id: `${propertyId}-${getUnitId(unit)}`,
          property,
          unit,
          label: formatPropertyUnitLabel(property, unit)
        }));
      }

      const unit = units[0] || null;
      return [{ id: `${propertyId}-${getUnitId(unit) ?? 'property'}`, property, unit, label: getPropertyName(property) }];
    });
  }, [properties, selectedProperty]);

  const resolvedSelectedUnit = useMemo(() => {
    if (!selectedProperty) return null;
    const units = getPropertyUnits(selectedProperty);
    if (!isMultiUnitProperty(selectedProperty)) return units[0] || null;

    const selectedUnitId = getUnitId(selectedUnit);
    if (!selectedUnitId) return null;
    return units.find((unit) => String(getUnitId(unit)) === String(selectedUnitId)) || null;
  }, [selectedProperty, selectedUnit]);

  const selectedPropertyUnitOption = useMemo(() => {
    const selectedPropertyId = getPropertyId(selectedProperty);
    if (!selectedPropertyId) return null;

    const selectedUnitId = getUnitId(resolvedSelectedUnit);
    return propertyUnitOptions.find((option) => (
      String(getPropertyId(option.property)) === String(selectedPropertyId)
      && String(getUnitId(option.unit) ?? '') === String(selectedUnitId ?? '')
    )) || null;
  }, [propertyUnitOptions, resolvedSelectedUnit, selectedProperty]);

  const handlePropertyUnitChange = (_, option) => {
    dispatch(setProperty(option?.property || null));
    dispatch(setUnit(option?.unit || null));
    dispatch(setLease(option?.unit?.lease || option?.unit?.Lease || {}));
  };

  // Filter existing tenants for the selected property/unit.
  const existingTenants = useMemo(() => {
    const selectedPropertyId = getPropertyId(selectedProperty);
    if (!selectedPropertyId) return [];

    let filtered = tenants.filter((tenant) => String(tenant.propertyId ?? tenant.PropertyId) === String(selectedPropertyId));
    if (isMultiUnitProperty(selectedProperty)) {
      const selectedUnitId = getUnitId(resolvedSelectedUnit);
      if (!selectedUnitId) return [];
      filtered = filtered.filter((tenant) => String(tenant.unitId ?? tenant.UnitId) === String(selectedUnitId));
    }

    return filtered;
  }, [tenants, resolvedSelectedUnit, selectedProperty]);

  const [loading, setLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState({});
  const [passwordLevels, setPasswordLevels] = useState({});
  const processedTenantsRef = useRef(new Map());

  useEffect(() => setLoading(false), []);

  const formik = useFormik({
    initialValues: buildInitialValues(),
    validationSchema: TenantSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm, setFieldError }) => {
      try {
        processedTenantsRef.current.clear();

        // Validate property is selected.
        const selectedPropertyId = getPropertyId(selectedProperty);
        if (!selectedPropertyId) {
          openSnackbar({
            open: true,
            message: 'Please select a property before adding tenants',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        // Validate the selected unit belongs to the selected property whenever a unit is required.
        if (isMultiUnitProperty(selectedProperty) && !resolvedSelectedUnit) {
          openSnackbar({
            open: true,
            message: 'Please select a unit before adding tenants',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        const resolvedUnitId = getUnitId(resolvedSelectedUnit);
        const resolvedLease = resolvedSelectedUnit?.lease || resolvedSelectedUnit?.Lease;

        // Loop tenants and add each.
        for (const t of values.tenants) {
          const tenantPayload = {
            PropertyId: selectedPropertyId,
            UnitId: resolvedUnitId,
            LeaseId: resolvedLease?.id ?? resolvedLease?.Id ?? null,
            Firstname: t.firstname,
            Lastname: t.lastname,
            Email: t.email || null,
            PhoneNumber: t.phoneNumber || null
          };

          // Handle account creation method
          if (t.accountCreationMethod === 'invite') {
            // Send invite link - need to save tenant first
            if (!t.email) {
              const tenantIndex = values.tenants.indexOf(t);
              setFieldError(`tenants[${tenantIndex}].email`, 'Email is required to send an invite');
              setSubmitting(false);
              return;
            }

            // Save tenant first (needed for invite)
            try {
              // Make API call directly to get tenant ID
              const saveResponse = await axiosServices.post('/api/tenant', tenantPayload);
              const tenantId = saveResponse.data?.data?.Id || saveResponse.data?.data?.id;
              const savedTenant = saveResponse.data?.data;

              if (!tenantId) {
                openSnackbar({
                  open: true,
                  message: 'Failed to create tenant. Cannot send invite.',
                  variant: 'alert',
                  alert: { color: 'error' }
                });
                setSubmitting(false);
                return;
              }

              // Update Redux store with the saved tenant (without making another API call)
              if (savedTenant) {
                dispatch({
                  type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS,
                  payload: savedTenant
                });
              }

              await tenantInviteAPI.createTenantInvite({
                tenantId: tenantId,
                email: t.email.trim()
              });

              openSnackbar({
                open: true,
                message: `Invite sent to ${t.email}`,
                variant: 'alert',
                alert: { color: 'success' }
              });
            } catch (inviteError) {
              console.error('Error creating tenant or sending invite:', inviteError);
              const tenantIndex = values.tenants.indexOf(t);
              setFieldError(`tenants[${tenantIndex}].email`, inviteError?.response?.data?.message || 'Failed to create tenant or send invite');
              openSnackbar({
                open: true,
                message: inviteError?.response?.data?.message || 'Failed to create tenant or send invite',
                variant: 'alert',
                alert: { color: 'error' }
              });
              setSubmitting(false);
              return;
            }
          } else if (t.accountCreationMethod === 'create' && t.password && t.email && t.firstname && t.lastname) {
            // Create account directly (existing functionality)
            const tenantKey = `${t.email}_${t.firstname}_${t.lastname}`;
            
            // Check if we already processed this tenant in this submission
            if (processedTenantsRef.current.has(tenantKey)) {
              const savedData = processedTenantsRef.current.get(tenantKey);
              if (savedData?.userId) {
                tenantPayload.UserId = savedData.userId;
              }
            } else {
              try {
                const registerResponse = await axiosServices.post('/api/user/register', {
                  email: t.email.trim(),
                  password: t.password,
                  firstName: t.firstname,
                  lastName: t.lastname,
                  phoneNumber: t.phoneNumber || null,
                  roles: ['Tenant']
                });

                const userId = registerResponse.data?.data?.Id || registerResponse.data?.data?.id;
                if (registerResponse.data?.success && userId) {
                  tenantPayload.UserId = userId;
                  processedTenantsRef.current.set(tenantKey, { userId });
                } else {
                  const errorMsg = registerResponse.data?.message || 'User account could not be created. No user ID returned.';
                  throw new Error(errorMsg);
                }
              } catch (userError) {
                console.error('Error creating user account:', userError);
                
                let errorMessage = 'User account could not be created.';
                if (userError?.response?.data) {
                  const errorData = userError.response.data;
                  if (errorData.errors) {
                    const errors = errorData.errors;
                    if (typeof errors === 'object' && errors !== null) {
                      errorMessage = errors.message || errors.Message || errorData.message || errorData.Message || errorMessage;
                    } else if (typeof errors === 'string') {
                      errorMessage = errors;
                    }
                  } else if (errorData.message || errorData.Message) {
                    errorMessage = errorData.message || errorData.Message;
                  }
                } else if (userError?.message) {
                  errorMessage = userError.message;
                }

                const tenantIndex = values.tenants.indexOf(t);
                if (tenantIndex >= 0) {
                  setFieldError(`tenants[${tenantIndex}].email`, errorMessage);
                }

                openSnackbar({
                  open: true,
                  message: `User account could not be created: ${errorMessage}`,
                  variant: 'alert',
                  alert: { color: 'error' }
                });
                
                setSubmitting(false);
                return;
              }
            }

            // Save tenant with userId
            await dispatch(addOrUpdateTenant(tenantPayload));
          } else {
            // No account creation - just save tenant
            await dispatch(addOrUpdateTenant(tenantPayload));
          }
        }

        await mutate(dashboardEndpoints.summary(user.id));
        await refetchTenants();

        openSnackbar({
          open: true,
          message: `${values.tenants.length} tenant(s) added successfully.`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        resetForm();
        drawer.closeTenantAddDrawer();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to add tenant(s).',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue, submitCount } = formik;
  const isDark = theme.palette.mode === 'dark';
  const drawerAccent = theme.palette.primary.main;

  const sectionShellSx = {
    p: 2,
    borderRadius: 2,
    border: `1px solid ${isDark ? alpha(drawerAccent, 0.22) : alpha(theme.palette.divider, 0.9)}`,
    bgcolor: isDark ? alpha(theme.palette.background.paper, 0.48) : alpha(theme.palette.background.paper, 0.82),
    backgroundImage: isDark
      ? `linear-gradient(135deg, ${alpha(drawerAccent, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0)} 46%)`
      : `linear-gradient(135deg, ${alpha(drawerAccent, 0.045)} 0%, ${alpha(theme.palette.background.paper, 0)} 56%)`,
    boxShadow: isDark
      ? `0 16px 36px ${alpha(theme.palette.common.black, 0.24)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.04)}`
      : `0 10px 28px ${alpha(theme.palette.grey[500], 0.08)}`
  };

  if (loading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenTenantAdd}
      onClose={drawer.closeTenantAddDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 620, md: 680 },
          bgcolor: 'background.paper',
          backgroundImage: isDark
            ? `radial-gradient(circle at 18% 0%, ${alpha(drawerAccent, 0.16)} 0%, transparent 34%), linear-gradient(180deg, ${alpha('#0f1b2b', 0.98)} 0%, ${alpha('#101a2a', 1)} 100%)`
            : `linear-gradient(180deg, ${alpha(theme.palette.primary.lighter || drawerAccent, 0.34)} 0%, ${theme.palette.background.paper} 42%)`,
          borderLeft: `1px solid ${isDark ? alpha(drawerAccent, 0.28) : theme.palette.divider}`,
          boxShadow: isDark ? `-26px 0 70px ${alpha(theme.palette.common.black, 0.42)}` : `-18px 0 48px ${alpha(theme.palette.grey[500], 0.16)}`,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
            {/* Header */}
            <Toolbar
              sx={{
                px: 3,
                minHeight: 68,
                borderBottom: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.08) : theme.palette.divider}`,
                backgroundImage: isDark ? `linear-gradient(90deg, ${alpha(drawerAccent, 0.1)}, transparent 62%)` : 'none'
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                  Add Tenants
                </Typography>
              </Box>
              <IconButton
                onClick={drawer.closeTenantAddDrawer}
                size="large"
                sx={{
                  border: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.1) : theme.palette.divider}`,
                  bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.grey[100], 0.7),
                  '&:hover': { bgcolor: alpha(drawerAccent, 0.12), borderColor: alpha(drawerAccent, 0.35) }
                }}
              >
                <CloseOutlined />
              </IconButton>
            </Toolbar>

            {/* Content */}
            <Box
              sx={{
                px: 3,
                py: 2.5,
                flex: 1,
                overflowY: 'auto',
                '&::-webkit-scrollbar': { width: 8 },
                '&::-webkit-scrollbar-thumb': {
                  borderRadius: 999,
                  bgcolor: isDark ? alpha(theme.palette.common.white, 0.12) : alpha(theme.palette.grey[500], 0.26)
                }
              }}
            >
              <Grid container spacing={3}>
                {/* Property + Unit */}
                <Grid size={{ xs: 12 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      Property / Unit *
                    </Typography>
                    <Autocomplete
                      options={propertyUnitOptions}
                      width="100%"
                      value={selectedPropertyUnitOption}
                      onChange={handlePropertyUnitChange}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      getOptionLabel={(option) => option?.label ?? ''}
                      filterOptions={(options, state) => {
                        const query = state.inputValue.trim().toLowerCase();
                        if (!query) return options;
                        return options.filter((option) => option.label.toLowerCase().includes(query));
                      }}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id}>
                          <Typography variant="body2" fontWeight={600}>
                            {option.label}
                          </Typography>
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
                        '& .MuiInputBase-input': { fontSize: '0.875rem' }
                      }}
                    />
                  </Stack>
                </Grid>

                {/* Existing Tenants */}
                {existingTenants.length > 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        ...sectionShellSx,
                        borderColor: isDark ? alpha(theme.palette.warning.main, 0.28) : alpha(theme.palette.warning.main, 0.2),
                        backgroundImage: isDark
                          ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0)} 48%)`
                          : `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0)} 58%)`
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Existing Tenants
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {existingTenants.map((tenant) => {
                            const fullName = `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || 'Unnamed Tenant';
                            const displayText = tenant.email ? `${fullName} (${tenant.email})` : fullName;
                            return (
                              <Chip 
                                key={tenant.id}
                                icon={<UserOutlined />}
                                label={displayText}
                                size="small"
                                variant="outlined"
                                sx={{ maxWidth: '100%' }}
                              />
                            );
                          })}
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                )}

                {/* Tenants as cards */}
                <FieldArray
                  name="tenants"
                  render={(arrayHelpers) => (
                    <Grid size={{ xs: 12 }}>
                      <Stack spacing={2}>
                        {values.tenants && values.tenants.length > 0 ? (
                          values.tenants.map((tenant, index) => {
                            const tenantErrors = errors.tenants?.[index];
                            const tenantTouched = touched.tenants?.[index];
                            const tenantId = tenant.id || `temp-${index}`;
                            const accountMethod = tenant.accountCreationMethod || 'create';

                            return (
                              <Card
                                key={tenantId}
                                variant="outlined"
                                sx={{
                                  overflow: 'hidden',
                                  borderRadius: 1,
                                  bgcolor: isDark ? alpha(theme.palette.common.white, 0.035) : theme.palette.background.paper,
                                  backgroundImage: 'none',
                                  border: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.16) : theme.palette.divider}`,
                                  borderLeft: `3px solid ${drawerAccent}`,
                                  boxShadow: 'none'
                                }}
                              >
                                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                                  <Stack spacing={0}>
                                    <Stack
                                      direction={{ xs: 'column', sm: 'row' }}
                                      spacing={1.5}
                                      alignItems={{ xs: 'stretch', sm: 'center' }}
                                      justifyContent="space-between"
                                      sx={{
                                        px: 2,
                                        py: 1.5,
                                        borderBottom: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.12) : theme.palette.divider}`,
                                        bgcolor: isDark ? alpha(theme.palette.common.white, 0.025) : alpha(theme.palette.grey[500], 0.035)
                                      }}
                                    >
                                      <Box>
                                        <Typography variant="subtitle2" fontWeight={800}>
                                          {tenant.firstname || tenant.lastname
                                            ? `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim()
                                            : `Tenant ${index + 1}`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {tenant.accountCreationMethod === 'create' ? 'Account will be created now' : 'Invitation email will be sent'}
                                        </Typography>
                                      </Box>
                                      <Stack
                                        direction="row"
                                        spacing={0.75}
                                        alignItems="center"
                                        justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
                                        useFlexGap
                                        flexWrap="wrap"
                                      >
                                        <FormControl component="fieldset">
                                          <RadioGroup
                                            row
                                            value={tenant.accountCreationMethod || 'invite'}
                                            onChange={(e) => {
                                              const method = e.target.value;
                                              setFieldValue(`tenants.${index}.accountCreationMethod`, method);

                                              if (method === 'create') {
                                                setFieldValue(`tenants.${index}.phoneNumber`, '');
                                              }

                                              if (method === 'invite') {
                                                setFieldValue(`tenants.${index}.password`, '');
                                                setPasswordLevels((prev) => {
                                                  const newLevels = { ...prev };
                                                  delete newLevels[tenantId];
                                                  return newLevels;
                                                });
                                              }
                                            }}
                                            sx={{
                                              gap: 0.75,
                                              flexWrap: 'wrap',
                                              '& .MuiFormControlLabel-root': {
                                                m: 0,
                                                px: 0.75,
                                                py: 0.25,
                                                minHeight: 32,
                                                borderRadius: 1,
                                                border: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.16) : theme.palette.divider}`,
                                                bgcolor: 'transparent'
                                              },
                                              '& .MuiFormControlLabel-root:has(.Mui-checked)': {
                                                borderColor: alpha(drawerAccent, 0.72),
                                                bgcolor: alpha(drawerAccent, isDark ? 0.12 : 0.07)
                                              },
                                              '& .MuiRadio-root': { p: 0.5 },
                                              '& .MuiFormControlLabel-label': {
                                                fontWeight: 700,
                                                fontSize: 12,
                                                whiteSpace: 'nowrap'
                                              }
                                            }}
                                          >
                                            <FormControlLabel value="invite" control={<Radio size="small" />} label="Send invite" />
                                            <FormControlLabel value="create" control={<Radio size="small" />} label="Create account" />
                                          </RadioGroup>
                                        </FormControl>
                                        {values.tenants.length > 1 && (
                                          <IconButton
                                            size="small"
                                            onClick={() => arrayHelpers.remove(index)}
                                            sx={{
                                              color: 'error.main',
                                              border: `1px solid ${alpha(theme.palette.error.main, 0.28)}`,
                                              borderRadius: 1
                                            }}
                                            title="Remove tenant"
                                          >
                                            <DeleteOutlined style={{ fontSize: 14 }} />
                                          </IconButton>
                                        )}
                                      </Stack>
                                    </Stack>

                                    <Box sx={{ p: 2 }}>
                                      <Grid container spacing={2}>
                                      {/* First and Last Name - always shown and required */}
                                      <Grid size={{ xs: 12, sm: 6 }}>
                                        <FormInput
                                          name={`tenants.${index}.firstname`}
                                          label="First Name"
                                          value={tenant.firstname}
                                          setFieldValue={setFieldValue}
                                          touched={submitCount > 0 && Boolean(tenantTouched?.firstname)}
                                          errorText={submitCount > 0 ? tenantErrors?.firstname : undefined}
                                        />
                                      </Grid>

                                      <Grid size={{ xs: 12, sm: 6 }}>
                                        <FormInput
                                          name={`tenants.${index}.lastname`}
                                          label="Last Name"
                                          value={tenant.lastname}
                                          setFieldValue={setFieldValue}
                                          touched={submitCount > 0 && Boolean(tenantTouched?.lastname)}
                                          errorText={submitCount > 0 ? tenantErrors?.lastname : undefined}
                                        />
                                      </Grid>

                                      {/* Email - always shown and required */}
                                      <Grid size={12}>
                                        <FormInput
                                          name={`tenants.${index}.email`}
                                          label="Email"
                                          type="email"
                                          value={tenant.email}
                                          setFieldValue={setFieldValue}
                                          touched={(submitCount > 0 && Boolean(tenantTouched?.email)) || Boolean(tenantTouched?.email)}
                                          errorText={typeof tenantErrors?.email === 'string' ? tenantErrors.email : undefined}
                                        />
                                      </Grid>


                                      {tenant.accountCreationMethod === 'create' && (
                                        <>
                                          <Grid size={12}>
                                            <FormControl
                                              fullWidth
                                              error={submitCount > 0 && Boolean(tenantTouched?.password && tenantErrors?.password)}
                                            >
                                              <InputLabel htmlFor={`password-${index}`}>Password</InputLabel>
                                              <OutlinedInput
                                                id={`password-${index}`}
                                                type={showPasswords[`${tenantId}-password`] ? 'text' : 'password'}
                                                value={tenant.password || ''}
                                                name={`tenants.${index}.password`}
                                                onBlur={() => {}}
                                                onChange={(e) => {
                                                  setFieldValue(`tenants.${index}.password`, e.target.value);
                                                  const temp = strengthIndicator(e.target.value);
                                                  setPasswordLevels((prev) => ({
                                                    ...prev,
                                                    [tenantId]: strengthColor(temp)
                                                  }));
                                                }}
                                                endAdornment={
                                                  <InputAdornment position="end">
                                                    <IconButton
                                                      aria-label="toggle password visibility"
                                                      onClick={() => {
                                                        setShowPasswords((prev) => ({
                                                          ...prev,
                                                          [`${tenantId}-password`]: !prev[`${tenantId}-password`]
                                                        }));
                                                      }}
                                                      onMouseDown={(e) => e.preventDefault()}
                                                      edge="end"
                                                      size="large"
                                                    >
                                                      {showPasswords[`${tenantId}-password`] ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                                    </IconButton>
                                                  </InputAdornment>
                                                }
                                                label="Password"
                                              />
                                              {submitCount > 0 && tenantTouched?.password && tenantErrors?.password && (
                                                <FormHelperText error>{tenantErrors.password}</FormHelperText>
                                              )}
                                            </FormControl>
                                          </Grid>

                                          {tenant.password && passwordLevels[tenantId] && (
                                            <Grid size={12}>
                                              <Stack spacing={1}>
                                                <Typography variant="body2">Password Strength</Typography>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                  <Box
                                                    sx={{
                                                      width: '100%',
                                                      height: 8,
                                                      borderRadius: '4px',
                                                      bgcolor: passwordLevels[tenantId]?.color || 'grey.300'
                                                    }}
                                                  />
                                                </Stack>
                                                <Typography variant="caption" color={passwordLevels[tenantId]?.color}>
                                                  {passwordLevels[tenantId]?.label}
                                                </Typography>
                                              </Stack>
                                            </Grid>
                                          )}
                                        </>
                                      )}
                                    </Grid>

                                    {/* Display validation errors at bottom of card - only after submit attempt */}
                                    {submitCount > 0 && tenantErrors && Object.keys(tenantErrors).length > 0 && (
                                      <Box sx={{ mt: 2, pt: 2, borderTop: (theme) => `1px solid ${alpha(theme.palette.error.main, 0.2)}` }}>
                                        <Typography variant="caption" color="error" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                                          Please fix the following errors:
                                        </Typography>
                                        <Stack spacing={0.5}>
                                          {Object.entries(tenantErrors).map(([field, error]) => {
                                            if (typeof error === 'string') {
                                              return (
                                                <Typography key={field} variant="caption" color="error" sx={{ display: 'block' }}>
                                                  • {error}
                                                </Typography>
                                              );
                                            }
                                            return null;
                                          })}
                                        </Stack>
                                      </Box>
                                    )}
                                  </Box>
                                  </Stack>
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : (
                          <Box
                            sx={{
                              p: 3,
                              textAlign: 'center',
                              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
                              borderRadius: 1,
                              border: (theme) => `1px dashed ${theme.palette.divider}`
                            }}
                          >
                            <UserOutlined style={{ fontSize: 32, color: theme.palette.text.disabled, marginBottom: 8 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              No tenants added yet.
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<PlusOutlined />}
                              onClick={() =>
                                arrayHelpers.push({
                                  firstname: '',
                                  lastname: '',
                                  email: '',
                                  phoneNumber: '',
                                  accountCreationMethod: 'invite',
                                  createAccount: false,
                                  password: '',
                                  tempId: Date.now()
                                })
                              }
                            >
                              Add Tenant
                            </Button>
                          </Box>
                        )}
                        {values.tenants && values.tenants.length > 0 && (
                          <Button
                            startIcon={<PlusOutlined />}
                            variant="outlined"
                            onClick={() => arrayHelpers.push({ firstname: '', lastname: '', email: '', phoneNumber: '', accountCreationMethod: 'invite', createAccount: false, password: '', tempId: Date.now() })}
                            sx={{
                              py: 1.15,
                              borderRadius: 1,
                              fontWeight: 700,
                              bgcolor: 'transparent',
                              borderColor: isDark ? alpha(theme.palette.common.white, 0.28) : theme.palette.divider,
                              '&:hover': {
                                bgcolor: alpha(drawerAccent, isDark ? 0.1 : 0.05),
                                borderColor: alpha(drawerAccent, 0.62)
                              }
                            }}
                          >
                            Add Another Tenant
                          </Button>
                        )}
                      </Stack>
                    </Grid>
                  )}
                />
              </Grid>
            </Box>

            <Divider sx={{ borderColor: isDark ? alpha(theme.palette.common.white, 0.08) : theme.palette.divider }} />

            {/* Footer */}
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                p: 2.5,
                justifyContent: 'flex-end',
                bgcolor: isDark ? alpha(theme.palette.common.black, 0.12) : alpha(theme.palette.background.paper, 0.86),
                backdropFilter: 'blur(10px)'
              }}
            >
              <Button
                variant="text"
                onClick={drawer.closeTenantAddDrawer}
                startIcon={<CloseOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                sx={{
                  color: 'text.secondary',
                  textTransform: 'none',
                  borderRadius: 1.5,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: isDark ? alpha(theme.palette.common.white, 0.06) : alpha(theme.palette.common.black, 0.04)
                  }
                }}
              >
                Cancel
              </Button>
              <Tooltip
                title={selectedProperty == null ? 'You must select a property before adding a tenant' : ''}
                arrow
                placement="top"
              >
                <span>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      isSubmitting
                      || !getPropertyId(selectedProperty)
                      || (isMultiUnitProperty(selectedProperty) && !resolvedSelectedUnit)
                    }
                    startIcon={<CheckOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                    sx={{
                      color: '#fff',
                      textTransform: 'none',
                      borderRadius: 1.75,
                      px: 2,
                      minHeight: 40,
                      fontWeight: 800,
                      boxShadow: isDark ? `0 12px 30px ${alpha(drawerAccent, 0.32)}` : `0 10px 22px ${alpha(drawerAccent, 0.22)}`,
                      '&:hover': {
                        boxShadow: isDark ? `0 14px 34px ${alpha(drawerAccent, 0.4)}` : `0 12px 26px ${alpha(drawerAccent, 0.28)}`
                      },
                      '&:disabled': {
                        color: 'text.disabled',
                        bgcolor: isDark ? alpha(theme.palette.common.white, 0.08) : alpha(theme.palette.action.disabled, 0.12),
                        boxShadow: 'none'
                      }
                    }}
                  >
                    Save Tenants
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Form>
        </LocalizationProvider>
      </FormikProvider>
    </ThemeAdaptiveDrawer>
  );
}

TenantAddDrawer.propTypes = {
  property: PropTypes.any
};
