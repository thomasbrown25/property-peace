import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';

// material-ui
import { Grid } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';
import { Box } from '@mui/material';
import { Alert } from '@mui/material';
import { CircularProgress } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import OrganizationInviteAcceptForm from 'sections/auth/organization/OrganizationInviteAcceptForm';
import { organizationInviteAPI } from 'api';

// ================================|| ORGANIZATION - INVITE ACCEPT ||================================ //

export default function OrganizationInviteAccept() {
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
        const response = await organizationInviteAPI.getInviteByToken(token);

        if (response.success && response.data) {
          setInviteData(response.data);
        } else {
          setError(response.message || 'Invalid or expired invite token.');
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
                If you believe this is an error, please contact the organization owner or request a new invite.
              </Typography>
              <Link component={RouterLink} to="/login" variant="body2" color="primary">
                Go to Login
              </Link>
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

  // If user already has an account, show simple accept/reject UI
  if (inviteData.hasAccount) {
    return (
      <AuthWrapper>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Typography variant="h3" sx={{ mb: 2 }}>Join Organization</Typography>
          </Grid>
          <Grid size={12}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>You've been invited to join {inviteData.organizationName}!</strong>
                <br />
                {inviteData.role && `You'll be added as a ${inviteData.role}.`}
              </Typography>
            </Alert>
          </Grid>
          <Grid size={12}>
            <OrganizationInviteAcceptForm inviteToken={token} inviteData={inviteData} />
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  // If user doesn't have an account, show registration form
  return (
    <AuthWrapper>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Typography variant="h3" sx={{ mb: 2 }}>Join Organization</Typography>
        </Grid>
        <Grid size={12}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>You've been invited to join {inviteData.organizationName}!</strong>
              <br />
              {inviteData.role && `You'll be added as a ${inviteData.role}.`}
              {' Please create an account to accept this invite.'}
            </Typography>
          </Alert>
        </Grid>
        <Grid size={12}>
          <OrganizationInviteAcceptForm inviteToken={token} inviteData={inviteData} />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}

