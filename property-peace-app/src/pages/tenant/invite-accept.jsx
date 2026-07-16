import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import { tenantInviteAPI } from 'api';
import TenantInviteAcceptForm from 'sections/auth/tenant/TenantInviteAcceptForm';
import TenantInviteExistingUserConfirm from 'sections/auth/tenant/TenantInviteExistingUserConfirm';
import axiosServices from 'utils/axios';

// ================================|| TENANT - INVITE ACCEPT ||================================ //

export default function TenantInviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  const [existingUser, setExistingUser] = useState(null);
  const [checkingExistingUser, setCheckingExistingUser] = useState(false);

  useEffect(() => {
    // Validate invite token
    const validateToken = async () => {
      if (!token) {
        setError('Invalid invite link. No token provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await tenantInviteAPI.validateInviteToken(token);

        if (response.success && response.data?.isValid) {
          setInviteData(response.data);
          
          // Check if email matches an existing user
          if (response.data?.email) {
            await checkExistingUser(response.data.email);
          }
        } else {
          setError(response.data?.message || 'Invalid or expired invite token.');
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to validate invite token. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const checkExistingUser = async (email) => {
    // For now, we'll show the confirmation page if the tenant has a UserId (meaning it's a placeholder)
    // Otherwise, we'll show the regular form
    // The confirmation page will work for both existing and new users
    if (inviteData?.tenant?.userId === null && inviteData?.tenant?.email) {
      // This is a placeholder tenant for an existing user
      setExistingUser({ email: inviteData.email });
    }
  };

  if (loading) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Validating invite...
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  if (error) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Stack spacing={2}>
              <Typography variant="h3">Invalid Invite</Typography>
              <Alert severity="error">{error}</Alert>
              <Typography variant="body2" color="text.secondary">
                If you believe this is an error, please contact your landlord or request a new invite.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  if (!inviteData) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Alert severity="warning">Unable to load invite information.</Alert>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  // Show existing user confirmation if this is a placeholder tenant (UserId is null)
  // This indicates it's an invite for an existing user
  if (inviteData?.tenant?.userId === null && inviteData?.tenant?.email) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <TenantInviteExistingUserConfirm 
              inviteToken={token} 
              inviteData={inviteData}
              existingUser={existingUser}
            />
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  // Show invite details view for new users (tenant without account)
  return (
    <AuthWrapper splitScreen>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack spacing={2}>
            <Typography variant="h3">You've Been Invited!</Typography>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>{inviteData?.landlordName || 'Your landlord'}</strong> has invited you to create an account for{' '}
                <strong>{inviteData?.propertyName || 'a property'}</strong>
                {inviteData?.propertyAddress && ` at ${inviteData.propertyAddress}`}.
              </Typography>
            </Alert>
          </Stack>
        </Grid>
        {inviteData?.tenant && (
          <Grid size={12}>
            <Stack spacing={2} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">Invitation Details</Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Property:</strong> {inviteData.propertyName || 'N/A'}
                </Typography>
                {inviteData.propertyAddress && (
                  <Typography variant="body2">
                    <strong>Address:</strong> {inviteData.propertyAddress}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Landlord:</strong> {inviteData.landlordName || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Your Name:</strong> {inviteData.tenant.firstname} {inviteData.tenant.lastname}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {inviteData.email}
                </Typography>
              </Stack>
            </Stack>
          </Grid>
        )}
        <Grid size={12}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              By accepting this invitation, you'll be able to:
            </Typography>
            <Stack component="ul" spacing={1} sx={{ pl: 2 }}>
              <Typography component="li" variant="body2">View your lease details and payment history</Typography>
              <Typography component="li" variant="body2">Submit and track maintenance requests</Typography>
              <Typography component="li" variant="body2">Communicate with your landlord</Typography>
              <Typography component="li" variant="body2">Access important documents and updates</Typography>
            </Stack>
          </Stack>
        </Grid>
        <Grid size={12}>
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="primary"
            onClick={() => {
              // Store invite data in sessionStorage
              sessionStorage.setItem('tenantInviteToken', token);
              sessionStorage.setItem('tenantInviteData', JSON.stringify(inviteData));
              sessionStorage.setItem('tenantInviteEmail', inviteData?.email || '');
              // Navigate to personal info page
              navigate(`/tenant/invite/${token}/personal-info`);
            }}
          >
            Accept Invitation
          </Button>
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}

