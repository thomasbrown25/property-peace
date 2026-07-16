import PropTypes from 'prop-types';
import { useEffect, useState, useRef, useMemo } from 'react';

// material-ui
import { 
  Box, 
  Button, 
  Drawer, 
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
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  FormHelperText,
  alpha,
  RadioGroup,
  Radio,
  FormLabel,
  useTheme
} from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import { HomeOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider, FieldArray } from 'formik';

// app
import { useDrawer } from 'contexts/DrawerContext';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import { openSnackbar } from 'api/snackbar';
import { strengthColor, strengthIndicator } from 'utils/password-strength';
import axiosServices from 'utils/axios';

// hooks
import { useDispatch, useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import useFetchTenants from 'hooks/useFetchTenants';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';

// api
import { addOrUpdateTenant } from 'store/tenant/tenant.action';
import { TENANT_ACTION_TYPES } from 'store/tenant/tenant.types';
import { tenantInviteAPI } from 'api';

// selectors
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import PropertySelect from '../PropertySelect';
import UnitSelect from '../UnitSelect';

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

export default function TenantAddDrawer() {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const theme = useTheme();

  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const { tenants = [], refetch: refetchTenants } = useFetchTenants();
  const previousPropertyIdRef = useRef(null);

  // Clear unit when property changes
  useEffect(() => {
    const currentPropertyId = selectedProperty?.id;
    if (previousPropertyIdRef.current !== null && previousPropertyIdRef.current !== currentPropertyId) {
      // Property changed, clear unit selection
      dispatch(setUnit(null));
    }
    previousPropertyIdRef.current = currentPropertyId;
  }, [selectedProperty?.id, dispatch]);

  // Filter existing tenants for the selected property/unit
  const existingTenants = useMemo(() => {
    if (!selectedProperty?.id) return [];
    
    let filtered = tenants.filter(t => t.propertyId === selectedProperty.id);
    
    // If it's a multi-unit property and a unit is selected, filter by unit as well
    const propertyType = selectedProperty.propertyType?.toLowerCase();
    const isMultiUnit = propertyType === 'multiunit' || propertyType === 'multifamily';
    if (isMultiUnit && selectedUnit?.id) {
      filtered = filtered.filter(t => t.unitId === selectedUnit.id);
    }
    
    return filtered;
  }, [tenants, selectedProperty, selectedUnit]);

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

        // Validate property is selected
        if (!selectedProperty?.id) {
          openSnackbar({
            open: true,
            message: 'Please select a property before adding tenants',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        // Validate unit is selected for multi-unit properties
        const propertyType = selectedProperty.propertyType?.toLowerCase();
        const isMultiUnit = propertyType === 'multiunit' || propertyType === 'multifamily';
        if (isMultiUnit && !selectedUnit?.id) {
          openSnackbar({
            open: true,
            message: 'Please select a unit before adding tenants',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        // Loop tenants and add each
        for (const t of values.tenants) {
          // Determine unitId
          let unitId = null;
          const propType = selectedProperty?.propertyType?.toLowerCase();
          if (propType === 'singlefamily') {
            unitId = selectedProperty?.units?.[0]?.id || null;
          } else if (selectedUnit?.id) {
            unitId = selectedUnit.id;
          }

          const tenantPayload = {
            PropertyId: selectedProperty?.id || null,
            UnitId: unitId,
            LeaseId: selectedProperty?.units?.find(u => u.id === unitId)?.lease?.id || null,
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
    <Drawer
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
                <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800, letterSpacing: 1.2, lineHeight: 1 }}>
                  Tenant intake
                </Typography>
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
                {/* Property + Units */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={sectionShellSx}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 1.5,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'primary.main',
                            bgcolor: alpha(drawerAccent, isDark ? 0.16 : 0.1),
                            border: `1px solid ${alpha(drawerAccent, isDark ? 0.26 : 0.18)}`
                          }}
                        >
                          <HomeOutlined />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                            Select the Property & Unit
                          </Typography>
                        </Box>
                      </Stack>
                      <PropertySelect disableAllOption label="" />
                    </Stack>
                  </Box>
                </Grid>
                {selectedProperty && (selectedProperty.propertyType?.toLowerCase() === 'multiunit' || 
                                     selectedProperty.propertyType?.toLowerCase() === 'multifamily') && (
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ ...sectionShellSx, py: 1.5 }}>
                      <UnitSelect width="100%" />
                    </Box>
                  </Grid>
                )}

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
                                  position: 'relative',
                                  overflow: 'hidden',
                                  borderRadius: 2.5,
                                  bgcolor: isDark ? alpha('#16263b', 0.78) : alpha(theme.palette.background.paper, 0.92),
                                  backgroundImage: isDark
                                    ? `linear-gradient(145deg, ${alpha(drawerAccent, 0.13)} 0%, ${alpha('#16263b', 0.78)} 42%, ${alpha('#0f1b2b', 0.9)} 100%)`
                                    : 'none',
                                  border: `1px solid ${isDark ? alpha(drawerAccent, 0.36) : alpha(theme.palette.divider, 0.9)}`,
                                  boxShadow: isDark
                                    ? `0 18px 44px ${alpha(theme.palette.common.black, 0.28)}, 0 0 0 1px ${alpha(drawerAccent, 0.12)}, 0 0 26px ${alpha(drawerAccent, 0.13)}`
                                    : `0 10px 28px ${alpha(theme.palette.grey[500], 0.08)}`,
                                  '&::before': isDark
                                    ? {
                                        content: '""',
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        width: '100%',
                                        height: 3,
                                        background: `linear-gradient(90deg, ${drawerAccent}, ${alpha(drawerAccent, 0.16)}, transparent)`
                                      }
                                    : undefined
                                }}
                              >
                                <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
                                  <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                      <Stack direction="row" spacing={1.25} alignItems="center">
                                        <Box
                                          sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            display: 'grid',
                                            placeItems: 'center',
                                            color: 'primary.main',
                                            bgcolor: alpha(drawerAccent, isDark ? 0.18 : 0.1),
                                            border: `1px solid ${alpha(drawerAccent, isDark ? 0.32 : 0.18)}`
                                          }}
                                        >
                                          <UserOutlined style={{ fontSize: 16 }} />
                                        </Box>
                                        <Box>
                                          <Typography variant="body1" fontWeight={800}>
                                            {tenant.firstname || tenant.lastname
                                              ? `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim()
                                              : `Tenant ${index + 1}`}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {tenant.accountCreationMethod === 'create' ? 'Create account now' : 'Invite link will be sent'}
                                          </Typography>
                                        </Box>
                                      </Stack>
                                      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="flex-end" sx={{ ml: 'auto' }}>
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
                                              justifyContent: 'flex-end',
                                              gap: 0.75,
                                              '& .MuiFormControlLabel-root': {
                                                m: 0,
                                                px: 0.75,
                                                py: 0.25,
                                                borderRadius: 1,
                                                border: 0,
                                                bgcolor: 'transparent'
                                              },
                                              '& .MuiRadio-root': {
                                                p: 0.5
                                              },
                                              '& .MuiFormControlLabel-label': {
                                                fontWeight: 800,
                                                fontSize: 13,
                                                lineHeight: 1.5,
                                                color: 'text.secondary'
                                              },
                                              '& .Mui-checked + .MuiFormControlLabel-label': { color: 'primary.main' },
                                              '& .MuiFormControlLabel-root:hover .MuiFormControlLabel-label': { color: 'primary.main' }
                                            }}
                                          >
                                            <FormControlLabel value="invite" control={<Radio size="small" />} label="Send Invite" />
                                            <FormControlLabel value="create" control={<Radio size="small" />} label="Create Account Now" />
                                          </RadioGroup>
                                        </FormControl>
                                        {values.tenants.length > 1 && (
                                          <IconButton
                                            size="small"
                                            onClick={() => arrayHelpers.remove(index)}
                                            sx={{ color: 'error.main', mt: 0.25 }}
                                            title="Remove Tenant"
                                          >
                                            <DeleteOutlined style={{ fontSize: 14 }} />
                                          </IconButton>
                                        )}
                                      </Stack>
                                    </Stack>

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
                              borderRadius: 2,
                              borderStyle: 'dashed',
                              fontWeight: 750,
                              bgcolor: isDark ? alpha(drawerAccent, 0.07) : alpha(drawerAccent, 0.035),
                              borderColor: alpha(drawerAccent, isDark ? 0.44 : 0.32),
                              '&:hover': {
                                borderStyle: 'dashed',
                                bgcolor: alpha(drawerAccent, isDark ? 0.13 : 0.07),
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
                    disabled={isSubmitting || selectedProperty == null}
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
    </Drawer>
  );
}

TenantAddDrawer.propTypes = {
  property: PropTypes.any
};
