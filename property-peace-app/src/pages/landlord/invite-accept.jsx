import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, CircularProgress, Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import landlordInviteAPI from 'api/landlordInvite';
import EmailEntryForm from 'sections/auth/jwt/EmailEntryForm';

// ================================|| LANDLORD - INVITE ACCEPT ||================================ //

export default function LandlordInviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);

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
        const response = await landlordInviteAPI.validateInviteToken(token);

        if (response.success && response.data?.isValid) {
          setInviteData(response.data);
          
          // Check if user is already logged in
          if (isLoggedIn) {
            // User is logged in, mark invite as used and redirect to dashboard
            try {
              await landlordInviteAPI.markInviteAsUsed(token);
              sessionStorage.removeItem('landlordInviteToken');
              sessionStorage.removeItem('landlordInviteEmail');
              sessionStorage.removeItem('landlordInviteFirstName');
              sessionStorage.removeItem('landlordInviteLastName');
              navigate('/landlord/dashboard');
            } catch (err) {
              console.error('Error marking invite as used:', err);
              // Continue anyway
              navigate('/landlord/dashboard');
            }
          } else {
            // User is not logged in, store invite token and show registration form
            sessionStorage.setItem('landlordInviteToken', token);
            sessionStorage.setItem('landlordInviteEmail', response.data.email || '');
            if (response.data.firstName) {
              sessionStorage.setItem('landlordInviteFirstName', response.data.firstName);
            }
            if (response.data.lastName) {
              sessionStorage.setItem('landlordInviteLastName', response.data.lastName);
            }
            setShowRegistration(true);
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
  }, [token, isLoggedIn, navigate]);

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
                If you believe this is an error, please contact support or request a new invite.
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

  // Show registration form
  if (showRegistration) {
    return (
      <AuthWrapper>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Stack spacing={2} sx={{ mb: 3 }}>
              <Typography variant="h3" sx={{ textAlign: 'center' }}>
                You've Been Invited!
              </Typography>
              <Alert severity="info" sx={{ textAlign: 'center' }}>
                <Typography variant="body2">
                  You've been invited to create a landlord account on <strong>Property Peace</strong>.
                  {inviteData.firstName && inviteData.lastName && (
                    <> Welcome, <strong>{inviteData.firstName} {inviteData.lastName}</strong>!</>
                  )}
                </Typography>
              </Alert>
            </Stack>
          </Grid>
          <Grid size={12}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400
              }}
            >
              <EmailEntryForm 
                userType="landlord"
                isDemo={false}
              />
            </Box>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  return null;
}
