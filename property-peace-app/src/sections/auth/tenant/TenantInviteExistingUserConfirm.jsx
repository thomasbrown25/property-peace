import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button, Grid, Stack, Typography, Box, Divider, Alert } from '@mui/material';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import PropTypes from 'prop-types';

// ============================|| TENANT - INVITE EXISTING USER CONFIRM ||============================ //

export default function TenantInviteExistingUserConfirm({ inviteToken, inviteData, existingUser }) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    try {
      setIsSubmitting(true);

      // Accept invite directly - no login required since email verification is proof of identity
      try {
        // Make a direct API call without authentication (using axiosServices which allows anonymous calls)
        const acceptResponse = await axiosServices.post('/api/tenantinvite/accept', {
          inviteToken,
          email: inviteData?.email?.trim()
        });

        if (acceptResponse.data?.success) {
          // Get property name from invite data
          const propertyName = inviteData?.propertyName || 'the property';
          
          // Clear any session storage
          sessionStorage.removeItem('tenantInviteToken');
          sessionStorage.removeItem('tenantInviteEmail');
          sessionStorage.removeItem('isExistingUserInvite');
          sessionStorage.removeItem('pendingTenantInvite');
          sessionStorage.removeItem('tenantInvitePropertyName');

          // Show success message
          openSnackbar({
            open: true,
            message: 'Invitation accepted successfully!',
            anchorOrigin: { vertical: 'top', horizontal: 'right' },
            variant: 'alert',
            alert: { color: 'success' }
          });

          // Redirect to success page
          navigate(`/tenant/invite/success?propertyName=${encodeURIComponent(propertyName)}`);
        } else {
          openSnackbar({
            open: true,
            message: acceptResponse.data?.message || 'Failed to accept invitation',
            anchorOrigin: { vertical: 'top', horizontal: 'right' },
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (acceptErr) {
        const acceptMessage = acceptErr?.response?.data?.message || 'Failed to accept invitation. Please try again.';
        openSnackbar({
          open: true,
          message: acceptMessage,
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to process invitation. Please try again.';
      openSnackbar({
        open: true,
        message: message,
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tenant = inviteData?.tenant;
  const firstName = tenant?.firstname || existingUser?.firstName || '';
  const lastName = tenant?.lastname || existingUser?.lastName || '';
  const email = inviteData?.email || tenant?.email || existingUser?.email || '';
  const propertyName = inviteData?.propertyName || tenant?.propertyName || 'the property';
  const propertyAddress = inviteData?.propertyAddress || '';
  const landlordName = inviteData?.landlordName || 'Your Landlord';

  return (
    <Box>
      <Stack spacing={3}>
        <Typography variant="h3">Accept Invitation</Typography>
        
        <Alert severity="info">
          <Typography variant="body2">
            You've been invited to join a property on Property Peace. Review the details below and accept the invitation.
          </Typography>
        </Alert>

        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2}>
            <Typography variant="h6">Invitation Details</Typography>
            <Divider />
            
            <Grid container spacing={2}>
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary">Landlord</Typography>
                <Typography variant="body1" fontWeight={500}>{landlordName}</Typography>
              </Grid>
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary">Property</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {propertyName}
                  {propertyAddress && ` - ${propertyAddress}`}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2" color="text.secondary">First Name</Typography>
                <Typography variant="body1" fontWeight={500}>{firstName}</Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2" color="text.secondary">Last Name</Typography>
                <Typography variant="body1" fontWeight={500}>{lastName}</Typography>
              </Grid>
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary">Email</Typography>
                <Typography variant="body1" fontWeight={500}>{email}</Typography>
              </Grid>
            </Grid>
          </Stack>
        </Box>

        <Typography variant="body2" color="text.secondary">
          By accepting this invitation, you'll be connected to this property and will be able to view lease details, payment history, and communicate with your landlord.
        </Typography>

        <AnimateButton>
          <Button 
            disableElevation 
            disabled={isSubmitting} 
            fullWidth 
            size="large" 
            variant="contained" 
            color="primary"
            onClick={handleAccept}
          >
            {isSubmitting ? 'Processing...' : 'Accept Invitation'}
          </Button>
        </AnimateButton>
      </Stack>
    </Box>
  );
}

TenantInviteExistingUserConfirm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.object.isRequired,
  existingUser: PropTypes.object
};
