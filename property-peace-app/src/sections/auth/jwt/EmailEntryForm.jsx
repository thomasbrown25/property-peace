import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';

const GOOGLE_OAUTH_MESSAGE_TYPE = 'GOOGLE_OAUTH_TOKEN';
import { motion } from 'framer-motion';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { Link } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Divider } from '@mui/material';
import { Stepper, Step, StepLabel } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { IconButton } from '@mui/material';
import { InputAdornment } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import axiosServices from 'utils/axios';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { formatPhoneInput } from 'utils/formatters';
import { passwordRequirementStatuses, validatePassword } from 'utils/password-validation';

// ============================|| EMAIL ENTRY FORM ||============================ //

const steps = {
  landlord: ['Account Type', 'Verification', 'Password', 'Personal Info', 'Business Info', 'Complete'],
  tenant: ['Account Type', 'Verification', 'Password', 'Personal Info', 'Complete']
};

/** Google sign-up button for email-entry step; only rendered when GoogleOAuthProvider is present. */
function GoogleSignUpButtonInForm({ userType, setGoogleError, onGoogleSuccess, isGoogleAuthInProgress }) {
  const { googleLogin } = useAuth();
  const { scriptLoadedSuccessfully: scriptReady } = useGoogleOAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse?.access_token;
      if (!accessToken) {
        setGoogleError('Failed to get access token from Google');
        return;
      }
      if (window.opener) {
        window.opener.postMessage(
          { type: GOOGLE_OAUTH_MESSAGE_TYPE, accessToken, userType },
          window.location.origin
        );
        setTimeout(() => window.close(), 100);
        return;
      }
      try {
        setGoogleError(null);
        setIsGoogleLoading(true);
        sessionStorage.setItem('registerUserType', userType);
        // Fetch name/email from Google before creating the account
        let googleUserInfo = null;
        try {
          const infoRes = await axiosServices.post('/api/user/google-user-info', { accessToken });
          console.groupCollapsed('[Google signup] /api/user/google-user-info response');
          console.log('success:', infoRes.data?.success);
          console.log('raw data:', infoRes.data?.data);
          console.log('raw keys:', Object.keys(infoRes.data?.data || {}));
          console.groupEnd();
          if (infoRes.data?.success && infoRes.data?.data) {
            const d = infoRes.data.data;
            const email = d.email || d.Email || '';
            const firstName = d.firstName || d.FirstName || d.given_name || '';
            const lastName = d.lastName || d.LastName || d.family_name || '';
            const picture = d.picture || d.Picture || '';
            console.log('[Google signup] normalized user info', { email, firstName, lastName, hasPicture: Boolean(picture) });
            sessionStorage.setItem('registerEmail', email);
            sessionStorage.setItem('registerFirstName', firstName);
            sessionStorage.setItem('registerLastName', lastName);
            if (picture) sessionStorage.setItem('registerProfileImageUrl', picture);
            sessionStorage.setItem('googleAccessToken', accessToken);
            googleUserInfo = { ...d, email, firstName, lastName, picture };
          }
        } catch (err) {
          console.warn('[Google signup] failed to fetch Google user info before signup step', err);
        }
        if (onGoogleSuccess) {
          onGoogleSuccess(googleUserInfo || {});
        } else {
          await googleLogin(accessToken);
        }
      } catch (err) {
        const errorMessage = err.message || err.toString() || 'Failed to sign up with Google';
        setGoogleError(errorMessage);
        openSnackbar({ open: true, message: errorMessage, variant: 'alert', alert: { color: 'error' } });
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (error) => {
      const errorMessage = error?.error || error?.message || 'Failed to sign up with Google';
      setGoogleError(errorMessage);
      setIsGoogleLoading(false);
      openSnackbar({ open: true, message: errorMessage, variant: 'alert', alert: { color: 'error' } });
    }
  });

  const loading = isGoogleLoading || isGoogleAuthInProgress;
  const disabled = !scriptReady || loading;

  return (
    <AnimateButton>
      <Button
        disableElevation
        fullWidth
        size="large"
        variant="outlined"
        disabled={disabled}
        onClick={() => {
          sessionStorage.setItem('registerUserType', userType);
          handleGoogleLogin();
        }}
        sx={{
          borderColor: 'divider',
          bgcolor: 'transparent',
          color: 'text.primary',
          py: 1.5,
          position: 'relative',
          zIndex: 10,
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'transparent',
            zIndex: 10
          }
        }}
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
      >
        {!scriptReady ? 'Loading Google Sign-In…' : loading ? 'Signing up…' : 'Sign up with Google'}
      </Button>
    </AnimateButton>
  );
}

