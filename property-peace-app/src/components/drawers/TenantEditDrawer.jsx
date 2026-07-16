import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

// material-ui
import { Box, Button, Drawer, Divider, Stack, Typography, TextField, FormControlLabel, Checkbox, CircularProgress, IconButton, alpha, useTheme } from '@mui/material';
import SendOutlined from '@ant-design/icons/SendOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';

// app
import { useDrawer } from 'contexts/DrawerContext';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import { openSnackbar } from 'api/snackbar';

// hooks
import { useDispatch } from 'react-redux';
import useAuth from 'hooks/useAuth';
import useFetchTenants from 'hooks/useFetchTenants';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';

// api
import { addOrUpdateTenant } from 'store/tenant/tenant.action';
import { tenantInviteAPI } from 'api';

// ---------- validation ----------
const getTenantSchema = (sendInvite) => Yup.object().shape({
  firstname: Yup.string().required('First name is required'),
  lastname: Yup.string().required('Last name is required'),
  email: sendInvite 
    ? Yup.string().email('Invalid email').required('Email is required when sending invite')
    : Yup.string().email('Invalid email').nullable(),
  phoneNumber: Yup.string().nullable(),
  password: Yup.string().nullable()
});

const buildInitialValues = (tenant, originalAccountMethod) => {
  if (!tenant) {
    return {
      firstname: '',
      lastname: '',
      email: '',
      phoneNumber: '',
      password: '',
      accountCreationMethod: originalAccountMethod || null
    };
  }
  return {
    id: tenant.id,
    firstname: tenant.firstname || '',
    lastname: tenant.lastname || '',
    email: tenant.email || '',
    phoneNumber: tenant.phoneNumber || '',
    password: '',
    accountCreationMethod: originalAccountMethod || null
  };
};

