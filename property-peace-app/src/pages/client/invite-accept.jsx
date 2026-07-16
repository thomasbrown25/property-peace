import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import { clientAPI } from 'api/client';

// ================================|| CLIENT - INVITE ACCEPT ||================================ //

export default function ClientInviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

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
        const response = await clientAPI.validateInviteToken(token);

        if (response.success && response.data?.isValid) {
          setInviteData(response.data);
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

  if (loading) {
    return (
      <AuthWrapper>
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
      <AuthWrapper>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Stack spacing={2}>
              <Typography variant="h3">Invalid Invite</Typography>
              <Alert severity="error">{error}</Alert>
              <Typography variant="body2" color="text.secondary">
                If you believe this is an error, please contact your property manager or request a new invite.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  if (!inviteData) {
    return (
      <AuthWrapper>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Alert severity="warning">Unable to load invite information.</Alert>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  // Show invite details view
  return (
    <AuthWrapper>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack spacing={2}>
            <Typography variant="h3">You've Been Invited!</Typography>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>{inviteData?.landlordName || 'Your property manager'}</strong> has invited you to create a client portal account
                {inviteData?.organizationName && ` for ${inviteData.organizationName}`}.
              </Typography>
            </Alert>
          </Stack>
        </Grid>
        {inviteData?.client && (
          <Grid size={12}>
            <Stack spacing={2} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">Invitation Details</Typography>
              <Stack spacing={1}>
                {inviteData.organizationName && (
                  <Typography variant="body2">
                    <strong>Organization:</strong> {inviteData.organizationName}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Your Name:</strong> {inviteData.client.firstName} {inviteData.client.lastName}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {inviteData.email}
                </Typography>
                {inviteData.landlordName && (
                  <Typography variant="body2">
                    <strong>Property Manager:</strong> {inviteData.landlordName}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Grid>
        )}
        <Grid size={12}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              By creating your account, you'll be able to:
            </Typography>
            <Stack component="ul" spacing={1} sx={{ pl: 2 }}>
              <Typography component="li" variant="body2">View your property portfolio and statements</Typography>
              <Typography component="li" variant="body2">Access financial reports and documents</Typography>
              <Typography component="li" variant="body2">Communicate with your property manager</Typography>
              <Typography component="li" variant="body2">Track property management activities</Typography>
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
              sessionStorage.setItem('clientInviteToken', token);
              sessionStorage.setItem('clientInviteData', JSON.stringify(inviteData));
              sessionStorage.setItem('clientInviteEmail', inviteData?.email || '');
              // Navigate to registration page (similar to tenant flow)
              navigate(`/register?inviteToken=${token}&email=${encodeURIComponent(inviteData?.email || '')}&userType=client`);
            }}
          >
            Create Account
          </Button>
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}
