import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Grid } from '@mui/material';
import { Stepper, Step, StepLabel } from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import FormInput from 'components/input/FormInput';

// ============================|| PERSONAL INFO FORM ||============================ //

export default function PersonalInfoForm({ googleData, onNext, onBack, hideStepper = false }) {
  const navigate = useNavigate();

  // Pre-fill from Google if available
  // Get email from googleData (only show for Google OAuth registration)
  const initialEmail = googleData ? (googleData?.Email || googleData?.email || '') : '';
  const initialFirstName = googleData?.FirstName || googleData?.firstName || googleData?.given_name || '';
  const initialLastName = googleData?.LastName || googleData?.lastName || googleData?.family_name || '';
  const initialPhone = googleData?.PhoneNumber || googleData?.phoneNumber || '';

  const userType = sessionStorage.getItem('registerUserType') || 'landlord';
  const steps = userType === 'tenant' 
    ? ['Account Type', 'Verification', 'Password', 'Personal Info', 'Complete']
    : ['Account Type', 'Verification', 'Password', 'Personal Info', 'Business Info', 'Complete'];
  const currentStep = 3; // Personal info is step 4 (0-indexed: 3) for both tenant and landlord

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: { xs: '100%', sm: 400 },
        maxWidth: { xs: '100%', sm: 400 },
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
    >
      {/* Steps Indicator - Fixed position */}
      {!hideStepper && (
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
      )}

      {/* Welcome Message */}
      <Box sx={{ textAlign: 'center', mb: 2, mt: { xs: 6, sm: 6, md: 0 } }}>
        {onBack && (
          <Box sx={{ textAlign: 'left', mb: 2 }}>
            <Button
              startIcon={<ArrowLeftOutlined />}
              onClick={onBack}
              variant="text"
              color="inherit"
              sx={{ mb: 2, p: 0, minWidth: 'auto' }}
            >
              Back
            </Button>
          </Box>
        )}
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}>
          Help us verify your personal information
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          We want to learn more about you so that we can validate and protect your account.
        </Typography>
      </Box>

      <Formik
        initialValues={{
          firstName: initialFirstName,
          lastName: initialLastName,
          phoneNumber: initialPhone,
          submit: null
        }}
        validationSchema={Yup.object().shape({
          firstName: Yup.string().max(255).required('First name is required'),
          lastName: Yup.string().max(255).required('Last name is required'),
          phoneNumber: Yup.string().required('Phone number is required')
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            // Store personal info in sessionStorage
            sessionStorage.setItem('registerFirstName', values.firstName.trim());
            sessionStorage.setItem('registerLastName', values.lastName.trim());
            sessionStorage.setItem('registerPhoneNumber', values.phoneNumber?.trim() || '');
            
            // Call callback or navigate
            if (onNext) {
              onNext({
                firstName: values.firstName.trim(),
                lastName: values.lastName.trim(),
                phoneNumber: values.phoneNumber?.trim() || ''
              });
            } else {
              // Navigate to setting up profile page (which includes organization creation)
              navigate('/register/setting-up-profile');
            }
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setErrors({ submit: 'An error occurred. Please try again.' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values, setFieldValue }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {/* Email - Always show if available, disabled for Google OAuth */}
              {initialEmail && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                    Email
                  </Typography>
                  <OutlinedInput
                    id="email-signup"
                    type="email"
                    value={initialEmail}
                    name="email"
                    fullWidth
                    size="medium"
                    disabled
                    sx={{
                      bgcolor: 'action.disabledBackground',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'divider'
                      },
                      '&.Mui-disabled': {
                        bgcolor: 'action.disabledBackground',
                        color: 'text.disabled'
                      }
                    }}
                  />
                </Box>
              )}

              {/* First Name and Last Name - Side by Side */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      First Name *
                    </Typography>
                    <OutlinedInput
                      id="firstname-signup"
                      type="text"
                      value={values.firstName}
                      name="firstName"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="First name"
                      fullWidth
                      size="medium"
                      error={Boolean(touched.firstName && errors.firstName)}
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
                    {touched.firstName && errors.firstName && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {errors.firstName}
                      </FormHelperText>
                    )}
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      Last Name *
                    </Typography>
                    <OutlinedInput
                      id="lastname-signup"
                      type="text"
                      value={values.lastName}
                      name="lastName"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Last name"
                      fullWidth
                      size="medium"
                      error={Boolean(touched.lastName && errors.lastName)}
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
                    {touched.lastName && errors.lastName && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {errors.lastName}
                      </FormHelperText>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {/* Phone Number */}
              <FormInput
                name="phoneNumber"
                label="Phone *"
                value={values.phoneNumber || ''}
                setFieldValue={setFieldValue}
                placeholder="Phone number"
                valueType="phone"
                touched={Boolean(touched.phoneNumber)}
                errorText={errors.phoneNumber}
              />

              {/* Error Messages */}
              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

              {/* Continue Button */}
              <AnimateButton>
                <Button disableElevation disabled={isSubmitting} fullWidth size="medium" type="submit" variant="contained" color="primary">
                  Continue
                </Button>
              </AnimateButton>
            </Stack>
          </form>
        )}
      </Formik>
    </Box>
  );
}

PersonalInfoForm.propTypes = { 
  googleData: PropTypes.object,
  onNext: PropTypes.func,
  onBack: PropTypes.func,
  hideStepper: PropTypes.bool
};

