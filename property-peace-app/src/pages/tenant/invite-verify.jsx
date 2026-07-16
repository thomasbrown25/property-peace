import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import TenantInviteVerifyForm from 'sections/auth/tenant/TenantInviteVerifyForm';

// ================================|| TENANT - INVITE VERIFY CODE ||================================ //

export default function TenantInviteVerify() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(null);

  useEffect(() => {
    // Get email from sessionStorage
    const storedEmail = sessionStorage.getItem('tenantInviteEmail');
    const storedToken = sessionStorage.getItem('tenantInviteToken');
    const isExistingUserInvite = sessionStorage.getItem('isExistingUserInvite') === 'true';

    // Only redirect logged-in users if this is NOT an existing user invite
    // (existing users need to be logged in to accept)
    if (isLoggedIn && !isExistingUserInvite) {
      navigate('/tenant/dashboard');
      return;
    }

    if (!storedEmail || storedToken !== token) {
      // Redirect back to accept page if data is missing
      navigate(`/tenant/invite/${token}`);
      return;
    }

    setEmail(storedEmail);
    setLoading(false);
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

  if (!email) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Alert severity="error">Session expired. Please start over.</Alert>
            <Button sx={{ mt: 2 }} onClick={() => navigate(`/tenant/invite/${token}`)}>
              Go Back
            </Button>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  // Mask email for display
  const maskEmail = (email) => {
    if (!email) return '****@****.com';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}@${domain}`;
  };

  return (
    <AuthWrapper splitScreen>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack sx={{ gap: 1 }}>
            <Typography variant="h3">Enter Verification Code</Typography>
            <Typography color="secondary">We sent you a code on {maskEmail(email)}</Typography>
          </Stack>
        </Grid>
        <Grid size={12}>
          <TenantInviteVerifyForm inviteToken={token} email={email} />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}

