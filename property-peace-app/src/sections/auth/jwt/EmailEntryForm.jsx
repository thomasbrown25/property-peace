import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormHelperText,
  IconButton,
  InputAdornment,
  Link,
  OutlinedInput,
  Stack,
  Typography
} from '@mui/material';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import * as Yup from 'yup';
import { Formik } from 'formik';
import axiosServices from 'utils/axios';
import useAuth from 'hooks/useAuth';
import { passwordRequirementStatuses, validatePassword } from 'utils/password-validation';

const GOOGLE_OAUTH_MESSAGE_TYPE = 'GOOGLE_OAUTH_TOKEN';

function normalizeGoogleProfile(data) {
  return {
    ...data,
    email: data?.email || data?.Email || '',
    firstName: data?.firstName || data?.FirstName || data?.given_name || '',
    lastName: data?.lastName || data?.LastName || data?.family_name || '',
    picture: data?.picture || data?.Picture || ''
  };
}

function saveGoogleProfile(profile, accessToken, userType) {
  if (!profile.email) throw new Error('Google did not return an email address. Please use email and password instead.');
  sessionStorage.setItem('registerUserType', userType);
  sessionStorage.setItem('registerEmail', profile.email.trim().toLowerCase());
  sessionStorage.setItem('registerFirstName', profile.firstName.trim());
  sessionStorage.setItem('registerLastName', profile.lastName.trim());
  if (profile.picture) sessionStorage.setItem('registerProfileImageUrl', profile.picture);
  sessionStorage.setItem('googleAccessToken', accessToken);
}

