import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { IconButton } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Link } from '@mui/material';
import { CircularProgress } from '@mui/material';

// ant design icons
import { EyeOutlined, EyeInvisibleOutlined, ArrowLeftOutlined } from '@ant-design/icons';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { organizationInviteAPI } from 'api';

// ============================|| ORGANIZATION - INVITE ACCEPT FORM ||============================ //

export default function OrganizationInviteAcceptForm({ inviteToken, inviteData }) {
  const navigate = useNavigate();
  const { login, isLoggedIn } = useAuth();
  const [step, setStep] = useState(1); // 1: Name/Email, 2: Verification Code, 3: Password
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const handleAcceptInvite = async () => {
    if (!isLoggedIn) {
      // Redirect to login with invite token
      navigate(`/login?inviteToken=${inviteToken}`);
      return;
    }

    try {
      setAccepting(true);
      const response = await organizationInviteAPI.acceptInvite(inviteToken);

      if (response?.success) {
        openSnackbar({
          open: true,
          message: 'Invite accepted successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh user data to get updated organization
        setTimeout(() => {
          window.location.href = '/landlord/dashboard';
        }, 1500);
      } else {
        openSnackbar({
          open: true,
          message: response?.message || 'Failed to accept invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to accept invite. Please try again.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectInvite = async () => {
    try {
      setRejecting(true);
      // For now, just redirect to login/home
      // In the future, we could add a reject endpoint
      openSnackbar({
        open: true,
        message: 'Invite declined',
        variant: 'alert',
        alert: { color: 'info' }
      });

      navigate('/login');
    } catch (error) {
      console.error('Error rejecting invite:', error);
    } finally {
      setRejecting(false);
    }
  };

  // Step 1: Name and Email (send verification code)
  const Step1Form = () => (
    <Formik
      initialValues={{
        firstName: '',
        lastName: '',
        email: inviteData?.email || '',
        submit: null
      }}
      validationSchema={Yup.object().shape({
        firstName: Yup.string().max(255).required('First Name is required'),
        lastName: Yup.string().max(255).required('Last Name is required'),
        email: Yup.string().email('Must be a valid email').max(255).required('Email is required')
      })}
      onSubmit={async (values, { setErrors, setSubmitting }) => {
        try {
          // Verify email matches invite
          if (values.email.toLowerCase() !== inviteData.email.toLowerCase()) {
            setErrors({ submit: `This invite was sent to ${inviteData.email}. Please use that email address.` });
            setSubmitting(false);
            return;
          }

          // Send verification code
          const response = await axiosServices.post('/api/user/send-verification-code', {
            email: values.email.trim().toLowerCase()
          });

          if (response.data?.success) {
            // Store data in sessionStorage for next steps
            sessionStorage.setItem('orgInviteToken', inviteToken);
            sessionStorage.setItem('orgInviteEmail', values.email.trim().toLowerCase());
            sessionStorage.setItem('orgInviteFirstName', values.firstName.trim());
            sessionStorage.setItem('orgInviteLastName', values.lastName.trim());

            setStep(2);
          } else {
            setErrors({ submit: response.data?.message || 'Failed to send verification code' });
          }
          setSubmitting(false);
        } catch (err) {
          console.error(err);
          setErrors({ submit: err.response?.data?.message || 'Failed to send verification code. Please try again.' });
          setSubmitting(false);
        }
      }}
    >
      {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
        <form noValidate onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {/* First Name */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                First Name *
              </Typography>
              <OutlinedInput
                id="first-name-invite"
                type="text"
                value={values.firstName}
                name="firstName"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="Your first name"
                fullWidth
                size="small"
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

            {/* Last Name */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Last Name *
              </Typography>
              <OutlinedInput
                id="last-name-invite"
                type="text"
                value={values.lastName}
                name="lastName"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="Your last name"
                fullWidth
                size="small"
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

            {/* Email (disabled) */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Email *
              </Typography>
              <OutlinedInput
                id="email-invite"
                type="email"
                value={values.email}
                name="email"
                fullWidth
                size="small"
                disabled
                sx={{
                  bgcolor: 'action.disabledBackground',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider'
                  }
                }}
              />
            </Box>

            {/* Error Messages */}
            {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

            {/* Continue Button */}
            <AnimateButton>
              <Button disableElevation disabled={isSubmitting} fullWidth size="small" type="submit" variant="contained" color="primary">
                {isSubmitting ? 'Sending Code...' : 'Continue'}
              </Button>
            </AnimateButton>
          </Stack>
        </form>
      )}
    </Formik>
  );

  // Step 2: Verification Code
  const Step2Form = () => {
    const email = sessionStorage.getItem('orgInviteEmail') || inviteData?.email || '';

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
            alert: { color: 'success' }
          });
        } else {
          openSnackbar({
            open: true,
            message: response.data?.message || 'Failed to resend code',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (err) {
        console.error('Resend error:', err);
        openSnackbar({
          open: true,
          message: err.response?.data?.message || 'Failed to resend code',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setResendLoading(false);
      }
    };

    return (
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
              // Code verified successfully, move to password step
              setStep(3);
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
              {/* Back Button */}
              <Button
                startIcon={<ArrowLeftOutlined />}
                onClick={() => setStep(1)}
                variant="text"
                color="inherit"
                sx={{ alignSelf: 'flex-start', p: 0, minWidth: 'auto' }}
              >
                Back
              </Button>

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
                  Enter the 6-digit code *
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
                  size="small"
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

              {/* Continue Button */}
              <AnimateButton>
                <Button disableElevation disabled={isSubmitting} fullWidth size="small" type="submit" variant="contained" color="primary">
                  Continue
                </Button>
              </AnimateButton>

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
            </Stack>
          </form>
        )}
      </Formik>
    );
  };

  // Step 3: Password Creation
  const Step3Form = () => {
    const email = sessionStorage.getItem('orgInviteEmail') || inviteData?.email || '';
    const firstName = sessionStorage.getItem('orgInviteFirstName') || '';
    const lastName = sessionStorage.getItem('orgInviteLastName') || '';
    const token = sessionStorage.getItem('orgInviteToken') || inviteToken;

    return (
      <Formik
        initialValues={{
          password: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          password: Yup.string()
            .required('Password is required')
            .test('no-leading-trailing-whitespace', 'Password cannot start or end with spaces', (value) => value === value.trim())
            .min(8, 'Password must be at least 8 characters')
            .max(50, 'Password must be less than 50 characters')
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            // Create user account and accept invite
            const response = await axiosServices.post('/api/user/register', {
              email: email.trim().toLowerCase(),
              password: values.password,
              firstname: firstName.trim(),
              lastname: lastName.trim(),
              organizationInviteToken: token,
              roles: ['Landlord']
            });

            if (response.data?.success) {
              const userData = response.data.data;
              const jwtToken = userData?.JWTToken || userData?.jwtToken;

              if (jwtToken) {
                // Set session token
                localStorage.setItem('serviceToken', jwtToken);
                axiosServices.defaults.headers.common.Authorization = `Bearer ${jwtToken}`;
              }

              // Clear session storage
              sessionStorage.removeItem('orgInviteToken');
              sessionStorage.removeItem('orgInviteEmail');
              sessionStorage.removeItem('orgInviteFirstName');
              sessionStorage.removeItem('orgInviteLastName');

              openSnackbar({
                open: true,
                message: `Account created! You've joined ${inviteData.organizationName}.`,
                variant: 'alert',
                alert: { color: 'success' }
              });

              // Reload page to let JWTContext pick up the token and initialize auth state
              setTimeout(() => {
                window.location.href = '/landlord/dashboard';
              }, 1000);
            } else {
              throw new Error(response.data?.message || 'Failed to create account');
            }
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setErrors({ submit: err.response?.data?.message || err.message || 'Failed to create account. Please try again.' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {/* Back Button */}
              <Button
                startIcon={<ArrowLeftOutlined />}
                onClick={() => setStep(2)}
                variant="text"
                color="inherit"
                sx={{ alignSelf: 'flex-start', p: 0, minWidth: 'auto' }}
              >
                Back
              </Button>

              {/* Email Display (read-only) */}
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Email
                </Typography>
                <OutlinedInput
                  value={email}
                  fullWidth
                  size="small"
                  disabled
                  sx={{
                    bgcolor: 'action.disabledBackground',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider'
                    }
                  }}
                />
              </Box>

              {/* Password Input */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Password *
                </Typography>
                <OutlinedInput
                  fullWidth
                  size="small"
                  error={Boolean(touched.password && errors.password)}
                  id="password-invite"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  name="password"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder="Your password"
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                        sx={{ color: 'text.secondary' }}
                      >
                        {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                      </IconButton>
                    </InputAdornment>
                  }
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
                {touched.password && errors.password && (
                  <FormHelperText error sx={{ mt: 0.5 }}>
                    {errors.password}
                  </FormHelperText>
                )}
              </Box>

              {/* Error Messages */}
              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

              {/* Continue Button */}
              <AnimateButton>
                <Button disableElevation disabled={isSubmitting} fullWidth size="small" type="submit" variant="contained" color="primary">
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              </AnimateButton>
            </Stack>
          </form>
        )}
      </Formik>
    );
  };

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
      {/* Header - only show for new users */}
      {!inviteData?.hasAccount && (
        <Box sx={{ textAlign: 'left', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {step === 1 && 'Enter Personal Information'}
            {step === 2 && 'Verify Your Email'}
            {step === 3 && 'Create Your Password'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {step === 1 && `You've been invited to join ${inviteData?.organizationName} as a ${inviteData?.role || 'member'}.`}
            {step === 2 && 'Enter the verification code sent to your email.'}
            {step === 3 && 'Choose a secure password for your account.'}
          </Typography>
        </Box>
      )}

      {/* If user has account, show simple accept/reject buttons */}
      {inviteData?.hasAccount ? (
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Email
            </Typography>
            <OutlinedInput
              id="email"
              type="email"
              value={inviteData.email}
              disabled
              fullWidth
              sx={{ bgcolor: 'action.disabledBackground' }}
            />
          </Box>
          <Stack spacing={1.25} sx={{ '& > *': { width: '100%' } }}>
            <AnimateButton>
              <Button
                disableElevation
                disabled={accepting || rejecting}
                fullWidth
                size="large"
                type="button"
                variant="contained"
                color="primary"
                onClick={handleAcceptInvite}
                sx={{ py: 1.35, bgcolor: '#061e35', '&:hover': { bgcolor: '#0a314f' } }}
              >
                {accepting ? <CircularProgress size={20} /> : 'Accept Invite'}
              </Button>
            </AnimateButton>
            <AnimateButton>
              <Button
                disableElevation
                disabled={accepting || rejecting}
                fullWidth
                size="medium"
                type="button"
                variant="text"
                color="error"
                onClick={handleRejectInvite}
                sx={{ py: 1.1 }}
              >
                {rejecting ? <CircularProgress size={20} /> : 'Reject Invite'}
              </Button>
            </AnimateButton>
          </Stack>
        </Stack>
      ) : (
        <>
          {/* Form Steps for new users */}
          {step === 1 && <Step1Form />}
          {step === 2 && <Step2Form />}
          {step === 3 && <Step3Form />}
        </>
      )}
    </Box>
  );
}

OrganizationInviteAcceptForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.shape({
    organizationName: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    invitedByName: PropTypes.string,
    hasAccount: PropTypes.bool
  }).isRequired
};
