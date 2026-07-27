import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Box, Button, FormHelperText, Link, OutlinedInput, Stack, Typography } from '@mui/material';
import * as Yup from 'yup';
import { Formik } from 'formik';
import axiosServices from 'utils/axios';

const RESEND_SECONDS = 30;

export default function EmailVerifierForm({ email, onVerified, onBack }) {
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      const response = await axiosServices.post('/api/user/send-verification-code', { email });
      if (!response.data?.success) throw new Error(response.data?.message || 'The code could not be resent.');
      setCooldown(RESEND_SECONDS);
      setResendMessage('A new code was sent.');
    } catch (error) {
      setResendMessage(error.response?.data?.message || error.message || 'The code could not be resent. Try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
      <Typography color="success.main" fontWeight={700} variant="body2">
        Step 2 of 3 · Verify email
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mt: 1 }}>
        <Typography variant="h3" sx={{ color: '#061e35', fontWeight: 700 }}>
          Check your inbox
        </Typography>
        <Link component="button" type="button" onClick={onBack} sx={{ flexShrink: 0 }}>
          Change email
        </Link>
      </Box>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Enter the six-digit code sent to{' '}
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
          try {
            const response = await axiosServices.post('/api/user/verify-code', { email, code: values.code });
            if (!response.data?.success) throw new Error(response.data?.message || 'That code is invalid or expired.');
            sessionStorage.setItem('emailVerified', 'true');
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
                <Typography component="label" htmlFor="code-verification" variant="body2" fontWeight={600}>
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
                  inputProps={{
                    maxLength: 6,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    autoComplete: 'one-time-code',
                    'aria-label': 'Six-digit verification code',
                    style: { textAlign: 'center', letterSpacing: '.45em', fontSize: '1.25rem' }
                  }}
                  sx={{ mt: 0.75 }}
                />
                {touched.code && errors.code && <FormHelperText error>{errors.code}</FormHelperText>}
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
                disabled={isSubmitting}
                sx={{ py: 1.4, textTransform: 'none', fontWeight: 700 }}
              >
                {isSubmitting ? 'Verifying…' : 'Verify email'}
              </Button>
              <Box textAlign="center">
                <Button
                  type="button"
                  variant="text"
                  disabled={resendLoading || cooldown > 0}
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
              </Box>
            </Stack>
          </form>
        )}
      </Formik>
    </Box>
  );
}

EmailVerifierForm.propTypes = { email: PropTypes.string.isRequired, onVerified: PropTypes.func, onBack: PropTypes.func };
