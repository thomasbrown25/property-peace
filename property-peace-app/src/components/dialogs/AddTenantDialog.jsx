import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Box,
  Divider,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { tenantInviteAPI } from 'api';
import { getAllTenants } from 'store/tenant/tenant.action';
import { TENANT_ACTION_TYPES } from 'store/tenant/tenant.types';
import { selectProperty } from 'store/property/property.selector';
import useFetchTenants from 'hooks/useFetchTenants';
import useAuth from 'hooks/useAuth';
import { CheckCircleOutlined } from '@ant-design/icons';

export default function AddTenantDialog({ open, onClose, onSuccess, unitId = null, leaseId = null, property: propertyProp = null }) {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  /** Use prop when provided (e.g. from People on Lease page), otherwise Redux selectedProperty */
  const effectiveProperty = propertyProp ?? selectedProperty;
  const { refetch } = useFetchTenants();
  const [inviting, setInviting] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingUser, setExistingUser] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [shouldShowConfirmDialog, setShouldShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  const [inviteForm, setInviteForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phoneNumber: '',
    sendInvite: true // Default to sending invite
  });

  const handleClose = (event, reason) => {
    // Prevent closing during critical operations
    if (reason === 'backdropClick' && (inviting || checkingEmail || showConfirmDialog)) {
      return;
    }
    
    // If escape key is pressed during operations, prevent closing
    if (reason === 'escapeKeyDown' && (inviting || checkingEmail || showConfirmDialog)) {
      return;
    }
    
    // Close nested dialogs first
    setShowConfirmDialog(false);
    setShouldShowConfirmDialog(false);
    setShowSuccessDialog(false);
    
    // Move focus away from dialog before closing to prevent aria-hidden warning
    // Blur any active element immediately
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    
    // Call parent's onClose to ensure dialog closes
    onClose();
    
    // Reset state after a small delay to ensure dialog is fully closed
    setTimeout(() => {
      setInviteForm({
        firstname: '',
        lastname: '',
        email: '',
        phoneNumber: '',
        sendInvite: true
      });
      setExistingUser(null);
      setCheckingEmail(false);
      setInviting(false);
    }, 150);
  };

  const handleSubmit = async () => {
    // Validate form
    if (!inviteForm.firstname || !inviteForm.lastname) {
      openSnackbar({
        open: true,
        message: 'Please fill in First name and Last name',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Email is required if sending invite
    if (inviteForm.sendInvite && !inviteForm.email) {
      openSnackbar({
        open: true,
        message: 'Email is required when sending an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Validate email format if provided
    if (inviteForm.email && !inviteForm.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      openSnackbar({
        open: true,
        message: 'Please enter a valid email address',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // If email is provided and sending invite, check if user already exists BEFORE creating tenant
    if (inviteForm.email && inviteForm.sendInvite) {
      setCheckingEmail(true);
      try {
        // First check if email exists
        const emailCheckResponse = await axiosServices.post('/api/user/check-email', {
          email: inviteForm.email.trim()
        });

        if (emailCheckResponse.data?.success && emailCheckResponse.data?.data === true) {
          // Email exists, get user details
          try {
            const userResponse = await axiosServices.post('/api/user/get-by-email', {
              email: inviteForm.email.trim()
            });

            if (userResponse.data?.success && userResponse.data?.data) {
              // Show confirmation dialog with user details - DON'T create tenant yet
              // Set state synchronously
              const userData = userResponse.data.data;
              
              // Set all state at once
              setExistingUser(userData);
              setShouldShowConfirmDialog(true);
              setShowConfirmDialog(true);
              setCheckingEmail(false);
              
              // Don't close modal, don't create tenant - wait for user confirmation
              return;
            }
          } catch (userError) {
            // If we can't get user details, continue with normal flow
          }
        }
      } catch (error) {
        // If check fails, continue with normal flow
      } finally {
        setCheckingEmail(false);
      }
    }

    // Proceed with normal tenant creation flow (only if no existing user found)
    // Double-check that we're not showing confirmation dialog
    if (showConfirmDialog || existingUser || shouldShowConfirmDialog) {
      return;
    }
    
    await createTenant();
  };

  const createTenant = async () => {
    setInviting(true);
    try {
      // Create tenant payload
      const tenantPayload = {
        PropertyId: effectiveProperty?.id ?? effectiveProperty?.Id ?? null,
        UnitId: unitId || null,
        LeaseId: leaseId || null,
        Firstname: inviteForm.firstname.trim(),
        Lastname: inviteForm.lastname.trim(),
        Email: inviteForm.email?.trim() || null,
        PhoneNumber: inviteForm.phoneNumber?.trim() || null
      };

      // Save tenant first
      const saveResponse = await axiosServices.post('/api/tenant', tenantPayload);
      const tenantId = saveResponse.data?.data?.Id || saveResponse.data?.data?.id;
      const savedTenant = saveResponse.data?.data;

      if (!tenantId) {
        openSnackbar({
          open: true,
          message: 'Failed to create tenant.',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setInviting(false);
        return;
      }

      // Update Redux store with the saved tenant
      if (savedTenant) {
        dispatch({
          type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS,
          payload: savedTenant
        });
      }

      // Send invite if requested and email is provided
      let inviteResponse = null;
      if (inviteForm.sendInvite && inviteForm.email) {
        try {
          inviteResponse = await tenantInviteAPI.createTenantInvite({
            tenantId: tenantId,
            email: inviteForm.email.trim()
          });
          
          // Check if backend indicates account already exists (shouldn't happen here, but handle it)
          if (inviteResponse?.success && inviteResponse?.message && 
              inviteResponse.message.includes('already exists')) {
            // This shouldn't happen since we check before, but handle gracefully
            console.warn('Backend indicates existing account during invite - this should have been caught earlier');
          }
        } catch (inviteError) {
          // Check if error is about existing user
          const errorMessage = inviteError?.response?.data?.message || inviteError?.message || '';
          if (errorMessage.includes('already exists') || errorMessage.includes('already has an account')) {
            // User exists - we should have caught this earlier, but handle it
            console.error('Error: Existing user detected during invite creation:', inviteError);
            openSnackbar({
              open: true,
              message: 'A user with this email already exists. Please use the confirmation dialog to connect them.',
              variant: 'alert',
              alert: { color: 'warning' }
            });
            // Don't close modal - let user see the error
            setInviting(false);
            return;
          }
          
          // Other errors
          console.error('Error sending invite:', inviteError);
          openSnackbar({
            open: true,
            message: 'Tenant created but failed to send invite. You can send it later.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }
      }

      // Refresh tenant list to include the new tenant
      await dispatch(getAllTenants());
      await refetch();

      // Show success modal if invite was sent, otherwise just close
      if (inviteForm.sendInvite && inviteForm.email && inviteResponse?.success) {
        setSuccessEmail(inviteForm.email);
        setInviting(false);
        setShowSuccessDialog(true);
        // Don't close the main dialog yet - wait for user to choose action
        return; // Exit early to prevent closing
      } else {
        // No invite sent, just show snackbar and close
        openSnackbar({
          open: true,
          message: 'Tenant created successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        
        // Reset form and close dialog
        setInviteForm({
          firstname: '',
          lastname: '',
          email: '',
          phoneNumber: '',
          sendInvite: true
        });
        
        handleClose();
        
        // Check if user hasn't seen tutorial and should reopen wizard
        const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
        const shouldReopenWizard = !hasSeenTutorial;
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(savedTenant, shouldReopenWizard);
        }
      }
    } catch (inviteError) {
      console.error('Error creating tenant or sending invite:', inviteError);
      openSnackbar({
        open: true,
        message: inviteError?.response?.data?.message || 'Failed to create tenant or send invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmExistingUser = async () => {
    if (!existingUser || !effectiveProperty) {
      return;
    }

    setInviting(true);
    setShowConfirmDialog(false);

    try {
      const email = existingUser.email || existingUser.Email || inviteForm.email?.trim();
      
      // Always create a placeholder tenant for this property/unit (even if tenant exists elsewhere)
      // When they accept the invite, the existing tenant will be updated with new unitId/leaseId
      const tenantPayload = {
        PropertyId: effectiveProperty?.id ?? effectiveProperty?.Id ?? null,
        UnitId: unitId || null, // Use provided unitId if available
        LeaseId: leaseId || null, // Use provided leaseId if available
        Firstname: existingUser.firstname || existingUser.Firstname || inviteForm.firstname.trim(),
        Lastname: existingUser.lastname || existingUser.Lastname || inviteForm.lastname.trim(),
        Email: email,
        PhoneNumber: inviteForm.phoneNumber?.trim() || existingUser.phoneNumber || existingUser.PhoneNumber || null,
        UserId: null // Explicitly set to null - will be updated when tenant accepts invite
      };
      
      const saveResponse = await axiosServices.post('/api/tenant', tenantPayload);
      const tenantId = saveResponse.data?.data?.Id || saveResponse.data?.data?.id;
      const placeholderTenant = saveResponse.data?.data;

      if (!tenantId) {
        openSnackbar({
          open: true,
          message: 'Failed to create tenant invite.',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setInviting(false);
        return;
      }

      // Update Redux store
      if (placeholderTenant) {
        dispatch({
          type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS,
          payload: placeholderTenant
        });
      }

      // Send invite to join property (tenant record will be updated when they accept)
      try {
        const inviteResponse = await tenantInviteAPI.createTenantInvite({
          tenantId: tenantId,
          email: email
        });

        if (inviteResponse?.success) {
          // Show success modal instead of snackbar
          setSuccessEmail(email);
          setInviting(false);
          setShowSuccessDialog(true);
          // Don't close the main dialog yet - wait for user to choose action
          return; // Exit early to prevent closing
        } else {
          throw new Error(inviteResponse?.message || 'Failed to send invite');
        }
      } catch (inviteError) {
        console.error('Error sending invite:', inviteError);
        openSnackbar({
          open: true,
          message: 'Failed to send invite. You can send it later.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
      }

      // Refresh tenant list
      await dispatch(getAllTenants());
      await refetch();
      
      // If we got here and no success dialog was shown, close normally
      setInviting(false);
      setExistingUser(null);
      handleClose();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(placeholderTenant, false);
      }
    } catch (error) {
      console.error('Error adding existing user as tenant:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to add tenant',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setInviting(false);
    }
  };

  const handleCancelExistingUser = () => {
    // Move focus away before closing nested dialog
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    setShowConfirmDialog(false);
    setShouldShowConfirmDialog(false);
    setExistingUser(null);
    // Don't close the main modal - let user continue editing or cancel manually
  };
  
  // Reset all state when main dialog closes
  useEffect(() => {
    if (!open) {
      // Use a timeout to ensure dialog is fully unmounted before resetting
      const timeoutId = setTimeout(() => {
        setInviteForm({
          firstname: '',
          lastname: '',
          email: '',
          phoneNumber: '',
          sendInvite: true
        });
        setExistingUser(null);
        setShowConfirmDialog(false);
        setShouldShowConfirmDialog(false);
        setShowSuccessDialog(false);
        setCheckingEmail(false);
        setInviting(false);
      }, 300); // Wait for transition to complete
      
      return () => clearTimeout(timeoutId);
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Ensure all state is reset when component unmounts
      setShowConfirmDialog(false);
      setShouldShowConfirmDialog(false);
      setShowSuccessDialog(false);
      setCheckingEmail(false);
      setInviting(false);
    };
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="xs" 
        fullWidth
        disableEscapeKeyDown={checkingEmail || inviting || showConfirmDialog}
        keepMounted={false}
        hideBackdrop={false}
        disableRestoreFocus={true}
        transitionDuration={0}
        PaperProps={{
          sx: {
            marginTop: '10vh',
            margin: '10vh auto 0'
          }
        }}
      >
        <DialogTitle>Add New Tenant</DialogTitle>
        <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter the tenant's information. You can optionally send them an invitation email to create an account.
          </Typography>
          <TextField
            fullWidth
            label="First Name *"
            value={inviteForm.firstname}
            onChange={(e) => setInviteForm({ ...inviteForm, firstname: e.target.value })}
            required
          />
          <TextField
            fullWidth
            label="Last Name *"
            value={inviteForm.lastname}
            onChange={(e) => setInviteForm({ ...inviteForm, lastname: e.target.value })}
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            helperText={inviteForm.sendInvite ? "Required if sending invite" : "Optional"}
          />
          <TextField
            fullWidth
            label="Phone Number"
            value={inviteForm.phoneNumber}
            onChange={(e) => setInviteForm({ ...inviteForm, phoneNumber: e.target.value })}
          />
          <Divider />
          <FormControlLabel
            control={
              <Checkbox
                checked={inviteForm.sendInvite}
                onChange={(e) => setInviteForm({ ...inviteForm, sendInvite: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  Invite to Tenant Portal
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  The tenant will receive an email with a link to join
                </Typography>
              </Box>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={inviting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={inviting || checkingEmail || !inviteForm.firstname || !inviteForm.lastname || (inviteForm.sendInvite && !inviteForm.email)}
          startIcon={(inviting || checkingEmail) ? <CircularProgress size={16} /> : null}
        >
          {checkingEmail 
            ? 'Checking...'
            : inviting 
              ? (inviteForm.sendInvite ? 'Creating & Sending Invite...' : 'Creating...')
              : (inviteForm.sendInvite ? 'Invite to use Tenant Portal' : 'Create Tenant')
          }
        </Button>
      </DialogActions>
    </Dialog>

    {/* Confirmation Dialog for Existing User */}
    <Dialog 
      open={showConfirmDialog && open} 
      onClose={handleCancelExistingUser} 
      maxWidth="xs" 
      fullWidth
      disableEscapeKeyDown={inviting}
      keepMounted={false}
      disableRestoreFocus={true}
    >
      <DialogTitle>User Already Exists</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            A user with this email address already exists in the system.
          </Alert>
          
          {existingUser && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                User Details:
              </Typography>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">First Name</Typography>
                  <Typography variant="body2">{existingUser.firstname || existingUser.Firstname || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Last Name</Typography>
                  <Typography variant="body2">{existingUser.lastname || existingUser.Lastname || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{existingUser.email || existingUser.Email || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Account Created</Typography>
                  <Typography variant="body2">
                    {formatDate(existingUser.createDate || existingUser.CreateDate)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}

          <Typography variant="body2" color="text.secondary">
            Is this your tenant? If yes, we'll add them to your property and send them an invite to join.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelExistingUser} disabled={inviting}>
          No, Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirmExistingUser}
          disabled={inviting}
          startIcon={inviting ? <CircularProgress size={16} /> : null}
        >
          {inviting ? 'Adding...' : 'Yes, Add to Property'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Success Dialog */}
    <Dialog 
      open={showSuccessDialog && open} 
      onClose={() => {
        // Move focus away before closing
        if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        setShowSuccessDialog(false);
        handleClose();
        if (onSuccess) {
          onSuccess(null, false);
        }
      }}
      maxWidth="sm" 
      fullWidth
      keepMounted={false}
      disableRestoreFocus={true}
    >
      <DialogContent sx={{ textAlign: 'center', py: 4 }}>
        <CheckCircleOutlined
          style={{
            fontSize: 64,
            color: '#41a541',
            marginBottom: 16
          }}
        />
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Invite Sent Successfully!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          An invitation email has been sent to <strong>{successEmail}</strong>. 
          They will be connected to this property once they accept the invite.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3, px: 3 }}>
        <Button
          variant="outlined"
          onClick={() => {
            // Move focus away before closing
            if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
              document.activeElement.blur();
            }
            setShowSuccessDialog(false);
            handleClose();
            if (onSuccess) {
              onSuccess(null, false);
            }
          }}
          sx={{ minWidth: 150 }}
        >
          Go Back to Lease
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            // Move focus away before closing nested dialog
            if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
              document.activeElement.blur();
            }
            setShowSuccessDialog(false);
            // Reset form to add another tenant
            setInviteForm({
              firstname: '',
              lastname: '',
              email: '',
              phoneNumber: '',
              sendInvite: true
            });
            setExistingUser(null);
            // Keep the dialog open for adding another tenant
          }}
          sx={{ minWidth: 150 }}
        >
          Add Another Tenant
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

