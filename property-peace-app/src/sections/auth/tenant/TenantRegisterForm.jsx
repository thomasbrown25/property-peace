import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button } from '@mui/material';
import { FormControl } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { Grid } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { InputLabel } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import IconButton from 'components/@extended/IconButton';
import AnimateButton from 'components/@extended/AnimateButton';

import { openSnackbar } from 'api/snackbar';
import { strengthColor, strengthIndicator } from 'utils/password-strength';
import axiosServices from 'utils/axios';

// assets
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import EyeInvisibleOutlined from '@ant-design/icons/EyeInvisibleOutlined';
import PropTypes from 'prop-types';

// ============================|| TENANT - REGISTER FORM ||============================ //

export default function TenantRegisterForm({ inviteToken, inviteData }) {
  const { register } = useAuth();
  const scriptedRef = useScriptRef();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [level, setLevel] = useState();
  const [showPassword, setShowPassword] = useState(false);
  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const changePassword = (value) => {
    const temp = strengthIndicator(value);
    setLevel(strengthColor(temp));
  };

  return (
    <>
      <Formik
        initialValues={{
          email: inviteData?.email || '',
          password: '',
          confirmPassword: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          email: Yup.string()
            .email('Must be a valid email')
            .max(255)
            .required('Email is required')
            .test('email-match', 'Email must match the invite', (value) => {
              return value.toLowerCase() === inviteData?.email?.toLowerCase();
            }),
          password: Yup.string()
            .required('Password is required')
            .test('no-leading-trailing-whitespace', 'Password cannot start or end with spaces', (value) => value === value.trim())
            .max(50, 'Password must be less than 50 characters')
            .min(8, 'Password must be at least 8 characters'),
          confirmPassword: Yup.string()
            .required('Please confirm your password')
            .oneOf([Yup.ref('password')], 'Passwords must match')
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            const trimmedEmail = values.email.trim();
            
            // Register with invite token
            const response = await axiosServices.post('/api/user/register', {
              email: trimmedEmail,
              password: values.password,
              firstName: inviteData?.tenant?.firstname || '',
              lastName: inviteData?.tenant?.lastname || '',
              phoneNumber: inviteData?.tenant?.phoneNumber || null,
              inviteToken: inviteToken,
              roles: ['Tenant']
            });

            if (response.data?.success) {
              // Get user data and token from response
              const userData = response.data.data;
              const jwtToken = userData?.JWTToken;

              if (jwtToken) {
                // Set session token (same way as JWTContext does)
                localStorage.setItem('serviceToken', jwtToken);
                axiosServices.defaults.headers.common.Authorization = `Bearer ${jwtToken}`;
              }

              // Show success message
              openSnackbar({
                open: true,
                message: 'Account created successfully! Redirecting...',
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
                variant: 'alert',
                alert: { color: 'success' }
              });

              // Reload the page to let JWTContext pick up the token and initialize auth state
              // This ensures the auth context is properly initialized
              // The useRedirectUser hook will redirect based on role (tenant vs landlord)
              setTimeout(() => {
                window.location.href = '/';
              }, 1000);
            } else {
              setStatus({ success: false });
              setErrors({ submit: response.data?.message || 'Registration failed' });
              openSnackbar({
                open: true,
                message: response.data?.message || 'Registration failed',
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
                variant: 'alert',
                alert: { color: 'error' }
              });
            }
          } catch (err) {
            const message = err?.response?.data?.message || 'Registration failed. Please try again.';
            setStatus({ success: false });
            setErrors({ submit: message });
            openSnackbar({
              open: true,
              message: message,
              anchorOrigin: { vertical: 'top', horizontal: 'right' },
              variant: 'alert',
              alert: { color: 'error' }
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.email && errors.email)}>
                  <InputLabel htmlFor="email-register">Email Address</InputLabel>
                  <OutlinedInput
                    id="email-register"
                    type="email"
                    value={values.email}
                    name="email"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    label="Email Address"
                    inputProps={{}}
                    disabled={true}
                  />
                  {touched.email && errors.email && (
                    <FormHelperText error id="helper-text-email-register">
                      {errors.email}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.password && errors.password)}>
                  <InputLabel htmlFor="password-register">Password</InputLabel>
                  <OutlinedInput
                    fullWidth
                    id="password-register"
                    type={showPassword ? 'text' : 'password'}
                    value={values.password}
                    name="password"
                    onBlur={handleBlur}
                    onChange={(e) => {
                      handleChange(e);
                      changePassword(e.target.value);
                    }}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                          color="secondary"
                        >
                          {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label="Password"
                    inputProps={{}}
                  />
                  {touched.password && errors.password && (
                    <FormHelperText error id="helper-text-password-register">
                      {errors.password}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {values.password && level && (
                <Grid size={12}>
                  <Stack spacing={1}>
                    <Typography variant="body2">Password Strength</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: '100%',
                          height: 8,
                          borderRadius: '4px',
                          bgcolor: level?.label === 'Weak' ? 'error.light' : level?.label === 'Fair' ? 'warning.main' : 'success.main'
                        }}
                      />
                    </Stack>
                    <Typography variant="caption" color={level?.color}>
                      {level?.label}
                    </Typography>
                  </Stack>
                </Grid>
              )}

              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.confirmPassword && errors.confirmPassword)}>
                  <InputLabel htmlFor="confirm-password-register">Confirm Password</InputLabel>
                  <OutlinedInput
                    fullWidth
                    id="confirm-password-register"
                    type={showPassword ? 'text' : 'password'}
                    value={values.confirmPassword}
                    name="confirmPassword"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                          color="secondary"
                        >
                          {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label="Confirm Password"
                    inputProps={{}}
                  />
                  {touched.confirmPassword && errors.confirmPassword && (
                    <FormHelperText error id="helper-text-confirm-password-register">
                      {errors.confirmPassword}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {errors.submit && (
                <Grid size={12}>
                  <FormHelperText error>{errors.submit}</FormHelperText>
                </Grid>
              )}

              <Grid size={12}>
                <AnimateButton>
                  <Button disableElevation disabled={isSubmitting} fullWidth size="large" type="submit" variant="contained" color="primary">
                    Create Account
                  </Button>
                </AnimateButton>
              </Grid>
            </Grid>
          </form>
        )}
      </Formik>
    </>
  );
}

TenantRegisterForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.object.isRequired
};

