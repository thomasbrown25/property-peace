import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { Link } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Stepper, Step, StepLabel } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { ArrowLeftOutlined } from '@ant-design/icons';

// ============================|| EMAIL VERIFIER FORM ||============================ //

export default function EmailVerifierForm({ email, onVerified, onBack, hideStepper = false }) {
  const navigate = useNavigate();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    try {
      setResendLoading(true);
      setResendSuccess(false);
      const response = await axiosServices.post('/api/user/send-verification-code', {
        email: email
      });

      if (response.data?.success) {
        setResendSuccess(true);
        openSnackbar({
          open: true,
          message: 'Verification code sent successfully',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
      } else {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Failed to resend code',
          variant: 'alert',
          alert: {
            color: 'error'
          }
        });
      }
    } catch (err) {
      console.error('Resend error:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to resend code',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setResendLoading(false);
    }
  };

  const userType = sessionStorage.getItem('registerUserType') || 'landlord';
  const steps = userType === 'tenant'
    ? ['Account Type', 'Verification', 'Password', 'Personal Info', 'Complete']
    : ['Account Type', 'Verification', 'Password', 'Personal Info', 'Business Info', 'Complete'];
  const currentStep = 1; // Email verification is step 2 (0-indexed: 1)

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
      {!hideStepper && userType !== 'tenant' && (
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

      {/* Pull up when Back is present so title aligns with "Sign up for Property Peace" */}
      <Box sx={{ textAlign: 'center', mb: 2, mt: onBack ? { xs: -3, sm: -3, md: -8 } : { xs: 6, sm: 6, md: 0 } }}>
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
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, textAlign: 'center', fontSize: { xs: '1.875rem', md: '2rem' }, color: '#061e35' }}>
          Verify Your Identity
        </Typography>
      </Box>

      <Formik
        initialValues={{
          code: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          code: Yup.string()
            .required('Verification code is required')
            .matches(/^\d{6}$/, 'Code must be 6 digits')
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            const response = await axiosServices.post('/api/user/verify-code', {
              email: email,
              code: values.code.trim()
            });

            if (response.data?.success) {
              // Mark email as verified
              sessionStorage.setItem('emailVerified', 'true');
              // Code verified successfully
              if (onVerified) {
                onVerified();
              } else {
                // Navigate to next step for standalone landlord flows
                navigate('/register/password');
              }
            } else {
              setErrors({ submit: response.data?.message || 'Invalid verification code' });
            }
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setErrors({ submit: err.response?.data?.message || 'Failed to verify code' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {/* Email Display */}
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  We've sent an email with your code to:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {email}
                </Typography>
              </Box>

              {/* Code Input */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Enter the 6-digit code*
                </Typography>
                <OutlinedInput
                  id="code-verification"
                  type="text"
                  value={values.code}
                  name="code"
                  onBlur={handleBlur}
                  onChange={(e) => {
                    // Only allow digits and limit to 6
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    handleChange({ target: { name: 'code', value } });
                  }}
                  placeholder="000000"
                  fullWidth
                  size="medium"
                  error={Boolean(touched.code && errors.code)}
                  inputProps={{
                    maxLength: 6,
                    style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.2rem', fontWeight: 600 }
                  }}
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
                {touched.code && errors.code && (
                  <FormHelperText error sx={{ mt: 0.5 }}>
                    {errors.code}
                  </FormHelperText>
                )}
              </Box>

              {/* Error Messages */}
              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

              {/* Continue Button - padding so hover scale isn't clipped */}
              <Box sx={{ py: 0.5, overflow: 'visible' }}>
                <AnimateButton>
                  <Button disableElevation disabled={isSubmitting} fullWidth size="medium" type="submit" variant="contained" color="primary">
                    Continue
                  </Button>
                </AnimateButton>
              </Box>

              {/* Resend Code Link */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Didn't receive a code?{' '}
                  <Link
                    component="button"
                    type="button"
                    onClick={handleResend}
                    disabled={resendLoading}
                    sx={{
                      color: 'primary.main',
                      textDecoration: 'none',
                      cursor: resendLoading ? 'not-allowed' : 'pointer',
                      '&:hover': {
                        textDecoration: 'underline'
                      },
                      '&:disabled': {
                        opacity: 0.5
                      }
                    }}
                  >
                    {resendLoading ? 'Sending...' : resendSuccess ? 'Code sent!' : 'Resend'}
                  </Link>
                </Typography>
              </Box>

              {/* Go Back Link */}
              <Box sx={{ textAlign: 'center' }}>
                {onBack ? (
                  <Link
                    component="button"
                    type="button"
                    onClick={onBack}
                    sx={{
                      color: 'primary.main',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    Go back
                  </Link>
                ) : (
                  <Link
                    component={RouterLink}
                    to="/register"
                    sx={{
                      color: 'primary.main',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    Go back
                  </Link>
                )}
              </Box>
            </Stack>
          </form>
        )}
      </Formik>
    </Box>
  );
}

EmailVerifierForm.propTypes = { 
  email: PropTypes.string.isRequired,
  onVerified: PropTypes.func,
  onBack: PropTypes.func,
  hideStepper: PropTypes.bool
};

