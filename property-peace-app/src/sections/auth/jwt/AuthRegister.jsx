import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';

/** Message type for passing Google token from OAuth popup to opener window */
const GOOGLE_OAUTH_MESSAGE_TYPE = 'GOOGLE_OAUTH_TOKEN';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { Link } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Divider } from '@mui/material';
import { RadioGroup } from '@mui/material';
import { FormControl } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { Radio } from '@mui/material';
import { Alert } from '@mui/material';
import { CircularProgress } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import axiosServices from 'utils/axios';

import useAuth from 'hooks/useAuth';
import useScriptRef from 'hooks/useScriptRef';
import { openSnackbar } from 'api/snackbar';

// ============================|| JWT - REGISTER ||============================ //

/** Google sign-up button; only rendered when GoogleOAuthProvider is present (client ID set). */
function GoogleSignUpButton({ userType, values, setUserType, googleError, setGoogleError, isGoogleAuthInProgress }) {
  const { googleLogin } = useAuth();
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse?.access_token;
      if (!accessToken) {
        setGoogleError('Failed to get access token from Google');
        return;
      }
      // OAuth callback runs in the popup; API and redirect must run in the opener (main window)
      if (window.opener) {
        window.opener.postMessage(
          { type: GOOGLE_OAUTH_MESSAGE_TYPE, accessToken, userType: values.userType },
          window.location.origin
        );
        // Defer close so postMessage is delivered before popup closes (helps with COOP)
        setTimeout(() => window.close(), 100);
        return;
      }
      try {
        setGoogleError(null);
        setIsGoogleLoading(true);
        sessionStorage.setItem('registerUserType', userType);
        await googleLogin(accessToken);
      } catch (err) {
        console.error('Google registration error:', err);
        setGoogleError(err.message || 'Failed to sign up with Google');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setGoogleError('Failed to sign up with Google');
      setIsGoogleLoading(false);
    }
  });

  const handleClick = () => {
    if (userType === 'tenant') return;
    setUserType(values.userType);
    sessionStorage.setItem('registerUserType', values.userType);
    handleGoogleLogin();
  };

  const scriptReady = scriptLoadedSuccessfully;
  const loading = isGoogleLoading || isGoogleAuthInProgress;
  const disabled = userType === 'tenant' || !scriptReady || loading;

  return (
    <AnimateButton>
      <Button
        disableElevation
        fullWidth
        size="medium"
        variant="outlined"
        onClick={handleClick}
        disabled={disabled}
        startIcon={
          loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <g fill="#000" fillRule="evenodd">
                <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335" />
                <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.18-1.79 2.85l2.84 2.2c1.7-1.57 2.68-3.88 2.63-6.55z" fill="#4285F4" />
                <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05" />
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853" />
              </g>
            </svg>
          )
        }
        sx={{
          borderColor: 'divider',
          color: 'text.primary',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover'
          }
        }}
      >
        {!scriptReady ? 'Loading Google Sign-In…' : loading ? 'Signing up…' : 'Sign up with Google'}
      </Button>
    </AnimateButton>
  );
}

GoogleSignUpButton.propTypes = {
  userType: PropTypes.string,
  values: PropTypes.object,
  setUserType: PropTypes.func,
  googleError: PropTypes.string,
  setGoogleError: PropTypes.func,
  isGoogleAuthInProgress: PropTypes.bool
};

