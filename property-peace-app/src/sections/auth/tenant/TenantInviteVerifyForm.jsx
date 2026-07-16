import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button, FormHelperText, Grid, Stack, Typography, Box } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';
import OtpInput from 'react-otp-input';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import PropTypes from 'prop-types';
import { tenantInviteAPI } from 'api';
import useAuth from 'hooks/useAuth';

// ============================|| TENANT - INVITE VERIFY CODE FORM ||============================ //

export default function TenantInviteVerifyForm({ inviteToken, email }) {
  const navigate = useNavigate();
  const { isLoggedIn, login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  
  const isExistingUserInvite = sessionStorage.getItem('isExistingUserInvite') === 'true';

  const handleResendCode = async () => {
    try {
      setResending(true);
      const response = await axiosServices.post('/api/user/send-verification-code', {
        email: email.trim()
      });

      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: 'Verification code sent successfully',
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Failed to resend verification code',
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to resend verification code',
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Formik
        initialValues={{ code: '' }}
        validationSchema={Yup.object({
          code: Yup.string()
            .length(6, 'Verification code must be 6 digits')
            .matches(/^\d+$/, 'Verification code must contain only numbers')
            .required('Verification code is required')
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            setIsSubmitting(true);
            setSubmitting(true);

            // Verify code
            const verifyResponse = await axiosServices.post('/api/user/verify-code', {
              email: email.trim(),
              code: values.code
            });

            if (verifyResponse.data?.success && verifyResponse.data?.data) {
              // If this is an existing user invite, accept it directly
              if (isExistingUserInvite) {
                // User must be logged in to accept
                if (!isLoggedIn) {
                  // Store data and redirect to login
                  sessionStorage.setItem('tenantInviteToken', inviteToken);
                  sessionStorage.setItem('tenantInviteEmail', email.trim());
                  sessionStorage.setItem('pendingTenantInviteAccept', 'true');
                  navigate(`/login?returnUrl=/tenant/invite/${inviteToken}/accept&email=${encodeURIComponent(email.trim())}`, { replace: true });
                  return;
                }

                // Accept the invite
                try {
                  const acceptResponse = await tenantInviteAPI.acceptTenantInvite({
                    inviteToken,
                    email: email.trim()
                  });

                  if (acceptResponse.success) {
                    // Get property name from sessionStorage or response data
                    const propertyName = sessionStorage.getItem('tenantInvitePropertyName') || acceptResponse.data?.propertyName || 'the property';
                    
                    // Clear session storage
                    sessionStorage.removeItem('tenantInviteToken');
                    sessionStorage.removeItem('tenantInviteEmail');
                    sessionStorage.removeItem('isExistingUserInvite');
                    sessionStorage.removeItem('pendingTenantInviteAccept');
                    sessionStorage.removeItem('tenantInvitePropertyName');

                    // Redirect to success page
                    navigate(`/tenant/invite/success?propertyName=${encodeURIComponent(propertyName)}`);
                  } else {
                    setStatus({ success: false });
                    setErrors({ code: acceptResponse.message || 'Failed to accept invitation' });
                    openSnackbar({
                      open: true,
                      message: acceptResponse.message || 'Failed to accept invitation',
                      anchorOrigin: { vertical: 'top', horizontal: 'right' },
                      variant: 'alert',
                      alert: { color: 'error' }
                    });
                  }
                } catch (acceptErr) {
                  const acceptMessage = acceptErr?.response?.data?.message || 'Failed to accept invitation. Please try again.';
                  setStatus({ success: false });
                  setErrors({ code: acceptMessage });
                  openSnackbar({
                    open: true,
                    message: acceptMessage,
                    anchorOrigin: { vertical: 'top', horizontal: 'right' },
                    variant: 'alert',
                    alert: { color: 'error' }
                  });
                }
              } else {
                // Navigate to password creation page for new users
                navigate(`/tenant/invite/${inviteToken}/password`);
              }
            } else {
              setStatus({ success: false });
              setErrors({ code: verifyResponse.data?.message || 'Invalid verification code' });
              openSnackbar({
                open: true,
                message: verifyResponse.data?.message || 'Invalid verification code',
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
                variant: 'alert',
                alert: { color: 'error' }
              });
            }
          } catch (err) {
            const message = err?.response?.data?.message || 'Invalid verification code. Please try again.';
            setStatus({ success: false });
            setErrors({ code: message });
            openSnackbar({
              open: true,
              message: message,
              anchorOrigin: { vertical: 'top', horizontal: 'right' },
              variant: 'alert',
              alert: { color: 'error' }
            });
          } finally {
            setIsSubmitting(false);
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleSubmit, touched, values, setFieldValue }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <Box
                  sx={(theme) => ({
                    '& input': {
                      border: '1px solid',
                      borderColor: 'divider',
                      ...(touched.code && errors.code && { borderColor: 'error.main' }),
                      '&:focus-visible': {
                        outline: 'none !important',
                        borderColor: 'primary.main',
                        boxShadow: theme.customShadows.primary,
                        ...(touched.code && errors.code && { borderColor: 'error.main', boxShadow: theme.customShadows.error })
                      }
                    }
                  })}
                >
                  <OtpInput
                    value={values.code}
                    onChange={(code) => setFieldValue('code', code)}
                    inputType="tel"
                    shouldAutoFocus
                    renderInput={(props, index) => (
                      <input
                        {...props}
                        id={`otp-input-${index}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                          } else if (e.key === 'Backspace' && !props.value) {
                            const previousInput = document.getElementById(`otp-input-${index - 1}`);
                            if (previousInput) {
                              previousInput.focus();
                            }
                          } else if (e.key !== 'Backspace') {
                            const nextInput = document.getElementById(`otp-input-${index + 1}`);
                            if (nextInput && props.value) {
                              setTimeout(() => {
                                nextInput.focus();
                              }, 0);
                            }
                          }
                          props.onKeyDown?.(e);
                        }}
                      />
                    )}
                    numInputs={6}
                    containerStyle={{ justifyContent: 'space-between', margin: -8 }}
                    inputStyle={{ width: '100%', margin: '8px', padding: '10px', outline: 'none', borderRadius: 4 }}
                  />
                  {touched.code && errors.code && (
                    <FormHelperText error id="standard-weight-helper-text-code" sx={{ mt: 1 }}>
                      {errors.code}
                    </FormHelperText>
                  )}
                </Box>
              </Grid>
              <Grid size={12}>
                <AnimateButton>
                  <Button disableElevation disabled={isSubmitting} fullWidth size="large" type="submit" variant="contained">
                    Verify Code
                  </Button>
                </AnimateButton>
              </Grid>
              <Grid size={12}>
                <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography>Did not receive the code? Check your spam filter, or</Typography>
                  <Typography
                    variant="body1"
                    sx={{ minWidth: 85, ml: 2, textDecoration: 'none', cursor: 'pointer' }}
                    color="primary"
                    onClick={handleResendCode}
                  >
                    {resending ? 'Sending...' : 'Resend code'}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </form>
        )}
      </Formik>
    </>
  );
}

TenantInviteVerifyForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired
};

