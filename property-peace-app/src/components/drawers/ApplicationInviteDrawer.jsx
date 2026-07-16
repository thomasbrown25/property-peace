import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import CircularProgress from '@mui/material/CircularProgress';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import { useDrawer } from 'contexts/DrawerContext';
import FormInput from 'components/input/FormInput';
import PropertySelect from 'components/PropertySelect';
import Autocomplete from 'components/@extended/AutoComplete';
import { selectProperty } from 'store/property/property.selector';
import { openSnackbar } from 'api/snackbar';
import { applicationInviteAPI } from 'api';
import useAuth from 'hooks/useAuth';
import useFetchTenants from 'hooks/useFetchTenants';

// ==============================|| APPLICATION INVITE DRAWER ||============================== //

const InviteSchema = Yup.object().shape({
  propertyId: Yup.number().required('Property is required'),
  unitId: Yup.number().nullable(),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  applicantName: Yup.string().nullable()
});

const getInitialValues = () => ({
  selectedTenantId: null,
  propertyId: '',
  unitId: '',
  email: '',
  applicantName: ''
});

export default function ApplicationInviteDrawer() {
  const drawer = useDrawer();
  const { user } = useAuth();
  const selectedProperty = useSelector(selectProperty);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const { tenants } = useFetchTenants();

  // Get unit options for selected property
  const unitOptions = useMemo(() => {
    if (!selectedProperty?.units || selectedProperty.units.length === 0) return [];
    return selectedProperty.units.map((u) => ({
      value: u.id,
      label: u.name || `Unit ${u.id}`
    }));
  }, [selectedProperty]);

  // Tenant options for autocomplete
  const tenantOptions = useMemo(() => {
    if (!tenants || tenants.length === 0) return [];
    return tenants.map((tenant) => {
      const firstname = tenant.firstname || tenant.firstName || '';
      const lastname = tenant.lastname || tenant.lastName || '';
      return {
        id: tenant.id,
        label: `${firstname} ${lastname}`.trim() || 'Unnamed Tenant',
        email: tenant.email || '',
        phoneNumber: tenant.phoneNumber || '',
        firstName: firstname,
        lastName: lastname,
        tenant // Store full tenant object
      };
    });
  }, [tenants]);

  const formik = useFormik({
    initialValues: getInitialValues(),
    validationSchema: InviteSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      if (!user?.id) {
        openSnackbar({
          open: true,
          message: 'User not found',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setSubmitting(false);
        return;
      }

      try {
        setLoading(true);

        const payload = {
          propertyId: Number(values.propertyId),
          unitId: values.unitId ? Number(values.unitId) : null,
          email: values.email.trim(),
          applicantName: values.applicantName?.trim() || null
        };

        const response = await applicationInviteApi.createApplicationInvite(payload);

        if (response.success) {
          openSnackbar({
            open: true,
            message: 'Application invite sent successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });

          resetForm();
          drawer.closeApplicationInviteDrawer();
        } else {
          openSnackbar({
            open: true,
            message: response.message || 'Failed to send invite',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error sending invite:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to send invite';
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  // Handle tenant selection and auto-fill
  useEffect(() => {
    if (values.selectedTenantId) {
      const selectedTenant = tenantOptions.find((t) => t.id === values.selectedTenantId);
      if (selectedTenant) {
        setFieldValue('email', selectedTenant.email || '');
        setFieldValue('applicantName', `${selectedTenant.firstName || ''} ${selectedTenant.lastName || ''}`.trim() || '');
      }
    }
  }, [values.selectedTenantId, tenantOptions, setFieldValue]);

  // Initialize with selected property from Redux if available
  useEffect(() => {
    if (drawer.isOpenApplicationInvite && selectedProperty?.id) {
      setFieldValue('propertyId', selectedProperty.id);
      // Auto-select unit if single family
      if ((selectedProperty.propertyType === 'singleFamily' || selectedProperty.propertyType === 'SingleFamily') && selectedProperty.units?.[0]?.id) {
        setFieldValue('unitId', selectedProperty.units[0].id);
      }
    }
  }, [drawer.isOpenApplicationInvite, selectedProperty, setFieldValue]);

  // Reset unit when property changes
  useEffect(() => {
    if (selectedProperty?.id && selectedProperty.id === Number(values.propertyId)) {
      // Unit will be managed by the select component
    } else {
      setFieldValue('unitId', '');
    }
  }, [selectedProperty, setFieldValue, values.propertyId]);

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenApplicationInvite}
      onClose={drawer.closeApplicationInviteDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600, md: 700 },
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
          {/* Header */}
          <Toolbar sx={{ px: 2.5 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Send Application Invite
            </Typography>
            <IconButton onClick={drawer.closeApplicationInviteDrawer} size="large">
              <CloseOutlined />
            </IconButton>
          </Toolbar>
          <Divider />

          {/* Content */}
          <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
            <Stack spacing={3}>
              {/* Tenant Selection (Optional) */}
              {tenantOptions.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Select Existing Tenant (Optional)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    If the applicant already has a tenant account, select them to auto-fill their information.
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <Autocomplete
                        options={[{ id: null, label: 'New Applicant' }, ...tenantOptions]}
                        width="100%"
                        label="Select Tenant"
                        value={tenantOptions.find((opt) => opt.id === values.selectedTenantId) || { id: null, label: 'New Applicant' }}
                        onChange={(_, value) => {
                          setFieldValue('selectedTenantId', value?.id || null);
                          // Clear fields if "New Applicant" is selected
                          if (!value || !value.id) {
                            setFieldValue('email', '');
                            setFieldValue('applicantName', '');
                          }
                        }}
                        isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id)}
                        getOptionLabel={(option) => {
                          if (!option || option.id === null) return 'New Applicant';
                          const email = option.email ? ` (${option.email})` : '';
                          return `${option.label}${email}`;
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Property/Unit Selection */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Property & Unit
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <PropertySelect width="100%" disableAllOption={true} />
                    {touched.propertyId && errors.propertyId && (
                      <FormHelperText error sx={{ mt: 0.5, ml: 1.75 }}>
                        {errors.propertyId}
                      </FormHelperText>
                    )}
                  </Grid>
                  {selectedProperty &&
                    (selectedProperty.propertyType === 'multiUnit' || selectedProperty.propertyType === 'MultiUnit') &&
                    unitOptions.length > 0 && (
                      <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth error={touched.unitId && !!errors.unitId}>
                          <InputLabel>Unit (Optional)</InputLabel>
                          <Select
                            {...getFieldProps('unitId')}
                            label="Unit (Optional)"
                            value={values.unitId || ''}
                            onChange={(e) => setFieldValue('unitId', e.target.value || '')}
                          >
                            <MenuItem value="">
                              <em>None</em>
                            </MenuItem>
                            {unitOptions.map((unit) => (
                              <MenuItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.unitId && errors.unitId && <FormHelperText>{errors.unitId}</FormHelperText>}
                        </FormControl>
                      </Grid>
                    )}
                </Grid>
              </Box>

              <Divider />

              {/* Applicant Information */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Applicant Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('email')}
                      label="Email Address *"
                      type="email"
                      errorText={errors.email}
                      touched={touched.email}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('applicantName')}
                      label="Applicant Name (Optional)"
                      errorText={errors.applicantName}
                      touched={touched.applicantName}
                      helperText="This will personalize the email invitation"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          </Box>

          {/* Footer */}
          <Divider />
          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={drawer.closeApplicationInviteDrawer} disabled={loading || isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || isSubmitting}
              startIcon={loading || isSubmitting ? <CircularProgress size={16} /> : <SendOutlined />}
            >
              {loading || isSubmitting ? 'Sending...' : 'Send Invite'}
            </Button>
          </Box>
        </Form>
      </FormikProvider>
    </Drawer>
  );
}

