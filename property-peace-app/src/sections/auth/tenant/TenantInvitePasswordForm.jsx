import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button, FormControl, FormHelperText, Grid, InputAdornment, InputLabel, OutlinedInput, Stack, Typography, Box } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import IconButton from 'components/@extended/IconButton';
import AnimateButton from 'components/@extended/AnimateButton';
import { openSnackbar } from 'api/snackbar';
import { strengthColor, strengthIndicator } from 'utils/password-strength';
import { validatePassword } from 'utils/password-validation';
import PropTypes from 'prop-types';

// assets
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import EyeInvisibleOutlined from '@ant-design/icons/EyeInvisibleOutlined';

// ============================|| TENANT - INVITE PASSWORD FORM ||============================ //

export default function TenantInvitePasswordForm({ inviteToken, inviteData }) {
  const navigate = useNavigate();
  const [level, setLevel] = useState();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          password: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          password: Yup.string()
            .required('Password is required')
            .test('api-password-rules', (value, context) => {
              const message = validatePassword(value || '');
              return message ? context.createError({ message }) : true;
            })
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            setIsSubmitting(true);
            setSubmitting(true);

            // Store password in sessionStorage and navigate to account setup page
            sessionStorage.setItem('tenantInvitePassword', values.password);

            // Navigate to account setup page
            navigate(`/tenant/invite/${inviteToken}/setting-up`);
          } catch (err) {
            const message = err?.message || 'An error occurred. Please try again.';
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
            setIsSubmitting(false);
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.password && errors.password)}>
                  <InputLabel htmlFor="password-invite">Password</InputLabel>
                  <OutlinedInput
                    fullWidth
                    id="password-invite"
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
                  />
                  {touched.password && errors.password && (
                    <FormHelperText error id="helper-text-password-invite">
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

              {errors.submit && (
                <Grid size={12}>
                  <FormHelperText error>{errors.submit}</FormHelperText>
                </Grid>
              )}

              <Grid size={12}>
                <Stack direction="row" spacing={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/tenant/invite/${inviteToken}/personal-info`)}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <AnimateButton>
                    <Button disableElevation disabled={isSubmitting} fullWidth size="large" type="submit" variant="contained" color="primary">
                      Continue
                    </Button>
                  </AnimateButton>
                </Stack>
              </Grid>
            </Grid>
          </form>
        )}
      </Formik>
    </>
  );
}

TenantInvitePasswordForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.object.isRequired
};
