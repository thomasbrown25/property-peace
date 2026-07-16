import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  LinearProgress,
  Stack,
} from '@mui/material';
import { organizationAPI } from 'api';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { useOrganization } from 'contexts/OrganizationContext';

export default function CreateOrganizationDialog({ open, onClose, onCreatingStart }) {
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, updateUser } = useAuth();
  const { refreshOrganizations } = useOrganization();

  // Pre-fill with user's name if available
  useEffect(() => {
    if (user && !organizationName) {
      const firstName = user?.FirstName || user?.firstname || user?.Firstname || '';
      const lastName = user?.LastName || user?.lastname || user?.Lastname || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        setOrganizationName(fullName);
      }
    }
  }, [user, organizationName]);

  const handleCreate = async () => {
    if (!organizationName.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter an organization name',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setLoading(true);
    
    // Close dialog and show loading overlay
    onClose();
    if (onCreatingStart) {
      onCreatingStart();
    }

    try {
      const response = await organizationAPI.createOrganization(
        organizationName.trim(),
        null
      );

      if (response.success && response.data) {
        // Refresh organizations to update context
        await refreshOrganizations();

        // Update user with organization info
        if (updateUser) {
          updateUser({
            CurrentOrganizationId: response.data.id
          });
        }

        // Set organization in localStorage for axios interceptor
        localStorage.setItem('currentOrganizationId', response.data.id.toString());

        openSnackbar({
          open: true,
          message: 'Organization created successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Reload page to refresh all data with new organization context
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(response.message || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to create organization',
        variant: 'alert',
        alert: { color: 'error' }
      });
      
      // Re-open dialog on error
      if (onClose) {
        // Note: We can't easily re-open the dialog here since onClose was called
        // The error snackbar will inform the user
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        // Prevent closing by clicking outside or pressing ESC
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
      }}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h4" fontWeight={600}>
          Create Your Organization
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          To get started, please create an organization. This will be used to manage your properties and team members. You can use your business name or your personal name.
        </Typography>
        <TextField
          fullWidth
          label="Organization Name"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          placeholder="Enter organization name"
          variant="outlined"
          autoFocus
          disabled={loading}
          inputProps={{ maxLength: 255 }}
          helperText={`${organizationName.length} / 255 characters`}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'flex-end' }}>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading || !organizationName.trim()}
        >
          {loading ? 'Creating...' : 'Create Organization'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

