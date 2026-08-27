import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Grid,
  Stack,
  Typography,
  TextField,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Card,
  CardContent,
  InputAdornment,
  Tooltip,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import { InfoCircleOutlined, HomeOutlined, UserOutlined, FileTextOutlined, StarOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import FormInput from 'components/input/FormInput';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';
import { openSnackbar } from 'api/snackbar';
import { applicationInviteAPI } from 'api';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { formatCurrency } from 'utils/formatters';
import useFetchProperties from 'hooks/useFetchProperties';

const InviteSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  sendInviteBy: Yup.string().required('Please select how to send the invite'),
  email: Yup.string().email('Invalid email address').required('Email is required'), // Always required for API
  phoneNumber: Yup.string().when('sendInviteBy', {
    is: (val) => val === 'text' || val === 'both',
    then: (schema) => schema.required('Phone number is required when sending via text'),
    otherwise: (schema) => schema.nullable()
  }),
  propertyId: Yup.number().required('Property is required'),
  unitId: Yup.number().nullable(),
  rentAmount: Yup.number().min(0, 'Rent amount must be positive').nullable(),
  securityDeposit: Yup.number().min(0, 'Security deposit must be positive').nullable(),
  applicationType: Yup.string().required('Please select an application type')
});

const getInitialValues = (propertyId) => ({
  firstName: '',
  lastName: '',
  sendInviteBy: 'email',
  email: '',
  phoneNumber: '',
  propertyId: propertyId || '',
  unitId: '',
  rentAmount: '',
  securityDeposit: '',
  applicationType: 'standard' // 'premium' or 'standard'
});

