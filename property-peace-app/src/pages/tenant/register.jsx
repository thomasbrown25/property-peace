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
import TenantRegisterForm from 'sections/auth/tenant/TenantRegisterForm';
import { validateInviteToken } from 'api/tenantInvite';

// ================================|| TENANT - REGISTER ||================================ //

export default function TenantRegister() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Redirect if already logged in
    if (isLoggedIn) {
      navigate('/tenant/dashboard');
      return;
    }

    // Validate invite token
    const validateToken = async () => {
      if (!token) {
        setError('Invalid invite link. No token provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await validateInviteToken(token);

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
  }, [token, isLoggedIn, navigate]);

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
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Alert severity="warning">Unable to load invite information.</Alert>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper splitScreen>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: { xs: -0.5, sm: 0.5 } }}>
            <Typography variant="h3">Create Your Account</Typography>
            <Typography
              component={RouterLink}
              to="/login"
              variant="body1"
              sx={{ textDecoration: 'none' }}
              color="primary"
            >
              Already have an account?
            </Typography>
          </Stack>
        </Grid>
        {inviteData.tenant && (
          <Grid size={12}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Welcome, {inviteData.tenant.firstname} {inviteData.tenant.lastname}!</strong>
                <br />
                You've been invited to create a tenant account. Please set up your password below.
              </Typography>
            </Alert>
          </Grid>
        )}
        <Grid size={12}>
          <TenantRegisterForm inviteToken={token} inviteData={inviteData} />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}

