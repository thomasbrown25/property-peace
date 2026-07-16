import { useNavigate } from 'react-router-dom';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Stepper, Step, StepLabel } from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useScriptRef from 'hooks/useScriptRef';
import FormInput from 'components/input/FormInput';

// ============================|| BUSINESS INFO FORM ||============================ //

export default function BusinessInfoForm() {
  const navigate = useNavigate();
  const { register, user, isLoggedIn, updateUser } = useAuth();
  const scriptedRef = useScriptRef();

  // Get stored data from sessionStorage or from logged-in user
  const email = user?.Email || user?.email || sessionStorage.getItem('registerEmail') || '';
  const password = sessionStorage.getItem('registerPassword') || '';
  const firstName = user?.FirstName || user?.firstName || user?.Firstname || user?.firstname || sessionStorage.getItem('registerFirstName') || '';
  const lastName = user?.LastName || user?.lastName || user?.Lastname || user?.lastname || sessionStorage.getItem('registerLastName') || '';
  const phoneNumber = user?.PhoneNumber || user?.phoneNumber || sessionStorage.getItem('registerPhoneNumber') || '';
  const googleToken = sessionStorage.getItem('googleAccessToken');

  // Pre-fill business info with personal info as defaults, or from user if logged in
  const initialBusinessName = user?.BusinessName || user?.businessName || '';
  const initialBusinessEmail = user?.BusinessEmail || user?.businessEmail || email;
  const initialBusinessPhone = user?.BusinessPhone || user?.businessPhone || phoneNumber;

  const steps = ['Account Type', 'Verification', 'Password', 'Personal Info', 'Business Info', 'Complete'];
  const currentStep = 4; // Business Info is step 5 (0-indexed: 4)

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: { xs: '100%', sm: 450 },
        maxWidth: { xs: '100%', sm: 450 },
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
    >
      {/* Steps Indicator - Fixed position */}
      <Box 
        sx={{ 
          mb: 2,
          pt: 4,
          position: 'relative',
          minHeight: 80, // Fixed height to prevent movement
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Stepper activeStep={currentStep} alternativeLabel sx={{ width: '100%' }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Welcome Message */}
      <Box sx={{ textAlign: 'left', mb: 2 }}>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/register/personal-info')}
          variant="text"
          color="inherit"
          sx={{ mb: 2, p: 0, minWidth: 'auto' }}
        >
          Back
        </Button>
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
          Organization Info:
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Create your organization to manage your properties. You can add team members later. This can be your business name or your personal name.
        </Typography>
      </Box>

      <Formik
        initialValues={{
          businessName: initialBusinessName,
          businessEmail: initialBusinessEmail,
          businessPhone: initialBusinessPhone,
          submit: null
        }}
        validationSchema={Yup.object().shape({
          businessName: Yup.string().max(100).required('Organization name is required'),
          businessEmail: Yup.string().email('Must be a valid email').max(255).required('Business email is required'),
          businessPhone: Yup.string().nullable()
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            // If user is already logged in (e.g., from Google), update their account
            if (isLoggedIn && user) {
              // Update account with business information
              const response = await axiosServices.put('/api/user/update-account', {
                firstName: firstName,
                lastName: lastName,
                email: email,
                phoneNumber: phoneNumber || null,
                businessName: values.businessName.trim(),
                businessEmail: values.businessEmail.trim(),
                businessPhone: values.businessPhone?.trim() || null
              });

              if (response.data?.success && response.data?.data) {
                // Update local user state
                if (updateUser) {
                  updateUser({
                    FirstName: response.data.data.Firstname || response.data.data.firstname,
                    LastName: response.data.data.Lastname || response.data.data.lastname,
                    Email: response.data.data.Email || response.data.data.email,
                    PhoneNumber: response.data.data.PhoneNumber || response.data.data.phoneNumber,
                    BusinessName: response.data.data.BusinessName || response.data.data.businessName,
                    BusinessEmail: response.data.data.BusinessEmail || response.data.data.businessEmail,
                    BusinessPhone: response.data.data.BusinessPhone || response.data.data.businessPhone
                  });
                }

                // Clear sessionStorage
                sessionStorage.removeItem('registerEmail');
                sessionStorage.removeItem('registerPassword');
                sessionStorage.removeItem('registerFirstName');
                sessionStorage.removeItem('registerLastName');
                sessionStorage.removeItem('registerPhoneNumber');
                sessionStorage.removeItem('googleAccessToken');

                openSnackbar({
                  open: true,
                  message: 'Your registration has been successfully completed. Redirecting to dashboard...',
                  variant: 'alert',
                  alert: {
                    color: 'success'
                  }
                });

                // Redirect to dashboard - user is already signed in
                setTimeout(() => {
                  window.location.replace('/landlord/dashboard');
                }, 1500);
              } else {
                throw new Error(response.data?.message || 'Failed to update account information');
              }
            } else {
              // User is not logged in, register them (this will sign them in)
              await register(
                email,
                googleToken ? '' : password, // Empty string for Google (no password)
                firstName,
                lastName,
                phoneNumber || null,
                {
                  businessName: values.businessName.trim(),
                  businessEmail: values.businessEmail.trim(),
                  businessPhone: values.businessPhone?.trim() || null,
                  googleAccessToken: googleToken || null,
                  roles: ['Landlord'] // Default role
                }
              );

              if (scriptedRef.current) {
                // Clear sessionStorage
                sessionStorage.removeItem('registerEmail');
                sessionStorage.removeItem('registerPassword');
                sessionStorage.removeItem('registerFirstName');
                sessionStorage.removeItem('registerLastName');
                sessionStorage.removeItem('registerPhoneNumber');
                sessionStorage.removeItem('googleAccessToken');

                openSnackbar({
                  open: true,
                  message: 'Your registration has been successfully completed. Redirecting to dashboard...',
                  variant: 'alert',
                  alert: {
                    color: 'success'
                  }
                });

                // Redirect to dashboard - register() already signed them in
                setTimeout(() => {
                  window.location.replace('/landlord/dashboard');
                }, 1500);
              }
            }
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setErrors({ submit: err.response?.data?.message || err.message || 'Registration failed. Please try again.' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values, setFieldValue }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {/* Organization Name */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Organization Name *
                </Typography>
                <OutlinedInput
                  id="business-name-signup"
                  type="text"
                  value={values.businessName}
                  name="businessName"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder="Organization name"
                  fullWidth
                  size="small"
                  error={Boolean(touched.businessName && errors.businessName)}
                  inputProps={{ maxLength: 100 }}
                  sx={{
                    bgcolor: 'background.paper',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main'
                    }
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  {touched.businessName && errors.businessName ? (
                    <FormHelperText error>{errors.businessName}</FormHelperText>
                  ) : (
                    <Box />
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {values.businessName.length} / 100
                  </Typography>
                </Box>
              </Box>

              {/* Business Email */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Business Email *
                </Typography>
                <OutlinedInput
                  id="business-email-signup"
                  type="email"
                  value={values.businessEmail}
                  name="businessEmail"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder="Business email"
                  fullWidth
                  size="small"
                  error={Boolean(touched.businessEmail && errors.businessEmail)}
                  sx={{
                    bgcolor: 'background.paper',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main'
                    }
                  }}
                />
                {touched.businessEmail && errors.businessEmail && (
                  <FormHelperText error sx={{ mt: 0.5 }}>
                    {errors.businessEmail}
                  </FormHelperText>
                )}
              </Box>

              {/* Business Phone */}
              <FormInput
                name="businessPhone"
                label="Business Phone *"
                value={values.businessPhone || ''}
                setFieldValue={setFieldValue}
                placeholder="Business phone"
                valueType="phone"
                touched={Boolean(touched.businessPhone)}
                errorText={errors.businessPhone}
              />

              {/* Error Messages */}
              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

              {/* Continue Button */}
              <AnimateButton>
                <Button disableElevation disabled={isSubmitting} fullWidth size="small" type="submit" variant="contained" color="primary">
                  {isSubmitting ? 'Creating Account...' : 'Continue'}
                </Button>
              </AnimateButton>
            </Stack>
          </form>
        )}
      </Formik>
    </Box>
  );
}

