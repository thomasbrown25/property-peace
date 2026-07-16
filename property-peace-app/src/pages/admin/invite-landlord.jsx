import { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import { SendOutlined, UserAddOutlined } from '@ant-design/icons';
import { Formik } from 'formik';
import * as Yup from 'yup';

// project imports
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import landlordInviteAPI from 'api/landlordInvite';
import { openSnackbar } from 'api/snackbar';

// ==============================|| ADMIN - INVITE LANDLORD ||============================== //

export default function InviteLandlord() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .email('Must be a valid email')
      .required('Email is required'),
    firstName: Yup.string().max(100),
    lastName: Yup.string().max(100)
  });

  const handleSubmit = async (values, { setErrors, resetForm }) => {
    try {
      setLoading(true);
      setSuccess(false);

      const response = await landlordInviteAPI.createInvite({
        email: values.email.trim().toLowerCase(),
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName?.trim() || null
      });

      if (response.success) {
        setSuccess(true);
        resetForm();
        openSnackbar({
          open: true,
          message: 'Invite sent successfully!',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
      } else {
        setErrors({ submit: response.message || 'Failed to send invite' });
      }
    } catch (err) {
      console.error('Error sending invite:', err);
      setErrors({
        submit: err.response?.data?.message || err.message || 'Failed to send invite. Please try again.'
      });
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.message || 'Failed to send invite',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid container spacing={3}>
      {/* Header */}
      <Grid size={12}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h3" fontWeight="bold">
            Invite Landlord
          </Typography>
        </Stack>
      </Grid>

      {/* Success Alert */}
      {success && (
        <Grid size={12}>
          <Alert severity="success" onClose={() => setSuccess(false)}>
            Invite sent successfully! The landlord will receive an email with instructions to create their account.
          </Alert>
        </Grid>
      )}

      {/* Invite Form */}
      <Grid size={12}>
        <MainCard title="Send Landlord Invitation">
          <Formik
            initialValues={{
              email: '',
              firstName: '',
              lastName: '',
              submit: null
            }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
              <form noValidate onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      Email Address *
                    </Typography>
                    <TextField
                      id="email-invite"
                      type="email"
                      name="email"
                      value={values.email}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="landlord@example.com"
                      fullWidth
                      error={Boolean(touched.email && errors.email)}
                      helperText={touched.email && errors.email}
                      disabled={loading}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      First Name (Optional)
                    </Typography>
                    <TextField
                      id="firstName-invite"
                      type="text"
                      name="firstName"
                      value={values.firstName}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="John"
                      fullWidth
                      error={Boolean(touched.firstName && errors.firstName)}
                      helperText={touched.firstName && errors.firstName}
                      disabled={loading}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      Last Name (Optional)
                    </Typography>
                    <TextField
                      id="lastName-invite"
                      type="text"
                      name="lastName"
                      value={values.lastName}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Doe"
                      fullWidth
                      error={Boolean(touched.lastName && errors.lastName)}
                      helperText={touched.lastName && errors.lastName}
                      disabled={loading}
                    />
                  </Box>

                  {/* Error Messages */}
                  {errors.submit && (
                    <Alert severity="error">{errors.submit}</Alert>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={loading || isSubmitting}
                    startIcon={loading || isSubmitting ? <CircularProgress size={20} /> : <SendOutlined />}
                    fullWidth
                  >
                    {loading || isSubmitting ? 'Sending Invite...' : 'Send Invite'}
                  </Button>

                  {/* Info Box */}
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <UserAddOutlined style={{ fontSize: 20, color: 'var(--mui-palette-primary-main)', marginTop: 2 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                          What happens next?
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          The landlord will receive an email with a secure invitation link. When they click the link,
                          they'll be able to create an account using either email/password or Google sign-in, then
                          complete the normal landlord registration process.
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Stack>
              </form>
            )}
          </Formik>
        </MainCard>
      </Grid>
    </Grid>
  );
}