export default function InviteRenter() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const selectedProperty = useSelector(selectProperty);
  const { properties } = useFetchProperties();
  const [loading, setLoading] = useState(false);
  const [propertyIdFromUrl, setPropertyIdFromUrl] = useState(null);

  // Get propertyId from URL if provided
  useEffect(() => {
    const propId = searchParams.get('propertyId');
    if (propId) {
      setPropertyIdFromUrl(Number(propId));
    }
  }, [searchParams]);

  const formik = useFormik({
    initialValues: getInitialValues(propertyIdFromUrl || selectedProperty?.id),
    validationSchema: InviteSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        setLoading(true);

        const payload = {
          propertyId: Number(values.propertyId),
          unitId: values.unitId ? Number(values.unitId) : null,
          email: values.email?.trim() || '',
          applicantName: `${values.firstName} ${values.lastName}`.trim() || null
        };

        const response = await applicationInviteAPI.createApplicationInvite(payload);

        if (response.success) {
          openSnackbar({
            open: true,
            message: 'Application invite sent successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });

          resetForm();
          navigate('/landlord/listings?tab=applications');
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

  // Sync propertyId with Redux selected property
  useEffect(() => {
    if (selectedProperty?.id) {
      if (String(values.propertyId) !== String(selectedProperty.id)) {
        setFieldValue('propertyId', selectedProperty.id);
      }
      // Auto-select unit if single family
      if ((selectedProperty.propertyType === 'singleFamily' || selectedProperty.propertyType === 'SingleFamily') 
          && selectedProperty.units?.[0]?.id 
          && !values.unitId) {
        setFieldValue('unitId', selectedProperty.units[0].id);
      }
    }
  }, [selectedProperty, setFieldValue, values.propertyId, values.unitId]);

  // Initialize property from URL
  useEffect(() => {
    if (propertyIdFromUrl && propertyIdFromUrl !== values.propertyId && properties) {
      // Find property and set in Redux (which will trigger the above effect)
      const property = properties.find(p => p.id === propertyIdFromUrl);
      if (property) {
        dispatch(setProperty(property));
      }
    }
  }, [propertyIdFromUrl, values.propertyId, dispatch, properties]);

  // Get rent amount and security deposit from selected property/unit if available
  useEffect(() => {
    if (selectedProperty && values.propertyId === selectedProperty.id) {
      // Try to get rent from active lease
      const activeLease = selectedProperty.units?.find(u => u.id === values.unitId)?.lease ||
                         selectedProperty.units?.[0]?.lease;
      if (activeLease) {
        const rentAmount = activeLease.rentAmount || activeLease.RentAmount || 0;
        const securityDeposit = activeLease.depositAmount || activeLease.DepositAmount || 0;
        if (rentAmount > 0 && !values.rentAmount) {
          setFieldValue('rentAmount', rentAmount);
        }
        if (securityDeposit > 0 && !values.securityDeposit) {
          setFieldValue('securityDeposit', securityDeposit);
        }
      }
    }
  }, [selectedProperty, values.propertyId, values.unitId, values.rentAmount, values.securityDeposit, setFieldValue]);

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Applications', path: '/landlord/listings?tab=applications' },
          { label: 'Invite Renter To Apply' }
        ]}
      />

      <MainCard
        sx={{
          mt: 3,
          maxWidth: 800,
          mx: 'auto'
        }}
      >
        <FormikProvider value={formik}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
            <Stack spacing={4}>
              {/* Title */}
              <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                Invite Renter To Apply
              </Typography>

              {/* Renter Info Section */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <UserOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    Renter Info
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('firstName')}
                      label="First Name"
                      errorText={errors.firstName}
                      touched={touched.firstName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('lastName')}
                      label="Last Name"
                      errorText={errors.lastName}
                      touched={touched.lastName}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <FormControl component="fieldset" error={touched.sendInviteBy && !!errors.sendInviteBy}>
                      <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
                        Send Invite By:
                      </FormLabel>
                      <RadioGroup
                        row
                        value={values.sendInviteBy}
                        onChange={(e) => setFieldValue('sendInviteBy', e.target.value)}
                      >
                        <FormControlLabel value="email" control={<Radio />} label="Email" />
                        <FormControlLabel value="text" control={<Radio />} label="Text" />
                        <FormControlLabel value="both" control={<Radio />} label="Email & Text" />
                      </RadioGroup>
                      {touched.sendInviteBy && errors.sendInviteBy && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                          {errors.sendInviteBy}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('email')}
                      label="Renter's Email"
                      type="email"
                      errorText={errors.email}
                      touched={touched.email}
                    />
                  </Grid>

                  {(values.sendInviteBy === 'text' || values.sendInviteBy === 'both') && (
                    <Grid size={{ xs: 12 }}>
                      <FormInput
                        {...getFieldProps('phoneNumber')}
                        label="Renter's Phone Number"
                        type="tel"
                        errorText={errors.phoneNumber}
                        touched={touched.phoneNumber}
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Rental Property Section */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <HomeOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    Rental Property
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <PropertySelect
                      width="100%"
                      disableAllOption={true}
                    />
                    {touched.propertyId && errors.propertyId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block', ml: 1.75 }}>
                        {errors.propertyId}
                      </Typography>
                    )}
                  </Grid>

                  {selectedProperty && (selectedProperty.propertyType === 'multiUnit' || selectedProperty.propertyType === 'MultiUnit') && (
                    <Grid size={{ xs: 12 }}>
                      <UnitSelect
                        propertyId={values.propertyId}
                        width="100%"
                        value={values.unitId}
                        onChange={(value) => setFieldValue('unitId', value)}
                      />
                    </Grid>
                  )}

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Rent Amount
                        <Tooltip title="Monthly rent amount for this property/unit">
                          <IconButton size="small" sx={{ p: 0, minWidth: 'auto' }}>
                            <InfoCircleOutlined style={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </FormLabel>
                      <TextField
                        {...getFieldProps('rentAmount')}
                        type="number"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>
                        }}
                        error={touched.rentAmount && !!errors.rentAmount}
                        helperText={touched.rentAmount && errors.rentAmount}
                      />
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Security Deposit
                        <Tooltip title="Security deposit amount required for this property/unit">
                          <IconButton size="small" sx={{ p: 0, minWidth: 'auto' }}>
                            <InfoCircleOutlined style={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </FormLabel>
                      <TextField
                        {...getFieldProps('securityDeposit')}
                        type="number"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>
                        }}
                        error={touched.securityDeposit && !!errors.securityDeposit}
                        helperText={touched.securityDeposit && errors.securityDeposit}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>

              {/* Application Type Section */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <FileTextOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    Application Type
                  </Typography>
                </Stack>

                <FormControl component="fieldset" error={touched.applicationType && !!errors.applicationType} fullWidth>
                  <RadioGroup
                    value={values.applicationType}
                    onChange={(e) => setFieldValue('applicationType', e.target.value)}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        mb: 2,
                        border: values.applicationType === 'premium' ? `2px solid ${theme.palette.primary.main}` : '1px solid',
                        borderColor: values.applicationType === 'premium' ? 'primary.main' : 'divider',
                        position: 'relative',
                        cursor: 'pointer',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                      onClick={() => setFieldValue('applicationType', 'premium')}
                    >
                      <CardContent>
                        <Stack direction="row" alignItems="flex-start" spacing={2}>
                          <Radio value="premium" checked={values.applicationType === 'premium'} />
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                INCLUDED WITH PREMIUM
                              </Typography>
                              <StarOutlined style={{ fontSize: 16, color: theme.palette.warning.main }} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Background, Eviction, Credit + <strong>Income Analysis</strong>
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                {formatCurrency(55)}
                              </Typography>
                              <Typography variant="h6" fontWeight={700} color="primary.main">
                                {formatCurrency(45)} fee
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card
                      variant="outlined"
                      sx={{
                        border: values.applicationType === 'standard' ? `2px solid ${theme.palette.primary.main}` : '1px solid',
                        borderColor: values.applicationType === 'standard' ? 'primary.main' : 'divider',
                        cursor: 'pointer',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                      onClick={() => setFieldValue('applicationType', 'standard')}
                    >
                      <CardContent>
                        <Stack direction="row" alignItems="flex-start" spacing={2}>
                          <Radio value="standard" checked={values.applicationType === 'standard'} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                              STANDARD SCREENING REPORT
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Background, Eviction, Credit Only
                            </Typography>
                            <Typography variant="h6" fontWeight={700} color="text.primary">
                              {formatCurrency(55)} fee
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </RadioGroup>
                  {touched.applicationType && errors.applicationType && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                      {errors.applicationType}
                    </Typography>
                  )}
                </FormControl>
              </Box>

              {/* Action Buttons */}
              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(-1)}
                  disabled={loading || isSubmitting}
                  sx={{
                    textTransform: 'none',
                    minWidth: 120
                  }}
                >
                  CANCEL
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || isSubmitting}
                  sx={{
                    textTransform: 'none',
                    minWidth: 120
                  }}
                >
                  {loading || isSubmitting ? 'Sending...' : 'INVITE'}
                </Button>
              </Stack>
            </Stack>
          </Form>
        </FormikProvider>
      </MainCard>
    </Box>
  );
}
