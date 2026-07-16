import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import { motion } from 'framer-motion';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { Grid } from '@mui/material';
import { Link } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Divider } from '@mui/material';
import { IconButton } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { CircularProgress } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

import useAuth from 'hooks/useAuth';

const GOOGLE_OAUTH_MESSAGE_TYPE = 'GOOGLE_OAUTH_TOKEN';

// ============================|| JWT - LOGIN ||============================ //

/** Google sign-in button; only rendered when GoogleOAuthProvider is present. */
function GoogleSignInButton({ inviteToken, setGoogleError, isGoogleAuthInProgress }) {
  const { googleLogin } = useAuth();
  const { scriptLoadedSuccessfully: scriptReady } = useGoogleOAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLoginHook = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse?.access_token;
      if (!accessToken) {
        setGoogleError('Failed to get access token from Google');
        return;
      }
      if (window.opener) {
        window.opener.postMessage(
          { type: GOOGLE_OAUTH_MESSAGE_TYPE, accessToken },
          window.location.origin
        );
        setTimeout(() => window.close(), 100);
        return;
      }
      try {
        setGoogleError(null);
        setIsGoogleLoading(true);
        await googleLogin(accessToken, null, inviteToken);
      } catch (err) {
        console.error('Google login error:', err);
        setGoogleError(err.message || 'Failed to sign in with Google');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setGoogleError('Failed to sign in with Google');
      setIsGoogleLoading(false);
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
        onClick={handleGoogleLoginHook}
        sx={{
          borderColor: 'divider',
          bgcolor: 'transparent',
          color: 'text.primary',
          py: 1.5,
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'transparent'
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
        {!scriptReady ? 'Loading Google Sign-In…' : loading ? 'Signing in…' : 'Log in with Google'}
      </Button>
    </AnimateButton>
  );
}

GoogleSignInButton.propTypes = {
  inviteToken: PropTypes.string,
  setGoogleError: PropTypes.func.isRequired,
  isGoogleAuthInProgress: PropTypes.bool
};

export default function AuthLogin({ isDemo = false }) {
  const [googleError, setGoogleError] = useState(null);
  const [emailExistsError, setEmailExistsError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleAuthInProgress, setIsGoogleAuthInProgress] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleOAuthEnabled = !!googleClientId;
  const { login, googleLogin } = useAuth();

  const [rememberedEmail, setRememberedEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rememberedEmail') || '';
    }
    return '';
  });

  const [rememberEmail, setRememberEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('rememberedEmail');
    }
    return false;
  });

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const [searchParams] = useSearchParams();
  const auth = searchParams.get('auth');
  const errorParam = searchParams.get('error');
  const emailParam = searchParams.get('email');
  const inviteToken = searchParams.get('inviteToken');

  useEffect(() => {
    if (errorParam === 'email-exists' && emailParam) {
      setEmailExistsError(`An account with the email ${emailParam} already exists. Please sign in instead.`);
      const newSearchParams = new URLSearchParams(window.location.search);
      newSearchParams.delete('error');
      newSearchParams.delete('email');
      const newQuery = newSearchParams.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`);
    }
  }, [errorParam, emailParam]);

  useEffect(() => {
    if (!isGoogleOAuthEnabled) return;
    const handler = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== GOOGLE_OAUTH_MESSAGE_TYPE) return;
      const { accessToken } = event.data || {};
      if (!accessToken) return;
      setGoogleError(null);
      setIsGoogleAuthInProgress(true);
      googleLogin(accessToken, null, inviteToken)
        .catch((err) => {
          setGoogleError(err?.message || err?.toString?.() || 'Failed to sign in with Google');
        })
        .finally(() => {
          setIsGoogleAuthInProgress(false);
        });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isGoogleOAuthEnabled, googleLogin, inviteToken, setGoogleError]);

  return (
    <>
      <Formik
        initialValues={{
          email: rememberedEmail || '',
          password: '',
          submit: null
        }}
        enableReinitialize
        validationSchema={Yup.object().shape({
          email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
          password: Yup.string()
            .required('Password is required')
            .test('no-leading-trailing-whitespace', 'Password cannot start or end with spaces', (value) => value === value.trim())
            .max(50, 'Password must be less than 50 characters')
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            // Login with email and password
            const trimmedEmail = values.email.trim();

            // Save email to localStorage if "Remember Me" is checked
            if (rememberEmail) {
              localStorage.setItem('rememberedEmail', trimmedEmail);
              setRememberedEmail(trimmedEmail);
            } else {
              localStorage.removeItem('rememberedEmail');
              setRememberedEmail('');
            }

            await login(trimmedEmail, values.password);
            setStatus({ success: true });
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setStatus({ success: false });
            setErrors({ submit: err.message });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ width: '100%' }}
          >
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {/* Heading */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              >
                <Box sx={{ mb: 2, textAlign: 'center', mt: { xs: 18, sm: 18, md: 0 } }}>
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'text.primary', fontSize: '2rem' }}>
                    Welcome to Property Peace
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    Where property meets peace of mind.
                  </Typography>
                </Box>
              </motion.div>

              <form noValidate onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  {/* Google Sign-In Button - At Top */}
                  {isGoogleOAuthEnabled && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
                      style={{ padding: '0 4px', overflow: 'visible' }}
                    >
                      <GoogleSignInButton inviteToken={inviteToken} setGoogleError={setGoogleError} isGoogleAuthInProgress={isGoogleAuthInProgress} />
                    </motion.div>
                  )}

                  {/* Or Divider - Below Google Button */}
                  {isGoogleOAuthEnabled && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut", delay: 0.3 }}
                    >
                      <Divider sx={{ my: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, px: 1 }}>
                          OR
                        </Typography>
                      </Divider>
                    </motion.div>
                  )}

                  {/* Email Input */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                        Email
                      </Typography>
                      <OutlinedInput
                        id="email-login"
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
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.5 }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                        Password
                      </Typography>
                      <OutlinedInput
                        fullWidth
                        size="medium"
                        error={Boolean(touched.password && errors.password)}
                        id="password-login"
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
                    </Box>
                  </motion.div>

                  {/* Remember Email Checkbox and Forgot Password Link */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.6 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={rememberEmail}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setRememberEmail(isChecked);
                              // If unchecking, clear the remembered email
                              if (!isChecked) {
                                localStorage.removeItem('rememberedEmail');
                                setRememberedEmail('');
                              }
                            }}
                            name="rememberEmail"
                            color="primary"
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Remember Me
                          </Typography>
                        }
                      />
                      <Link
                        component={RouterLink}
                        to={isDemo ? '/auth/forgot-password' : auth ? `/${auth}/forgot-password?auth=jwt` : '/forgot-password'}
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          fontSize: '0.875rem',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        Forgot Password?
                      </Link>
                    </Box>
                  </motion.div>

                  {/* Login Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.7 }}
                  >
                    <AnimateButton>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                          disableElevation
                          disabled={isSubmitting}
                          size="large"
                          type="submit"
                          variant="contained"
                          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                          sx={{
                            bgcolor: '#22c55e',
                            color: '#ffffff',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            py: 1.5,
                            px: 6,
                            minWidth: 250,
                            boxShadow: '0 12px 24px rgba(34, 197, 94, 0.24)',
                            '&:hover': {
                              bgcolor: '#16a34a',
                              boxShadow: '0 14px 28px rgba(22, 163, 74, 0.28)'
                            },
                            '&.Mui-disabled': {
                              bgcolor: 'rgba(34, 197, 94, 0.55)',
                              color: '#ffffff'
                            }
                          }}
                        >
                          {isSubmitting ? 'LOGGING IN...' : 'LOG IN'}
                        </Button>
                      </Box>
                    </AnimateButton>
                  </motion.div>

                  {/* Error Messages */}
                  {emailExistsError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormHelperText error sx={{ mt: 1, mb: 1 }}>
                        {emailExistsError}
                      </FormHelperText>
                    </motion.div>
                  )}
                  {errors.submit && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormHelperText error>{errors.submit}</FormHelperText>
                    </motion.div>
                  )}
                  {googleError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormHelperText error>{googleError}</FormHelperText>
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

AuthLogin.propTypes = { isDemo: PropTypes.bool };
