import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import TenantInvitePasswordForm from 'sections/auth/tenant/TenantInvitePasswordForm';

// ================================|| TENANT - INVITE CREATE PASSWORD ||================================ //

export default function TenantInvitePassword() {
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

    // Get invite data from sessionStorage
    const storedData = sessionStorage.getItem('tenantInviteData');
    const storedToken = sessionStorage.getItem('tenantInviteToken');
    const storedEmail = sessionStorage.getItem('tenantInviteEmail');

    if (!storedData || !storedEmail || storedToken !== token) {
      // Redirect back to accept page if data is missing
      setError('Session expired. Please start over.');
      setLoading(false);
      return;
    }

    try {
      setInviteData(JSON.parse(storedData));
      setLoading(false);
    } catch (err) {
      setError('Invalid session data. Please start over.');
      setLoading(false);
    }
  }, [token, isLoggedIn, navigate]);

  if (loading) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Loading...
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  if (error || !inviteData) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Alert severity="error">{error || 'Unable to load invite information.'}</Alert>
            <Button sx={{ mt: 2 }} onClick={() => navigate(`/tenant/invite/${token}`)}>
              Go Back
            </Button>
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
            <Typography variant="h3">Create Your Password</Typography>
          </Stack>
        </Grid>
        <Grid size={12}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Almost there!</strong>
              <br />
              Please create a secure password for your account.
            </Typography>
          </Alert>
        </Grid>
        <Grid size={12}>
          <TenantInvitePasswordForm inviteToken={token} inviteData={inviteData} />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}

