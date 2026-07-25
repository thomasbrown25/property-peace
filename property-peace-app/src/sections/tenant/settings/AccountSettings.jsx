import { useState } from 'react';
import { Box, Typography, Stack, Paper, TextField, Button, alpha, Alert } from '@mui/material';
import { LockOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import PasskeySettingsCard from 'components/security/PasskeySettingsCard';

// ==============================|| TENANT ACCOUNT SETTINGS ||============================== //

export default function AccountSettings() {
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      openSnackbar({
        open: true,
        message: 'New passwords do not match',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
      return;
    }

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

    setPasswordLoading(true);
    setPasswordSuccess(false);
    
    try {
      const response = await axiosServices.post('/api/user/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Password updated successfully!',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
        setPasswordSuccess(true);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => setPasswordSuccess(false), 3000);
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
            Change your password to keep your account secure.
          </Typography>

          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPasswordSuccess(false)}>
              Password updated successfully!
            </Alert>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Current Password"
                name="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                sx={{ maxWidth: 450 }}
                variant="outlined"
                size="small"
              />
              <TextField
                label="New Password"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                sx={{ maxWidth: 450 }}
                variant="outlined"
                size="small"
                helperText="Password must be at least 6 characters"
              />
              <TextField
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                sx={{ maxWidth: 450 }}
                variant="outlined"
                size="small"
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 2 }}>
                <Button type="submit" variant="contained" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>
        <PasskeySettingsCard />
      </Stack>
    </Box>
  );
}

