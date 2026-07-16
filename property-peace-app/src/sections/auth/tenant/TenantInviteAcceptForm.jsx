import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button, FormControl, FormHelperText, Grid, InputLabel, OutlinedInput, Stack, Typography } from '@mui/material';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import PropTypes from 'prop-types';

// ============================|| TENANT - INVITE ACCEPT FORM ||============================ //

export default function TenantInviteAcceptForm({ inviteToken, inviteData }) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <Formik
        initialValues={{
          firstname: inviteData?.tenant?.firstname || '',
          lastname: inviteData?.tenant?.lastname || '',
          email: inviteData?.email || inviteData?.tenant?.email || '',
          phoneNumber: inviteData?.tenant?.phoneNumber || '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          firstname: Yup.string().required('First name is required'),
          lastname: Yup.string().required('Last name is required'),
          email: Yup.string()
            .email('Must be a valid email')
            .required('Email is required')
            .test('email-match', 'Email must match the invite', (value) => {
              return value.toLowerCase() === inviteData?.email?.toLowerCase();
            }),
          phoneNumber: Yup.string().nullable()
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            setIsSubmitting(true);
            setSubmitting(true);

            // Send verification code
            const verifyResponse = await axiosServices.post('/api/user/send-verification-code', {
              email: values.email.trim()
            });

            if (verifyResponse.data?.success) {
              // Store invite data and form data in sessionStorage for next steps
              sessionStorage.setItem('tenantInviteToken', inviteToken);
              sessionStorage.setItem('tenantInviteData', JSON.stringify({
                ...inviteData,
                tenant: {
                  ...inviteData.tenant,
                  firstname: values.firstname,
                  lastname: values.lastname,
                  phoneNumber: values.phoneNumber || null
                }
              }));
              sessionStorage.setItem('tenantInviteEmail', values.email.trim());

              // Navigate to verification code page
              navigate(`/tenant/invite/${inviteToken}/verify`);
            } else {
              setStatus({ success: false });
              setErrors({ submit: verifyResponse.data?.message || 'Failed to send verification code' });
              openSnackbar({
                open: true,
                message: verifyResponse.data?.message || 'Failed to send verification code',
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
                variant: 'alert',
                alert: { color: 'error' }
              });
            }
          } catch (err) {
            const message = err?.response?.data?.message || 'Failed to send verification code. Please try again.';
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
                <FormControl fullWidth error={Boolean(touched.firstname && errors.firstname)}>
                  <InputLabel htmlFor="firstname-invite">First Name</InputLabel>
                  <OutlinedInput
                    id="firstname-invite"
                    type="text"
                    value={values.firstname}
                    name="firstname"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    label="First Name"
                  />
                  {touched.firstname && errors.firstname && (
                    <FormHelperText error id="helper-text-firstname-invite">
                      {errors.firstname}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.lastname && errors.lastname)}>
                  <InputLabel htmlFor="lastname-invite">Last Name</InputLabel>
                  <OutlinedInput
                    id="lastname-invite"
                    type="text"
                    value={values.lastname}
                    name="lastname"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    label="Last Name"
                  />
                  {touched.lastname && errors.lastname && (
                    <FormHelperText error id="helper-text-lastname-invite">
                      {errors.lastname}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.email && errors.email)}>
                  <InputLabel htmlFor="email-invite">Email Address</InputLabel>
                  <OutlinedInput
                    id="email-invite"
                    type="email"
                    value={values.email}
                    name="email"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    label="Email Address"
                    disabled={true}
                  />
                  {touched.email && errors.email && (
                    <FormHelperText error id="helper-text-email-invite">
                      {errors.email}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid size={12}>
                <FormControl fullWidth error={Boolean(touched.phoneNumber && errors.phoneNumber)}>
                  <InputLabel htmlFor="phone-invite">Phone Number (Optional)</InputLabel>
                  <OutlinedInput
                    id="phone-invite"
                    type="tel"
                    value={values.phoneNumber}
                    name="phoneNumber"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    label="Phone Number (Optional)"
                  />
                  {touched.phoneNumber && errors.phoneNumber && (
                    <FormHelperText error id="helper-text-phone-invite">
                      {errors.phoneNumber}
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
                    Continue
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

TenantInviteAcceptForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.object.isRequired
};

