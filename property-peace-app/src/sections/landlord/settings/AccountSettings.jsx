import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Stack, Paper, TextField, Button, alpha, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, InputAdornment, IconButton } from '@mui/material';
import { LockOutlined, StopOutlined, CreditCardOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { subscriptionAPI } from 'api';
import useAuth from 'hooks/useAuth';
import AuthenticationMethodsCard from 'components/security/AuthenticationMethodsCard';

// ==============================|| ACCOUNT SETTINGS ||============================== //

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, reloadUser } = useAuth();
  const isSetPasswordFlow = user?.hasPassword === false;
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablingAccount, setDisablingAccount] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword.length < 6) {
      openSnackbar({
        open: true,
        message: 'Password must be at least 6 characters',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
      return;
    }

    if (!isSetPasswordFlow && !passwordData.currentPassword.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter your current password',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
      return;
    }

    setPasswordLoading(true);
    setPasswordSuccess(false);

    try {
      const response = await axiosServices.post('/api/user/change-password', {
        currentPassword: isSetPasswordFlow ? '' : passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: response.data?.message || (isSetPasswordFlow ? 'Password set successfully! You can now sign in with email and password.' : 'Password updated successfully!'),
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
        setPasswordSuccess(true);
        setPasswordData({
          currentPassword: '',
          newPassword: ''
        });
        setTimeout(() => setPasswordSuccess(false), 3000);
        if (isSetPasswordFlow && typeof reloadUser === 'function') {
          await reloadUser();
        }
      } else {
        throw new Error(response.data?.message || 'Failed to update password');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to update password',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDisableAccount = async () => {
    setDisablingAccount(true);
    try {
      const response = await axiosServices.post('/api/user/disable-account');
      
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Account has been disabled successfully',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
        setDisableDialogOpen(false);
        // Optionally redirect to login or show a message
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        throw new Error(response.data?.message || 'Failed to disable account');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to disable account',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setDisablingAccount(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const returnUrl = `${window.location.origin}/landlord/settings?tab=account`;
      const response = await subscriptionAPI.createCustomerPortalSession(returnUrl);
      
      if (response.success && response.data) {
        // Redirect to Stripe customer portal
        // Response.data is the URL string directly
        window.location.href = response.data;
      } else {
        throw new Error(response.message || 'Failed to create customer portal session');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to open subscription management',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LockOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Password & Security
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isSetPasswordFlow
              ? 'Since you signed up with Google you can set a password here to also sign in with email and password.'
              : user?.authProvider === 'Email,Google'
                ? 'You can sign in with either email/password or Google. Change your password below if you want to update it.'
                : 'Change your password to keep your account secure.'}
          </Typography>

          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPasswordSuccess(false)}>
              {isSetPasswordFlow ? 'Password set successfully!' : 'Password updated successfully!'}
            </Alert>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Current Password"
                name="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={isSetPasswordFlow ? '' : passwordData.currentPassword}
                onChange={handlePasswordChange}
                disabled={isSetPasswordFlow}
                variant="outlined"
                size="small"
                helperText={isSetPasswordFlow ? 'Since you signed up with Google you can set a password below.' : undefined}
                InputProps={{
                  endAdornment: !isSetPasswordFlow ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle current password visibility"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        edge="end"
                      >
                        {showCurrentPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      </IconButton>
                    </InputAdornment>
                  ) : undefined
                }}
              />
              <TextField
                label="New Password"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                variant="outlined"
                size="small"
                helperText="Password must be at least 6 characters"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle new password visibility"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        edge="end"
                      >
                        {showNewPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 2 }}>
                <Button type="submit" variant="contained" disabled={passwordLoading}>
                  {passwordLoading
                    ? (isSetPasswordFlow ? 'Setting...' : 'Updating...')
                    : (isSetPasswordFlow ? 'Set Password' : 'Update Password')}
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>

        <AuthenticationMethodsCard />

        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CreditCardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Subscription
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            View your current plan or manage your subscription settings, billing, and payment methods.
          </Typography>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={() => navigate('/landlord/settings?tab=subscription')}
              startIcon={<CreditCardOutlined />}
            >
              View Plan
            </Button>
            <Button
              variant="contained"
              onClick={handleManageSubscription}
              disabled={portalLoading}
              startIcon={<CreditCardOutlined />}
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <StopOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
            <Typography variant="h6" fontWeight="bold" color="error">
              Disable Account
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Disable your account to pause notifications and subscription. Your data will be preserved and you can reactivate your account later. This will not delete any of your information.
          </Typography>

          <Button
            variant="outlined"
            color="error"
            onClick={() => setDisableDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Disable Account
          </Button>
        </Paper>
      </Stack>

      <Dialog
        open={disableDialogOpen}
        onClose={() => !disablingAccount && setDisableDialogOpen(false)}
        aria-labelledby="disable-account-dialog-title"
        aria-describedby="disable-account-dialog-description"
      >
        <DialogTitle id="disable-account-dialog-title">
          Disable Account?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="disable-account-dialog-description">
            Are you sure you want to disable your account? This will:
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Suspend your account access</li>
              <li>Disable all email and phone notifications</li>
              <li>Pause your subscription</li>
            </ul>
            Your data will be preserved and you can contact support to reactivate your account later.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableDialogOpen(false)} disabled={disablingAccount}>
            Cancel
          </Button>
          <Button onClick={handleDisableAccount} color="error" variant="contained" disabled={disablingAccount}>
            {disablingAccount ? 'Disabling...' : 'Disable Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