export default function TenantEditDrawer({ tenant, open, onClose, onUpdateSuccess }) {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const drawerBorder = isDarkMode ? alpha(theme.palette.primary.main, 0.18) : theme.palette.divider;
  const drawerSurface = isDarkMode ? theme.palette.background.default : '#ffffff';
  const drawerHeaderSurface = isDarkMode ? alpha(theme.palette.background.paper, 0.88) : '#ffffff';
  const drawerFooterSurface = isDarkMode ? alpha(theme.palette.background.paper, 0.94) : theme.palette.background.paper;
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const { refetch: refetchTenants } = useFetchTenants();

  // Use drawer context if available, otherwise use props
  const isOpen = open !== undefined ? open : drawer.isOpenTenantEdit;
  const selectedTenant = tenant || drawer.selectedTenant;
  const handleClose = onClose || drawer.closeTenantEditDrawer;

  const [loading, setLoading] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [tenantInvites, setTenantInvites] = useState([]);
  const [originalAccountMethod, setOriginalAccountMethod] = useState(null); // 'invite', 'create', or null
  const [resendingInvite, setResendingInvite] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendInvite, setSendInvite] = useState(false);

  // Fetch tenant invites when modal opens and tenant is selected
  useEffect(() => {
    const fetchInvites = async () => {
      if (open && selectedTenant?.id) {
        setLoadingInvites(true);
        try {
          const response = await tenantInviteAPI.getInvitesByTenantId(selectedTenant.id);
          if (response.success && response.data) {
            setTenantInvites(response.data);
            
            // Determine original account creation method
            const hasUserId = selectedTenant.userId || selectedTenant.UserId;
            const hasInvites = response.data && response.data.length > 0;
            
            if (hasUserId) {
              setOriginalAccountMethod('create');
            } else if (hasInvites) {
              setOriginalAccountMethod('invite');
              setSendInvite(true); // If invite already sent, check the checkbox
            } else {
              setOriginalAccountMethod(null);
            }
          }
        } catch (error) {
          console.error('Error fetching tenant invites:', error);
        } finally {
          setLoadingInvites(false);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchInvites();
  }, [isOpen, selectedTenant]);

  // Calculate hasAccount before useEffects that use it
  const hasAccount = !!(selectedTenant?.userId || selectedTenant?.UserId);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTenantInvites([]);
      setOriginalAccountMethod(null);
      setSendInvite(false);
    }
  }, [isOpen]);

  const formik = useFormik({
    initialValues: buildInitialValues(selectedTenant, originalAccountMethod || 'invite'),
    validationSchema: getTenantSchema(sendInvite),
    enableReinitialize: true,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (!selectedTenant) {
          openSnackbar({
            open: true,
            message: 'No tenant selected for editing.',
            variant: 'alert',
            alert: { color: 'error' }
          });
          return;
        }

        // Validate email if sendInvite is checked
        if (sendInvite && !values.email) {
          openSnackbar({
            open: true,
            message: 'Email is required when sending invite',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        const payload = {
          id: selectedTenant.id,
          leaseId: selectedTenant.leaseId || null,
          unitId: selectedTenant.unitId || null,
          propertyId: selectedTenant.propertyId || null,
          firstname: values.firstname,
          lastname: values.lastname,
          email: values.email || null,
          phoneNumber: values.phoneNumber || null
        };

        console.log('Updating tenant with payload:', payload);
        await dispatch(addOrUpdateTenant(payload));

        // Send invite if checkbox is checked
        if (sendInvite && values.email) {
          try {
            await tenantInviteAPI.createTenantInvite({
              tenantId: selectedTenant.id,
              email: values.email.trim()
            });
          } catch (inviteError) {
            console.error('Error sending invite:', inviteError);
            // Don't fail the tenant update if invite fails
            openSnackbar({
              open: true,
              message: 'Tenant updated but failed to send invite. You can resend it later.',
              variant: 'alert',
              alert: { color: 'warning' }
            });
          }
        }

        // Refetch tenants and dashboard data to ensure UI is updated
        await Promise.all([
          refetchTenants(),
          mutate(dashboardEndpoints.summary(user.id))
        ]);

        openSnackbar({
          open: true,
          message: sendInvite ? 'Tenant updated and invite sent successfully.' : 'Tenant updated successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        resetForm();
        if (onUpdateSuccess) {
          await onUpdateSuccess();
        }
        handleClose();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update tenant.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue } = formik;

  const latestInvite = tenantInvites && tenantInvites.length > 0 ? tenantInvites[0] : null;
  const hasInviteSent = !hasAccount && tenantInvites && tenantInvites.length > 0;

  const handleResendInvite = async () => {
    if (!selectedTenant?.id || !values.email) {
      openSnackbar({
        open: true,
        message: 'Email is required to send an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setResendingInvite(true);
      // Create a new invite (not resend the old one)
      const response = await tenantInviteAPI.createTenantInvite({
        tenantId: selectedTenant.id,
        email: values.email.trim()
      });
      
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'New invite link sent successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        // Refresh invites
        const refreshResponse = await tenantInviteAPI.getInvitesByTenantId(selectedTenant.id);
        if (refreshResponse.success && refreshResponse.data) {
          setTenantInvites(refreshResponse.data);
        }
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to send invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to send invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setResendingInvite(false);
    }
  };

  const handleSendNewInvite = async () => {
    if (!values.email || !selectedTenant?.id) {
      openSnackbar({
        open: true,
        message: 'Email is required to send an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setSendingInvite(true);
      const response = await tenantInviteAPI.createTenantInvite({
        tenantId: selectedTenant.id,
        email: values.email
      });

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Invite sent successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        // Refresh invites and update original method
        const refreshResponse = await tenantInviteAPI.getInvitesByTenantId(selectedTenant.id);
        if (refreshResponse.success && refreshResponse.data) {
          setTenantInvites(refreshResponse.data);
          setOriginalAccountMethod('invite');
          setFieldValue('accountCreationMethod', 'invite');
        }
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to send invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to send invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!values.email || !selectedTenant?.id) {
      openSnackbar({
        open: true,
        message: 'Email is required to create an account',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    if (!values.firstname || !values.lastname) {
      openSnackbar({
        open: true,
        message: 'First name and last name are required to create an account',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    if (!values.password) {
      openSnackbar({
        open: true,
        message: 'Password is required to create an account',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setSendingInvite(true); // Reuse this state for loading
      const axiosServices = (await import('utils/axios')).default;
      
      const registerResponse = await axiosServices.post('/api/user/register', {
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstname,
        lastName: values.lastname,
        phoneNumber: values.phoneNumber || null,
        roles: ['Tenant'],
        tenantId: selectedTenant.id
      });

      if (registerResponse.data?.success && registerResponse.data?.data?.Id) {
        const userId = registerResponse.data.data.Id || registerResponse.data.data.id;
        
        // Update tenant with userId
        const payload = {
          id: selectedTenant.id,
          leaseId: selectedTenant.leaseId || null,
          unitId: selectedTenant.unitId || null,
          propertyId: selectedTenant.propertyId || null,
          firstname: values.firstname,
          lastname: values.lastname,
          email: values.email || null,
          phoneNumber: values.phoneNumber || null,
          userId: userId
        };

        await dispatch(addOrUpdateTenant(payload));
        
        // Refresh data
        await Promise.all([
          refetchTenants(),
          mutate(dashboardEndpoints.summary(user.id))
        ]);

        openSnackbar({
          open: true,
          message: 'Account created successfully! The tenant can now log in.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        setOriginalAccountMethod('create');
        setFieldValue('accountCreationMethod', 'create');
        
        // Close modal after a short delay
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error(registerResponse.data?.message || 'Failed to create account');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to create account',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading || loadingInvites) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  if (!selectedTenant) {
    return null;
  }

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520 },
          maxWidth: '100%',
          bgcolor: drawerSurface,
          backgroundImage: isDarkMode ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 180px)` : 'none',
          color: 'text.primary',
          borderLeft: `1px solid ${drawerBorder}`,
          boxShadow: isDarkMode ? `-18px 0 44px ${alpha('#020617', 0.45)}` : undefined
        }
      }}
    >
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${drawerBorder}`, bgcolor: drawerHeaderSurface }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="h5" fontWeight={700}>Edit Tenant</Typography>
                <IconButton size="small" onClick={handleClose} disabled={isSubmitting}>
                  <CloseOutlined />
                </IconButton>
              </Stack>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Update the tenant's information and manage their account access.
                </Typography>

                {/* Show account status if tenant already has account */}
                {hasAccount && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Account Status
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      ✓ Tenant has an active account
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ borderColor: drawerBorder }} />

                <TextField
                  fullWidth
                  label="First Name *"
                  name="firstname"
                  value={values.firstname}
                  onChange={(e) => setFieldValue('firstname', e.target.value)}
                  error={touched.firstname && !!errors.firstname}
                  helperText={touched.firstname && errors.firstname}
                  required
                />
                <TextField
                  fullWidth
                  label="Last Name *"
                  name="lastname"
                  value={values.lastname}
                  onChange={(e) => setFieldValue('lastname', e.target.value)}
                  error={touched.lastname && !!errors.lastname}
                  helperText={touched.lastname && errors.lastname}
                  required
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  name="email"
                  value={values.email || ''}
                  onChange={(e) => setFieldValue('email', e.target.value)}
                  error={touched.email && !!errors.email}
                  helperText={touched.email ? errors.email : (sendInvite ? "Required if sending invite" : "Optional")}
                  required={sendInvite}
                  disabled={hasAccount}
                />
                <FormInput
                  fullWidth
                  label="Phone Number"
                  name="phoneNumber"
                  value={values.phoneNumber || ''}
                  setFieldValue={setFieldValue}
                  touched={Boolean(touched.phoneNumber)}
                  errorText={errors.phoneNumber}
                  valueType="phone"
                />
                {!hasAccount && (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={sendInvite}
                          onChange={(e) => setSendInvite(e.target.checked)}
                          disabled={hasInviteSent}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            Send invitation email to create account
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            The tenant will receive an email with a link to create their account
                          </Typography>
                        </Box>
                      }
                    />
                    {hasInviteSent && (
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={
                          resendingInvite
                            ? <CircularProgress size={14} />
                            : <ReloadOutlined />
                        }
                        onClick={handleResendInvite}
                        disabled={resendingInvite || !values.email}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {resendingInvite ? 'Sending...' : 'Re-send Invite Link'}
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            </Box>
            <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${drawerBorder}`, bgcolor: drawerFooterSurface, boxShadow: isDarkMode ? `0 -12px 28px ${alpha('#020617', 0.22)}` : 'none' }}>
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button 
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={isSubmitting || (sendInvite && !values.email)}
                  startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                >
                  {isSubmitting 
                    ? (sendInvite ? 'Saving & Sending...' : 'Saving...') 
                    : (sendInvite ? 'Save & Send Invite' : 'Save Tenant')
                  }
                </Button>
              </Stack>
            </Box>
          </Form>
        </LocalizationProvider>
      </FormikProvider>
    </Drawer>
  );
}

TenantEditDrawer.propTypes = {
  tenant: PropTypes.any,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func
};

