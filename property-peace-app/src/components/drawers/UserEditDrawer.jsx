import PropTypes from 'prop-types';
import { useEffect } from 'react';

// material-ui
import {
  Box,
  Button,
  Drawer,
  Divider,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';

// app
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import { openSnackbar } from 'api/snackbar';
import { adminUserAPI } from 'api/admin/user';

// ---------- validation ----------
const UserSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phoneNumber: Yup.string().nullable(),
  company: Yup.string().nullable(),
  dateOfBirth: Yup.date().nullable().max(new Date(), 'Date of birth cannot be in the future'),
  businessName: Yup.string().nullable(),
  businessEmail: Yup.string().email('Invalid email').nullable(),
  businessPhone: Yup.string().nullable(),
  authProvider: Yup.string().required('Auth provider is required'),
  hasSeenTutorial: Yup.boolean()
});

const UserEditDrawer = ({ user, open, onClose, onUpdateSuccess }) => {
  const formik = useFormik({
    initialValues: {
      firstName: user?.firstName || user?.firstname || '',
      lastName: user?.lastName || user?.lastname || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
      company: user?.company || '',
      dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth) : null,
      businessName: user?.businessName || '',
      businessEmail: user?.businessEmail || '',
      businessPhone: user?.businessPhone || '',
      authProvider: user?.authProvider || 'Email',
      hasSeenTutorial: user?.hasSeenTutorial || false
    },
    validationSchema: UserSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (!user?.id) {
          openSnackbar({
            open: true,
            message: 'No user selected for editing.',
            variant: 'alert',
            alert: { color: 'error' }
          });
          return;
        }

        // Format dateOfBirth for API (DateOnly format: YYYY-MM-DD)
        let dateOfBirthFormatted = null;
        if (values.dateOfBirth) {
          const date = new Date(values.dateOfBirth);
          // Ensure we get the date in YYYY-MM-DD format
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          dateOfBirthFormatted = `${year}-${month}-${day}`;
        }

        const payload = {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phoneNumber: values.phoneNumber || null,
          company: values.company || null,
          dateOfBirth: dateOfBirthFormatted,
          businessName: values.businessName || null,
          businessEmail: values.businessEmail || null,
          businessPhone: values.businessPhone || null,
          authProvider: values.authProvider,
          hasSeenTutorial: values.hasSeenTutorial
        };

        const response = await adminUserAPI.updateUser(user.id, payload);

        if (response.success) {
          openSnackbar({
            open: true,
            message: 'User updated successfully.',
            variant: 'alert',
            alert: { color: 'success' }
          });

          if (onUpdateSuccess) {
            onUpdateSuccess();
          }
          onClose();
        } else {
          openSnackbar({
            open: true,
            message: response.message || 'Failed to update user.',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error updating user:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update user.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue } = formik;

  const handleCancel = () => {
    formik.resetForm();
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleCancel}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600, md: 700 },
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
          {/* Header */}
          <Toolbar sx={{ px: 2.5 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Edit User
            </Typography>
            <IconButton onClick={handleCancel} size="large">
              <CloseOutlined />
            </IconButton>
          </Toolbar>
          <Divider />

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            <Grid container spacing={3}>
              {/* Personal Information */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Personal Information
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={values.firstName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.firstName && Boolean(errors.firstName)}
                  helperText={touched.firstName && errors.firstName}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={values.lastName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.lastName && Boolean(errors.lastName)}
                  helperText={touched.lastName && errors.lastName}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.email && Boolean(errors.email)}
                  helperText={touched.email && errors.email}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  name="phoneNumber"
                  value={values.phoneNumber || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.phoneNumber && Boolean(errors.phoneNumber)}
                  helperText={touched.phoneNumber && errors.phoneNumber}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Company"
                  name="company"
                  value={values.company || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.company && Boolean(errors.company)}
                  helperText={touched.company && errors.company}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Date of Birth"
                    value={values.dateOfBirth}
                    onChange={(newValue) => {
                      setFieldValue('dateOfBirth', newValue);
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: touched.dateOfBirth && Boolean(errors.dateOfBirth),
                        helperText: touched.dateOfBirth && errors.dateOfBirth
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              {/* Business Information */}
              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Divider />
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Business Information
                </Typography>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Business Name"
                  name="businessName"
                  value={values.businessName || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.businessName && Boolean(errors.businessName)}
                  helperText={touched.businessName && errors.businessName}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Business Email"
                  name="businessEmail"
                  type="email"
                  value={values.businessEmail || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.businessEmail && Boolean(errors.businessEmail)}
                  helperText={touched.businessEmail && errors.businessEmail}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Business Phone"
                  name="businessPhone"
                  value={values.businessPhone || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={touched.businessPhone && Boolean(errors.businessPhone)}
                  helperText={touched.businessPhone && errors.businessPhone}
                />
              </Grid>

              {/* Account Information */}
              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Divider />
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Account Information
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Auth Provider</InputLabel>
                  <Select
                    name="authProvider"
                    value={values.authProvider}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={touched.authProvider && Boolean(errors.authProvider)}
                    label="Auth Provider"
                  >
                    <MenuItem value="Email">Email</MenuItem>
                    <MenuItem value="Google">Google</MenuItem>
                    <MenuItem value="Email,Google">Email, Google</MenuItem>
                    <MenuItem value="Apple">Apple</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Has Seen Tutorial</InputLabel>
                  <Select
                    name="hasSeenTutorial"
                    value={values.hasSeenTutorial ? 'true' : 'false'}
                    onChange={(e) => {
                      setFieldValue('hasSeenTutorial', e.target.value === 'true');
                    }}
                    onBlur={formik.handleBlur}
                    label="Has Seen Tutorial"
                  >
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Created Date (Read-only) */}
              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Divider />
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  System Information
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Created Date"
                  value={user?.createDate ? new Date(user.createDate).toLocaleDateString() : 'N/A'}
                  InputProps={{
                    readOnly: true
                  }}
                  disabled
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Footer */}
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? <CircularWithPath size={20} /> : 'Save Changes'}
              </Button>
            </Stack>
          </Box>
        </Form>
      </FormikProvider>
    </Drawer>
  );
};

UserEditDrawer.propTypes = {
  user: PropTypes.object,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func
};

export default UserEditDrawer;