export default function AuthRegister({ isDemo = false }) {
  const scriptedRef = useScriptRef();
  const navigate = useNavigate();
  const { googleLogin } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleOAuthEnabled = !!googleClientId;

  const [googleError, setGoogleError] = useState(null);
  const [userType, setUserType] = useState('landlord');
  const [isGoogleAuthInProgress, setIsGoogleAuthInProgress] = useState(false);

  // When OAuth completes in the popup, the popup posts the token here; we run login/redirect in the opener
  useEffect(() => {
    if (!isGoogleOAuthEnabled) return;
    const handler = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== GOOGLE_OAUTH_MESSAGE_TYPE) return;
      const { accessToken, userType: msgUserType } = event.data || {};
      if (!accessToken) return;
      const registerUserType = msgUserType || sessionStorage.getItem('registerUserType') || 'landlord';
      sessionStorage.setItem('registerUserType', registerUserType);
      setGoogleError(null);
      setIsGoogleAuthInProgress(true);
      googleLogin(accessToken)
        .catch((err) => {
          setGoogleError(err?.message || err?.toString?.() || 'Failed to sign up with Google');
        })
        .finally(() => {
          setIsGoogleAuthInProgress(false);
        });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isGoogleOAuthEnabled, googleLogin, setGoogleError]);

  return (
    <>
      <Formik
        initialValues={{
          userType: 'landlord',
          email: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          userType: Yup.string().oneOf(['landlord', 'tenant']).required('Please select whether you are a landlord or tenant'),
          email: Yup.string().email('Must be a valid email').max(255).required('Email is required')
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            // If tenant is selected, don't proceed
            if (values.userType === 'tenant') {
              setErrors({ submit: 'Please contact your landlord to receive your sign up link.' });
              setSubmitting(false);
              return;
            }

            const trimmedEmail = values.email.trim().toLowerCase();

            // Store userType in sessionStorage
            sessionStorage.setItem('registerUserType', values.userType);

            // Check if email already exists before sending verification code
            try {
              const emailCheckResponse = await axiosServices.post('/api/user/check-email', {
                email: trimmedEmail
              });

              if (emailCheckResponse.data?.success && emailCheckResponse.data?.data === true) {
                // Email exists, redirect to login with error message
                const loginPath = isDemo ? '/auth/login' : '/login';
                navigate(`${loginPath}?error=email-exists&email=${encodeURIComponent(trimmedEmail)}`, { replace: true });
                setSubmitting(false);
                return;
              }
            } catch (emailCheckErr) {
              console.error('Error checking email:', emailCheckErr);
              // If check fails, continue with verification (let backend handle it)
            }

            // Email doesn't exist, proceed with sending verification code
            const response = await axiosServices.post('/api/user/send-verification-code', {
              email: trimmedEmail
            });

            if (response.data?.success) {
              // Store email in sessionStorage for next step
              sessionStorage.setItem('registerEmail', trimmedEmail);
              // Navigate to email verification page
              navigate('/register/email-verifier');
            } else {
              setErrors({ submit: response.data?.message || 'Failed to send verification code' });
            }
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setErrors({ submit: err.response?.data?.message || 'Failed to send verification code' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values, setFieldValue }) => (
          <Box
            sx={{
              width: '100%',
              minWidth: { xs: '100%', sm: 520 },
              maxWidth: { xs: '100%', sm: 520 },
              mx: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 3
            }}
          >
            {/* Welcome Message */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h2" sx={{ fontWeight: 600, mb: 1.5, fontSize: { xs: '1.875rem', md: '2rem' } }}>
                Start Free
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1, fontSize: { xs: '0.9375rem', md: '1rem' }, fontWeight: 400 }}>
                Free for up to 5 units. No credit card required. It takes just 30 seconds to get started.
              </Typography>
            </Box>

            <form noValidate onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {/* User Type Selection */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body1" sx={{ mb: 1.5, color: 'text.secondary' }}>
                    Are you a landlord or a tenant? *
                  </Typography>
                  <FormControl component="fieldset" error={Boolean(touched.userType && errors.userType)} sx={{ width: '100%', alignItems: 'center' }}>
                    <RadioGroup 
                      row 
                      name="userType" 
                      value={values.userType} 
                      onChange={(e) => {
                        handleChange(e);
                        setUserType(e.target.value); // Update state when userType changes
                      }} 
                      sx={{ gap: 2, justifyContent: 'center' }}
                    >
                      <FormControlLabel
                        value="landlord"
                        control={<Radio size="small" />}
                        label="Landlord"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.875rem'
                          }
                        }}
                      />
                      <FormControlLabel
                        value="tenant"
                        control={<Radio size="small" />}
                        label="Tenant"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.875rem'
                          }
                        }}
                      />
                    </RadioGroup>
                    {touched.userType && errors.userType && (
                      <FormHelperText error sx={{ mt: 0.5, textAlign: 'center' }}>
                        {errors.userType}
                      </FormHelperText>
                    )}
                  </FormControl>
                </Box>

                {/* Tenant Message */}
                {values.userType === 'tenant' && (
                  <Alert severity="info">
                    <Typography variant="body2">
                      To sign up as a tenant, please reach out to your landlord to receive your sign up link.
                    </Typography>
                  </Alert>
                )}

                {/* Google Sign-In Button - only when OAuth is configured and inside GoogleOAuthProvider */}
                {isGoogleOAuthEnabled && (
                  <GoogleSignUpButton
                    userType={userType}
                    values={values}
                    setUserType={setUserType}
                    googleError={googleError}
                    setGoogleError={setGoogleError}
                    isGoogleAuthInProgress={isGoogleAuthInProgress}
                  />
                )}

                {isGoogleOAuthEnabled && (
                  <Divider sx={{ my: 1 }}>
                    <Typography variant="caption">OR</Typography>
                  </Divider>
                )}

                {/* Email Input */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                    Email
                  </Typography>
                  <OutlinedInput
                    id="email-signup"
                    type="email"
                    value={values.email}
                    name="email"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    placeholder="Your email address"
                    fullWidth
                    size="medium"
                    error={Boolean(touched.email && errors.email)}
                    sx={{
                      bgcolor: 'background.paper',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'divider'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main'
                      }
                    }}
                  />
                  {touched.email && errors.email && (
                    <FormHelperText error sx={{ mt: 0.5, textAlign: 'center' }}>
                      {errors.email}
                    </FormHelperText>
                  )}
                </Box>

                {/* Error Messages */}
                {errors.submit && <FormHelperText error sx={{ textAlign: 'center' }}>{errors.submit}</FormHelperText>}
                {googleError && <FormHelperText error sx={{ textAlign: 'center' }}>{googleError}</FormHelperText>}

                {/* Continue Button */}
                <AnimateButton>
                  <Button
                    disableElevation
                    disabled={isSubmitting || values.userType === 'tenant'}
                    fullWidth
                    size="medium"
                    type="submit"
                    variant="contained"
                    color="primary"
                  >
                    Continue
                  </Button>
                </AnimateButton>

                {/* Sign In Link */}
                <Box sx={{ textAlign: 'center', pt: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Already have an account?{' '}
                    <Link
                      component={RouterLink}
                      to={isDemo ? '/auth/login' : '/login'}
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      Sign in
                    </Link>
                  </Typography>
                </Box>
              </Stack>
            </form>
          </Box>
        )}
      </Formik>
    </>
  );
}

AuthRegister.propTypes = { isDemo: PropTypes.bool };
