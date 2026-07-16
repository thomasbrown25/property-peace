import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import { tenantInviteAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

// ================================|| TENANT - INVITE ACCEPT AFTER LOGIN ||================================ //

export default function TenantInviteAcceptAfterLogin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const email = searchParams.get('email') || sessionStorage.getItem('tenantInviteEmail');

  useEffect(() => {
    if (!isLoggedIn) {
      // Redirect to login if not logged in
      navigate(`/login?returnUrl=/tenant/invite/${token}/accept&email=${encodeURIComponent(email || '')}`);
      return;
    }

    // Auto-accept the invite
    const acceptInvite = async () => {
      try {
        setAccepting(true);
        const acceptResponse = await tenantInviteAPI.acceptTenantInvite({
          inviteToken: token,
          email: email?.trim() || ''
        });

        if (acceptResponse.success) {
          // Get property name from sessionStorage or response data
          const propertyName = sessionStorage.getItem('tenantInvitePropertyName') || acceptResponse.data?.propertyName || 'the property';
          
          // Clear session storage
          sessionStorage.removeItem('tenantInviteToken');
          sessionStorage.removeItem('tenantInviteEmail');
          sessionStorage.removeItem('isExistingUserInvite');
          sessionStorage.removeItem('pendingTenantInviteAccept');
          sessionStorage.removeItem('tenantInvitePropertyName');

          // Redirect to success page
          navigate(`/tenant/invite/success?propertyName=${encodeURIComponent(propertyName)}`);
        } else {
          setError(acceptResponse.message || 'Failed to accept invitation');
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to accept invitation. Please try again.');
      } finally {
        setAccepting(false);
        setLoading(false);
      }
    };

    if (token && email) {
      acceptInvite();
    } else {
      setError('Missing invite token or email');
      setLoading(false);
    }
  }, [token, email, isLoggedIn, navigate]);

  if (loading || accepting) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                {accepting ? 'Accepting invitation...' : 'Loading...'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  if (success) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Stack spacing={2}>
              <Alert severity="success">
                <Typography variant="body1" fontWeight={500}>
                  Invitation Accepted!
                </Typography>
                <Typography variant="body2">
                  You've been successfully connected to the property. Redirecting to your dashboard...
                </Typography>
              </Alert>
            </Stack>
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
              <Typography variant="h3">Error</Typography>
              <Alert severity="error">{error}</Alert>
              <Button sx={{ mt: 2 }} onClick={() => navigate('/tenant/dashboard')}>
                Go to Dashboard
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  return null;
}