GoogleSignUpButtonInForm.propTypes = {
  userType: PropTypes.string,
  setGoogleError: PropTypes.func.isRequired,
  onGoogleSuccess: PropTypes.func,
  isGoogleAuthInProgress: PropTypes.bool
};

export default function EmailEntryForm({ isDemo = false, userType = 'landlord', onNext, onGoogleSuccess, onBack, hideStepper = false }) {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();
  const [googleError, setGoogleError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleAuthInProgress, setIsGoogleAuthInProgress] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleOAuthEnabled = !!googleClientId;

  useEffect(() => {
    if (!isGoogleOAuthEnabled) return;
    const handler = async (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== GOOGLE_OAUTH_MESSAGE_TYPE) return;
      const { accessToken, userType: msgUserType } = event.data || {};
      if (!accessToken) return;
      const registerUserType = msgUserType || userType;
      sessionStorage.setItem('registerUserType', registerUserType);
      setGoogleError(null);
      setIsGoogleAuthInProgress(true);
      try {
        // When we're in the multi-step registration flow (onGoogleSuccess provided), store user data
        // and advance to next step instead of redirecting. User is created after org/business step.
        if (onGoogleSuccess) {
          const response = await axiosServices.post('/api/user/google-user-info', {
            accessToken
          });
          if (!response.data?.success || !response.data?.data) {
            throw new Error(response.data?.message || 'Failed to get Google user info');
          }
          const data = response.data.data;
          console.groupCollapsed('[Google signup popup] /api/user/google-user-info response');
          console.log('success:', response.data?.success);
          console.log('raw data:', data);
          console.log('raw keys:', Object.keys(data || {}));
          console.groupEnd();
          const email = data?.Email || data?.email || '';
          const firstName = data?.FirstName || data?.firstName || data?.given_name || '';
          const lastName = data?.LastName || data?.lastName || data?.family_name || '';
          const picture = data?.Picture || data?.picture || '';
          console.log('[Google signup popup] normalized user info', { email, firstName, lastName, hasPicture: Boolean(picture) });
          sessionStorage.setItem('googleAccessToken', accessToken);
          sessionStorage.setItem('registerEmail', email);
          sessionStorage.setItem('registerFirstName', firstName);
          sessionStorage.setItem('registerLastName', lastName);
          if (picture) sessionStorage.setItem('registerProfileImageUrl', picture);
          onGoogleSuccess({ ...data, email, firstName, lastName, picture });
        } else {
          await googleLogin(accessToken);
        }
      } catch (err) {
        const msg = err?.message || err?.toString?.() || 'Failed to sign up with Google';
        setGoogleError(msg);
        openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'error' } });
      } finally {
        setIsGoogleAuthInProgress(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isGoogleOAuthEnabled, googleLogin, userType, onGoogleSuccess, setGoogleError]);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const currentSteps = steps[userType] || steps.landlord;
  const currentStep = userType === 'landlord' ? 1 : 1;

  const inviteEmail = userType === 'landlord'
    ? sessionStorage.getItem('landlordInviteEmail')
    : sessionStorage.getItem('tenantInviteEmail');

  return (
    <>
      <Formik
        initialValues={{
          firstName: '',
          lastName: '',
          email: inviteEmail || '',
          phoneNumber: '',
          organizationName: '',
          password: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          firstName: userType === 'landlord' ? Yup.string().max(255).required('First name is required') : Yup.string().nullable(),
          lastName: userType === 'landlord' ? Yup.string().max(255).required('Last name is required') : Yup.string().nullable(),
          email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
          phoneNumber: userType === 'landlord' ? Yup.string().trim().max(50).required('Phone number is required') : Yup.string().nullable(),
          organizationName: userType === 'landlord' ? Yup.string().max(255).required('Business name is required') : Yup.string().nullable(),
          password: Yup.string()
            .required('Password is required')
            .test('api-password-rules', (value, context) => {
              const message = validatePassword(value || '');
              return message ? context.createError({ message }) : true;
            })
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            const trimmedEmail = values.email.trim().toLowerCase();

            // Store userType in sessionStorage
            sessionStorage.setItem('registerUserType', userType);

            // For landlord, store personal/business info collected on the first register step
            if (userType === 'landlord') {
              sessionStorage.setItem('registerFirstName', values.firstName.trim());
              sessionStorage.setItem('registerLastName', values.lastName.trim());
              sessionStorage.setItem('registerPhoneNumber', values.phoneNumber?.trim() || '');
              sessionStorage.setItem('registerOrganizationName', values.organizationName.trim());
            }

            // Store password
            sessionStorage.setItem('registerPassword', values.password);

            // Check if email already exists
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
              // If check fails, continue (let backend handle it)
            }

            // Email doesn't exist, send verification code
            try {
              const response = await axiosServices.post('/api/user/send-verification-code', {
                email: trimmedEmail
              });

              if (response.data?.success) {
                // Store email in sessionStorage for next step
                sessionStorage.setItem('registerEmail', trimmedEmail);
                
                // Call callback or navigate to verification step
                if (onNext) {
                  onNext(trimmedEmail);
                } else {
                  // Navigate to verification step
                  navigate('/register/email-verifier');
                }
              } else {
                setErrors({ submit: response.data?.message || 'Failed to send verification code' });
              }
            } catch (err) {
              console.error('Error sending verification code:', err);
              setErrors({ submit: err.response?.data?.message || 'Failed to send verification code' });
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ width: '100%' }}
          >
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
                    {currentSteps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
              )}

              {/* Title - use same top spacing as later steps so headers align */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              >
                <Box sx={{ textAlign: 'center', mb: 2, mt: { xs: 6, sm: 6, md: 0 } }}>
                  {onBack && userType !== 'landlord' && (
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
                  <Typography variant="h3" sx={{ fontWeight: 600, mb: 1.5, fontSize: { xs: '1.875rem', md: '2rem' }, color: 'text.primary' }}>
                    Sign up for Property Peace
                  </Typography>
                </Box>
              </motion.div>

            <form noValidate onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {/* Google Sign-In Button */}
                {isGoogleOAuthEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
                    style={{ padding: '8px 4px', overflow: 'visible', position: 'relative', zIndex: 10 }}
                  >
                    <GoogleSignUpButtonInForm
                      userType={userType}
                      setGoogleError={setGoogleError}
                      onGoogleSuccess={onGoogleSuccess}
                      isGoogleAuthInProgress={isGoogleAuthInProgress}
                    />
                  </motion.div>
                )}

                {/* Or Divider */}
                {isGoogleOAuthEnabled && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut", delay: 0.3 }}
                  >
                    <Divider sx={{ my: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600, px: 1 }}>OR</Typography>
                    </Divider>
                  </motion.div>
                )}

                  {/* First Name and Last Name - Only for landlord */}
                  {userType === 'landlord' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
                    >
                      <Stack direction="row" spacing={2}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                            First Name
                          </Typography>
                          <OutlinedInput
                            id="firstname-signup"
                            type="text"
                            value={values.firstName}
                            name="firstName"
                            onBlur={handleBlur}
                            onChange={handleChange}
                            placeholder=""
                            fullWidth
                            size="medium"
                            error={Boolean(touched.firstName && errors.firstName)}
                            sx={{
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.3)'
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main'
                              },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
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
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                            Last Name
                          </Typography>
                          <OutlinedInput
                            id="lastname-signup"
                            type="text"
                            value={values.lastName}
                            name="lastName"
                            onBlur={handleBlur}
                            onChange={handleChange}
                            placeholder=""
                            fullWidth
                            size="medium"
                            error={Boolean(touched.lastName && errors.lastName)}
                            sx={{
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.3)'
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main'
                              },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
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
                      </Stack>
                    </motion.div>
                  )}

                  {/* Email Input */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: userType === 'landlord' ? 0.5 : 0.4 }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                        Email
                      </Typography>
                      <OutlinedInput
                        id="email-signup"
                        type="email"
                        value={values.email}
                        name="email"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        placeholder=""
                        fullWidth
                        size="medium"
                        error={Boolean(touched.email && errors.email)}
                        sx={{
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(0, 0, 0, 0.3)'
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
                        <FormHelperText error sx={{ mt: 0.5 }}>
                          {errors.email}
                        </FormHelperText>
                      )}
                    </Box>
                  </motion.div>

                  {/* Password Input */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: userType === 'landlord' ? 0.6 : 0.5 }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                        Password
                      </Typography>
                      <OutlinedInput
                        fullWidth
                        size="medium"
                        error={Boolean(touched.password && errors.password)}
                        id="password-signup"
                        type={showPassword ? 'text' : 'password'}
                        value={values.password}
                        name="password"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        placeholder=""
                        endAdornment={
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={handleClickShowPassword}
                              onMouseDown={handleMouseDownPassword}
                              edge="end"
                              size="small"
                              sx={{ color: 'text.secondary' }}
                            >
                              {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                            </IconButton>
                          </InputAdornment>
                        }
                        sx={{
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(0, 0, 0, 0.3)'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'primary.main'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'primary.main'
                          }
                        }}
                      />
                      {touched.password && errors.password && (
                        <FormHelperText error sx={{ mt: 0.5 }}>
                          {errors.password}
                        </FormHelperText>
                      )}
                      {/* Live requirements */}
                      {values.password.length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                          {passwordRequirementStatuses(values.password).map(({ label, met }) => (
                            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.4,
                              px: 1, py: 0.25,
                              bgcolor: met ? 'success.lighter' : 'action.hover',
                              border: '1px solid', borderColor: met ? 'success.light' : 'divider' }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: met ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
                              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: met ? 'success.dark' : 'text.disabled' }}>{label}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </motion.div>

                  {/* Business Name - Only for landlord */}
                  {userType === 'landlord' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.7 }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                          Business Name
                        </Typography>
                        <OutlinedInput
                          id="business-name-signup"
                          type="text"
                          value={values.organizationName || ''}
                          name="organizationName"
                          onBlur={handleBlur}
                          onChange={handleChange}
                          placeholder=""
                          fullWidth
                          size="medium"
                          error={Boolean(touched.organizationName && errors.organizationName)}
                          inputProps={{ maxLength: 255 }}
                          sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(0, 0, 0, 0.3)'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main'
                            }
                          }}
                        />
                        {touched.organizationName && errors.organizationName && (
                          <FormHelperText error sx={{ mt: 0.5 }}>
                            {errors.organizationName}
                          </FormHelperText>
                        )}
                      </Box>
                    </motion.div>
                  )}

                  {/* Phone (Optional) - Only for landlord */}
                  {userType === 'landlord' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.75 }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                          Phone
                        </Typography>
                        <OutlinedInput
                          id="phone-signup"
                          type="tel"
                          value={values.phoneNumber || ''}
                          name="phoneNumber"
                          onBlur={handleBlur}
                          onChange={(e) => setFieldValue('phoneNumber', formatPhoneInput(e.target.value))}
                          placeholder=""
                          fullWidth
                          size="medium"
                          error={Boolean(touched.phoneNumber && errors.phoneNumber)}
                          sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(0, 0, 0, 0.3)'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main'
                            }
                          }}
                        />
                        {touched.phoneNumber && errors.phoneNumber && (
                          <FormHelperText error sx={{ mt: 0.5 }}>
                            {errors.phoneNumber}
                          </FormHelperText>
                        )}
                      </Box>
                    </motion.div>
                  )}

                  {/* Error Messages */}
                  {errors.submit && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormHelperText error sx={{ textAlign: 'center' }}>{errors.submit}</FormHelperText>
                    </motion.div>
                  )}
                  {googleError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormHelperText error sx={{ textAlign: 'center' }}>{googleError}</FormHelperText>
                    </motion.div>
                  )}

                  {/* Continue/Sign Up Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: userType === 'landlord' ? 0.7 : 0.5 }}
                  >
                    <AnimateButton>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                          disableElevation
                          disabled={isSubmitting}
                          size="large"
                          type="submit"
                          variant="contained"
                          color="primary"
                          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                          sx={(t) => ({
                            bgcolor: 'primary.main',
                            color: t.palette.mode === 'dark' ? '#000000' : '#ffffff',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            py: 1.5,
                            px: 6,
                            minWidth: 250,
                            '&:hover': {
                              bgcolor: 'primary.dark'
                            }
                          })}
                        >
                          {isSubmitting ? 'Processing...' : (userType === 'landlord' ? 'SIGN UP' : 'Continue')}
                        </Button>
                      </Box>
                    </AnimateButton>
                  </motion.div>

                  {/* Terms and Privacy Policy */}
                  {userType === 'landlord' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.8 }}
                    >
                      <Box sx={{ textAlign: 'center', pt: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                          By clicking the button above you are agreeing to our{' '}
                          <Link
                            component={RouterLink}
                            to="/terms"
                            sx={{
                              color: 'primary.main',
                              textDecoration: 'underline',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            Terms of Use
                          </Link>
                          {' & '}
                          <Link
                            component={RouterLink}
                            to="/privacy"
                            sx={{
                              color: 'primary.main',
                              textDecoration: 'underline',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            Privacy Policy
                          </Link>
                        </Typography>
                      </Box>
                    </motion.div>
                  )}
                </Stack>
              </form>
            </Box>
          </motion.div>
        )}
      </Formik>
    </>
  );
}

EmailEntryForm.propTypes = { 
  isDemo: PropTypes.bool,
  userType: PropTypes.oneOf(['landlord', 'tenant']).isRequired,
  onNext: PropTypes.func,
  onGoogleSuccess: PropTypes.func,
  hideStepper: PropTypes.bool
};
