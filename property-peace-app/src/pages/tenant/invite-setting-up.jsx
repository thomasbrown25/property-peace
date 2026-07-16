import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

// ================================|| TENANT - INVITE SETTING UP ACCOUNT ||================================ //

export default function TenantInviteSettingUp() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Creating your account...');

  useEffect(() => {
    // Redirect if already logged in
    if (isLoggedIn) {
      navigate('/tenant/dashboard');
      return;
    }

    // Get data from sessionStorage
    const storedData = sessionStorage.getItem('tenantInviteData');
    const storedToken = sessionStorage.getItem('tenantInviteToken');
    const storedEmail = sessionStorage.getItem('tenantInviteEmail');
    const storedPassword = sessionStorage.getItem('tenantInvitePassword');

    if (!storedData || !storedEmail || !storedPassword || storedToken !== token) {
      setError('Session expired. Please start over.');
      return;
    }

    // Create the account
    const createAccount = async () => {
      try {
        const inviteData = JSON.parse(storedData);
        const tenantData = inviteData?.tenant || {};

        setStatus('Creating your account...');

        // Register with invite token
        const response = await axiosServices.post('/api/user/register', {
          email: storedEmail.trim(),
          password: storedPassword,
          firstName: tenantData.firstname || tenantData.firstName || '',
          lastName: tenantData.lastname || tenantData.lastName || '',
          phoneNumber: tenantData.phoneNumber || tenantData.phone || null,
          inviteToken: token,
          roles: ['Tenant']
        });

        if (response.data?.success) {
          // Get user data and token from response
          const userData = response.data.data;
          const jwtToken = userData?.JWTToken;

          if (jwtToken) {
            // Set session token
            localStorage.setItem('serviceToken', jwtToken);
            axiosServices.defaults.headers.common.Authorization = `Bearer ${jwtToken}`;
          }

          // Clear session storage
          sessionStorage.removeItem('tenantInviteToken');
          sessionStorage.removeItem('tenantInviteData');
          sessionStorage.removeItem('tenantInviteEmail');
          sessionStorage.removeItem('tenantInvitePassword');

          setStatus('Account created successfully! Redirecting...');

          // Reload the page to let JWTContext pick up the token and initialize auth state
          setTimeout(() => {
            window.location.href = '/tenant/dashboard';
          }, 1500);
        } else {
          setError(response.data?.message || 'Failed to create account. Please try again.');
        }
      } catch (err) {
        const message = err?.response?.data?.message || 'Failed to create account. Please try again.';
        setError(message);
        openSnackbar({
          open: true,
          message: message,
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    };

    createAccount();
  }, [token, isLoggedIn, navigate]);

  if (error) {
    return (
      <AuthWrapper splitScreen>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Stack spacing={2}>
              <Typography variant="h3">Error</Typography>
              <Alert severity="error">{error}</Alert>
              <Typography variant="body2" color="text.secondary">
                Please try again or contact support if the problem persists.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper splitScreen>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
            <CircularProgress size={60} />
            <Stack spacing={1} sx={{ textAlign: 'center' }}>
              <Typography variant="h4">Setting Up Your Account</Typography>
              <Typography variant="body1" color="text.secondary">
                {status}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Please wait while we create your account and link it to your property...
              </Typography>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}
