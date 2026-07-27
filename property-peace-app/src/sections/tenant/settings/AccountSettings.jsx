import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha
} from '@mui/material';
import { DeleteOutlined, LockOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import PasskeySettingsCard from 'components/security/PasskeySettingsCard';
import useAuth from 'hooks/useAuth';

// ==============================|| TENANT ACCOUNT SETTINGS ||============================== //

export default function AccountSettings() {
  const { logout } = useAuth();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const closeDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteDialogOpen(false);
    setDeleteConfirmation('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;

    setDeleteLoading(true);
    try {
      await axiosServices.delete('/api/user');
      await logout();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to delete your account',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setDeleteLoading(false);
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
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderColor: (theme) => alpha(theme.palette.error.main, 0.35),
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.025)
          }}
        >
          <Stack spacing={2} alignItems="flex-start">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeleteOutlined style={{ fontSize: 20, color: '#d32f2f' }} />
              <Typography variant="h6" fontWeight="bold" color="error.main">
                Delete account
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Delete your tenant portal account and sign out on all devices. This is a soft delete: records that your property manager must
              retain, such as lease and payment history, will remain available to them.
            </Typography>
            <Button color="error" variant="outlined" onClick={() => setDeleteDialogOpen(true)}>
              Delete my account
            </Button>
          </Stack>
        </Paper>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="error">
              You will immediately lose access to the tenant portal. This action cannot be undone from your account.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Type <strong>DELETE</strong> to confirm.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deleteLoading}
              inputProps={{ autoComplete: 'off' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeDeleteDialog} disabled={deleteLoading} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            disabled={deleteConfirmation !== 'DELETE' || deleteLoading}
            color="error"
            variant="contained"
          >
            {deleteLoading ? 'Deleting...' : 'Delete account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

