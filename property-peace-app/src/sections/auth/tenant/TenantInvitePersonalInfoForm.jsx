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
import PropTypes from 'prop-types';

// ============================|| TENANT - INVITE PERSONAL INFO FORM ||============================ //

export default function TenantInvitePersonalInfoForm({ inviteToken, inviteData }) {
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

            // Update invite data in sessionStorage with confirmed values
            sessionStorage.setItem('tenantInviteData', JSON.stringify({
              ...inviteData,
              tenant: {
                ...inviteData.tenant,
                firstname: values.firstname,
                lastname: values.lastname,
                phoneNumber: values.phoneNumber || null
              }
            }));

            // Navigate to password creation page
            navigate(`/tenant/invite/${inviteToken}/password`);
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
                    label="Email Address"
                    disabled={true}
                    sx={{ bgcolor: 'action.disabledBackground' }}
                  />
                  {touched.email && errors.email && (
                    <FormHelperText error id="helper-text-email-invite">
                      {errors.email}
                    </FormHelperText>
                  )}
                  <FormHelperText>
                    Your email address cannot be changed
                  </FormHelperText>
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
                <Stack direction="row" spacing={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/tenant/invite/${inviteToken}`)}
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

TenantInvitePersonalInfoForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.object.isRequired
};