function GoogleButton({ userType, onGoogleSuccess, setGoogleError, externalLoading }) {
  const { googleLogin } = useAuth();
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const [loading, setLoading] = useState(false);
  const login = useGoogleLogin({
    onSuccess: async ({ access_token: accessToken }) => {
      if (!accessToken) return setGoogleError('Google sign-up could not be completed. Please try again.');
      if (window.opener) {
        window.opener.postMessage({ type: GOOGLE_OAUTH_MESSAGE_TYPE, accessToken, userType }, window.location.origin);
        setTimeout(() => window.close(), 100);
        return;
      }
      setLoading(true);
      setGoogleError(null);
      try {
        if (!onGoogleSuccess) return await googleLogin(accessToken);
        const response = await axiosServices.post('/api/user/google-user-info', { accessToken });
        if (!response.data?.success || !response.data?.data)
          throw new Error(response.data?.message || 'We could not retrieve your Google profile.');
        const profile = normalizeGoogleProfile(response.data.data);
        saveGoogleProfile(profile, accessToken, userType);
        onGoogleSuccess(profile);
      } catch (error) {
        const message = error.response?.data?.message || error.message || 'Google sign-up could not be completed. Please try again.';
        setGoogleError(message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => setGoogleError('Google sign-up was cancelled or could not be completed.')
  });
  const busy = loading || externalLoading;
  return (
    <Button
      fullWidth
      size="large"
      variant="outlined"
      disabled={!scriptLoadedSuccessfully || busy}
      onClick={login}
      startIcon={
        busy ? (
          <CircularProgress size={18} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="#000" fillRule="evenodd">
              <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335" />
              <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.18-1.79 2.85l2.84 2.2c1.7-1.57 2.68-3.88 2.63-6.55z" fill="#4285F4" />
              <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05" />
              <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853" />
            </g>
          </svg>
        )
      }
      sx={{ py: 1.35, textTransform: 'none' }}
    >
      {busy ? 'Connecting to Google…' : 'Continue with Google'}
    </Button>
  );
}

GoogleButton.propTypes = {
  userType: PropTypes.string,
  onGoogleSuccess: PropTypes.func,
  setGoogleError: PropTypes.func,
  externalLoading: PropTypes.bool
};

function TransitionIn({ children, delay, disabled }) {
  return (
    <motion.div
      initial={disabled ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: disabled ? 0 : 0.4, ease: 'easeOut', delay: disabled ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

TransitionIn.propTypes = {
  children: PropTypes.node.isRequired,
  delay: PropTypes.number,
  disabled: PropTypes.bool
};

export default function EmailEntryForm({
  isDemo = false,
  userType = 'landlord',
  onNext,
  onGoogleSuccess,
  onBack,
  initialEmail = '',
  emailAlreadyVerified = false,
  resumeMessage = ''
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { googleLogin } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const oauthEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!oauthEnabled) return undefined;
    const receiveToken = async (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== GOOGLE_OAUTH_MESSAGE_TYPE || !event.data.accessToken) return;
      setPopupLoading(true);
      setGoogleError(null);
      try {
        if (!onGoogleSuccess) return await googleLogin(event.data.accessToken);
        const response = await axiosServices.post('/api/user/google-user-info', { accessToken: event.data.accessToken });
        if (!response.data?.success || !response.data?.data)
          throw new Error(response.data?.message || 'We could not retrieve your Google profile.');
        const profile = normalizeGoogleProfile(response.data.data);
        saveGoogleProfile(profile, event.data.accessToken, event.data.userType || userType);
        onGoogleSuccess(profile);
      } catch (error) {
        setGoogleError(error.response?.data?.message || error.message || 'Google sign-up could not be completed.');
      } finally {
        setPopupLoading(false);
      }
    };
    window.addEventListener('message', receiveToken);
    return () => window.removeEventListener('message', receiveToken);
  }, [googleLogin, oauthEnabled, onGoogleSuccess, userType]);

  return (
    <Formik
      initialValues={{ email: initialEmail, password: '', submit: null }}
      enableReinitialize
      validationSchema={Yup.object({
        email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
        password: Yup.string()
          .required('Password is required')
          .test('password-rules', (value, context) => {
            const message = validatePassword(value || '');
            return message ? context.createError({ message }) : true;
          })
      })}
      onSubmit={async (values, { setErrors, setSubmitting }) => {
        const email = values.email.trim().toLowerCase();
        try {
          sessionStorage.setItem('registerUserType', userType);
          // Explicitly switch away from any earlier Google attempt before continuing with credentials.
          sessionStorage.removeItem('googleAccessToken');
          sessionStorage.removeItem('registerProfileImageUrl');
          if (emailAlreadyVerified && email === initialEmail.trim().toLowerCase()) {
            sessionStorage.setItem('registerEmail', email);
            onNext?.(email, values.password, true);
            return;
          }
          const check = await axiosServices.post('/api/user/check-email', { email });
          if (check.data?.success && check.data?.data === true) {
            navigate(`${isDemo ? '/auth/login' : '/login'}?error=email-exists&email=${encodeURIComponent(email)}`, { replace: true });
            return;
          }
          const response = await axiosServices.post('/api/user/send-verification-code', { email });
          if (!response.data?.success) throw new Error(response.data?.message || 'We could not send a verification code.');
          sessionStorage.setItem('registerEmail', email);
          sessionStorage.removeItem('emailVerified');
          onNext ? onNext(email, values.password, false) : navigate('/register/email-verifier');
        } catch (error) {
          setErrors({
            submit: error.response?.data?.message || error.message || 'We could not send the code. Check your connection and try again.'
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
          style={{ width: '100%' }}
        >
          <Box sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
            {onBack && (
              <TransitionIn delay={0.05} disabled={reduceMotion}>
                <Button onClick={onBack} sx={{ px: 0, mb: 2, textTransform: 'none' }}>
                  Back
                </Button>
              </TransitionIn>
            )}
            <TransitionIn delay={0.1} disabled={reduceMotion}>
              <Typography color="success.main" fontWeight={700} variant="body2" textAlign="center">
                Step 1 of 3 · Account
              </Typography>
              <Typography variant="h3" sx={{ mt: 1, mb: 1, color: '#061e35', fontWeight: 700, textAlign: 'center' }}>
                Create your landlord account
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                {emailAlreadyVerified
                  ? 'Re-enter your password to securely continue with your verified email.'
                  : 'Use your work email and choose a secure password. We’ll send a six-digit verification code next.'}
              </Typography>
            </TransitionIn>
          {resumeMessage && <FormHelperText sx={{ mb: 2, color: 'warning.dark' }}>{resumeMessage}</FormHelperText>}
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {oauthEnabled && (
                <>
                  <TransitionIn delay={0.2} disabled={reduceMotion}>
                    <GoogleButton
                      userType={userType}
                      onGoogleSuccess={onGoogleSuccess}
                      setGoogleError={setGoogleError}
                      externalLoading={popupLoading}
                    />
                  </TransitionIn>
                  <TransitionIn delay={0.3} disabled={reduceMotion}>
                    <Divider>
                      <Typography variant="caption">or use email</Typography>
                    </Divider>
                  </TransitionIn>
                </>
              )}
              <Box
                component={motion.div}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut', delay: reduceMotion ? 0 : oauthEnabled ? 0.4 : 0.2 }}
              >
                <Typography component="label" htmlFor="email-signup" variant="body2" fontWeight={600}>
                  Email address
                </Typography>
                <OutlinedInput
                  id="email-signup"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.email && errors.email)}
                  fullWidth
                  sx={{ mt: 0.75 }}
                />
                {touched.email && errors.email && <FormHelperText error>{errors.email}</FormHelperText>}
              </Box>
              <Box
                component={motion.div}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut', delay: reduceMotion ? 0 : oauthEnabled ? 0.5 : 0.3 }}
              >
                <Typography component="label" htmlFor="password-signup" variant="body2" fontWeight={600}>
                  Password
                </Typography>
                <OutlinedInput
                  id="password-signup"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.password && errors.password)}
                  fullWidth
                  sx={{ mt: 0.75 }}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((value) => !value)}
                        edge="end"
                      >
                        {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                      </IconButton>
                    </InputAdornment>
                  }
                />
                {touched.password && errors.password && <FormHelperText error>{errors.password}</FormHelperText>}
                {values.password && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {passwordRequirementStatuses(values.password).map(({ label, met }) => (
                      <Typography key={label} variant="caption" color={met ? 'success.dark' : 'text.secondary'}>
                        • {label}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
              {(errors.submit || googleError) && (
                <FormHelperText error role="alert">
                  {errors.submit || googleError} You can retry or use the other sign-up method.
                </FormHelperText>
              )}
              <TransitionIn delay={oauthEnabled ? 0.6 : 0.4} disabled={reduceMotion}>
                <Button
                  fullWidth
                  size="large"
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{ py: 1.4, textTransform: 'none', fontWeight: 700 }}
                >
                  {isSubmitting ? 'Please wait…' : emailAlreadyVerified ? 'Continue securely' : 'Send verification code'}
                </Button>
              </TransitionIn>
              <TransitionIn delay={oauthEnabled ? 0.7 : 0.5} disabled={reduceMotion}>
                <Typography textAlign="center" variant="body2" color="text.secondary">
                  Already have an account?{' '}
                  <Link component={RouterLink} to="/login">
                    Log in
                  </Link>
                </Typography>
              </TransitionIn>
            </Stack>
          </form>
          </Box>
        </motion.div>
      )}
    </Formik>
  );
}

EmailEntryForm.propTypes = {
  isDemo: PropTypes.bool,
  userType: PropTypes.oneOf(['landlord', 'tenant']),
  onNext: PropTypes.func,
  onGoogleSuccess: PropTypes.func,
  onBack: PropTypes.func,
  initialEmail: PropTypes.string,
  emailAlreadyVerified: PropTypes.bool,
  resumeMessage: PropTypes.string
};
