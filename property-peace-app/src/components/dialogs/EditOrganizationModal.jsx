import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  alpha,
  Typography
} from '@mui/material';
import { BankOutlined } from '@ant-design/icons';
import { organizationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { useOrganization } from 'contexts/OrganizationContext';

export default function EditOrganizationModal({ open, onClose, organization }) {
  const { refreshOrganizations } = useOrganization();
  const [orgName, setOrgName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form data when modal opens or organization changes
  useEffect(() => {
    if (open && organization) {
      setOrgName(organization.name || '');
      setError(null);
    }
  }, [open, organization]);

  const handleClose = () => {
    if (!updating) {
      setError(null);
      onClose();
    }
  };

  const handleSave = async () => {
    if (!organization?.id || !orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      const response = await organizationAPI.updateOrganization(
        organization.id,
        orgName.trim(),
        null
      );

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Organization updated successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh organizations to get updated data
        if (refreshOrganizations) {
          await refreshOrganizations();
        }

        handleClose();
      } else {
        throw new Error(response.message || 'Failed to update organization');
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      setError(error.response?.data?.message || error.message || 'Failed to update organization');
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to update organization',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <BankOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Typography variant="h6" fontWeight="bold">
            Edit Organization
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <TextField
            label="Organization Name"
            type="text"
            fullWidth
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="My Organization"
            inputProps={{ maxLength: 255 }}
            helperText={`${orgName.length} / 255 characters`}
            disabled={updating}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={updating}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!orgName.trim() || updating}
          startIcon={updating ? <CircularProgress size={16} /> : null}
        >
          {updating ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
