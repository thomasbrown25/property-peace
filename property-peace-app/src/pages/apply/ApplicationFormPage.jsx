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
import ApplicationForm from 'sections/applications/ApplicationForm';
import { validateApplicationInviteToken } from 'api/applicationInvite';

// ================================|| APPLICATION - APPLY PAGE ||================================ //

export default function ApplicationFormPage() {
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
        setError('Invalid application link. No token provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await validateApplicationInviteToken(token);

        if (response.success && response.data?.isValid) {
          setInviteData(response.data);
        } else {
          setError(response.data?.message || 'Invalid or expired application invite.');
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to validate application invite. Please try again.');
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
                Loading application form...
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
              <Typography variant="h3">Invalid Application Invite</Typography>
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
      <AuthWrapper>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Alert severity="warning">Unable to load application invite information.</Alert>
          </Grid>
        </Grid>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: { xs: -0.5, sm: 0.5 } }}>
            <Typography variant="h3">Rental Application</Typography>
          </Stack>
        </Grid>
        {inviteData.property && (
          <Grid size={12}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Property:</strong> {inviteData.property.name}
                {inviteData.unitId && inviteData.property?.units && (
                  <>
                    <br />
                    <strong>Unit:</strong>{' '}
                    {inviteData.property.units.find((u) => u.id === inviteData.unitId)?.name || 'N/A'}
                  </>
                )}
                {inviteData.email && (
                  <>
                    <br />
                    <strong>Email:</strong> {inviteData.email}
                  </>
                )}
              </Typography>
            </Alert>
          </Grid>
        )}
        <Grid size={12}>
          <ApplicationForm inviteToken={token} inviteData={inviteData} />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}

