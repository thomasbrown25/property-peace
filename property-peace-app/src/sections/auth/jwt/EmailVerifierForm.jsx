import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Box, Button, FormHelperText, Link, OutlinedInput, Stack, Typography } from '@mui/material';
import * as Yup from 'yup';
import { Formik } from 'formik';
import TurnstileCheckbox from 'components/auth/TurnstileCheckbox';
import axiosServices from 'utils/axios';
import { authFieldSx, authLabelSx, authPrimaryButtonSx } from './authFormStyles';

const RESEND_SECONDS = 30;

export default function EmailVerifierForm({ email, onVerified, onBack, mustReverify = false }) {
  const [cooldown, setCooldown] = useState(mustReverify ? 0 : RESEND_SECONDS);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [showResendChallenge, setShowResendChallenge] = useState(false);
  const [resendToken, setResendToken] = useState(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    if (resendLoading || cooldown > 0) return;
    if (siteKey && !showResendChallenge) {
      setShowResendChallenge(true);
      return;
    }
    if (siteKey && !resendToken) return;

    setResendLoading(true);
    setResendMessage('');
    setResendError('');
    try {
      const response = await axiosServices.post('/api/user/send-verification-code', { email, botChallengeToken: resendToken });
      if (!response.data?.success) throw new Error(response.data?.message || 'The code could not be resent.');
      setCooldown(RESEND_SECONDS);
      setShowResendChallenge(false);
      setResendMessage('A new code was sent.');
    } catch (error) {
      setResendError(error.response?.data?.message || error.message || 'The code could not be resent. Try again.');
      if (siteKey) setChallengeReset((current) => current + 1);
    } finally {
      setResendToken(null);
      setResendLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
      <Typography color="success.main" fontWeight={700} variant="body2">
        Step 2 of 3 · Verify email
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mt: 1 }}>
        <Typography variant="h3" sx={{ color: 'text.primary', fontWeight: 700 }}>
          Check your inbox
        </Typography>
        <Link component="button" type="button" onClick={onBack} sx={{ flexShrink: 0 }}>
          Change email
        </Link>
      </Box>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {mustReverify && !resendMessage
          ? 'Your previous verification is no longer valid. Request a new code for '
          : 'Enter the six-digit code sent to '}
        <Box component="span" fontWeight={700} color="text.primary">
          {email}
        </Box>
        .
      </Typography>
      <Formik
        initialValues={{ code: '', submit: null }}
        validationSchema={Yup.object({
          code: Yup.string()
            .matches(/^\d{6}$/, 'Enter all 6 digits')
            .required('Verification code is required')
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          if (resendLoading) {
            setSubmitting(false);
            return;
          }
          try {
            const response = await axiosServices.post('/api/user/verify-code', { email, code: values.code });
            if (!response.data?.success) throw new Error(response.data?.message || 'That code is invalid or expired.');
            onVerified?.();
          } catch (error) {
            setErrors({
              submit: error.response?.data?.message || error.message || 'We could not verify the code. Request a new one and try again.'
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleSubmit, isSubmitting, setFieldValue, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <Box>
                <Typography component="label" htmlFor="code-verification" variant="body2" sx={authLabelSx}>
                  Verification code
                </Typography>
                <OutlinedInput
                  id="code-verification"
                  name="code"
                  value={values.code}
                  onChange={(event) => setFieldValue('code', event.target.value.replace(/\D/g, '').slice(0, 6))}
                  onBlur={handleBlur}
                  fullWidth
                  autoFocus
                  error={Boolean(touched.code && errors.code)}
                  aria-describedby={touched.code && errors.code ? 'code-verification-error' : undefined}
                  inputProps={{
                    maxLength: 6,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    autoComplete: 'one-time-code',
                    'aria-label': 'Six-digit verification code',
                    style: { textAlign: 'center', letterSpacing: '.45em', fontSize: '1.25rem' }
                  }}
                  sx={authFieldSx}
                />
                {touched.code && errors.code && <FormHelperText id="code-verification-error" error>{errors.code}</FormHelperText>}
              </Box>
              {errors.submit && (
                <FormHelperText error role="alert">
                  {errors.submit}
                </FormHelperText>
              )}
              <Button
                fullWidth
                size="large"
                type="submit"
                variant="contained"
                disabled={isSubmitting || resendLoading}
                sx={authPrimaryButtonSx}
              >
                {isSubmitting ? 'Verifying…' : 'Verify email'}
              </Button>
              <Box textAlign="center">
                {showResendChallenge && (
                  <TurnstileCheckbox siteKey={siteKey} resetKey={challengeReset} onToken={setResendToken} />
                )}
                <Button
                  type="button"
                  variant="text"
                  disabled={isSubmitting || resendLoading || cooldown > 0 || (showResendChallenge && !resendToken)}
                  onClick={resend}
                  sx={{ textTransform: 'none' }}
                >
                  {resendLoading ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </Button>
                {resendMessage && (
                  <FormHelperText role="status" sx={{ textAlign: 'center' }}>
                    {resendMessage}
                  </FormHelperText>
                )}
                {resendError && (
                  <FormHelperText error role="alert" sx={{ textAlign: 'center' }}>
                    {resendError}
                  </FormHelperText>
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
  mustReverify: PropTypes.bool
};
