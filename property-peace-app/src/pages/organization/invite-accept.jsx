import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';

// material-ui
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';
import { Box } from '@mui/material';
import { Alert } from '@mui/material';
import { CircularProgress } from '@mui/material';

// project imports
import AuthWrapper from 'sections/auth/AuthWrapper';
import OrganizationInviteAcceptForm from 'sections/auth/organization/OrganizationInviteAcceptForm';
import { organizationInviteAPI } from 'api';

// ================================|| ORGANIZATION - INVITE ACCEPT ||================================ //

export default function OrganizationInviteAccept() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
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
      <AuthWrapper focused>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
          <CircularProgress size={30} />
          <Typography variant="body2" color="text.secondary">
            Checking your invitation…
          </Typography>
        </Box>
      </AuthWrapper>
    );
  }

  if (error) {
    return (
      <AuthWrapper focused>
        <Stack spacing={2.5}>
          <Typography sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Team invitation
          </Typography>
          <Typography component="h1" sx={{ color: '#061e35', fontSize: { xs: 30, sm: 36 }, lineHeight: 1.15, fontWeight: 700 }}>
            This invitation is no longer available
          </Typography>
          <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
          <Typography variant="body2" color="text.secondary">
            Ask the organization owner to send a new invitation if you still need access.
          </Typography>
          <Link component={RouterLink} to="/login" variant="body2" sx={{ width: 'fit-content', fontWeight: 600 }}>
            Go to login
          </Link>
        </Stack>
      </AuthWrapper>
    );
  }

  if (!inviteData) {
    return (
      <AuthWrapper focused>
        <Stack spacing={2.5}>
          <Typography component="h1" sx={{ color: '#061e35', fontSize: { xs: 30, sm: 36 }, lineHeight: 1.15, fontWeight: 700 }}>
            Invitation unavailable
          </Typography>
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            We couldn't load the invitation details. Refresh the page or ask for a new invitation.
          </Alert>
        </Stack>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper focused>
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ mb: 1.25, color: 'text.secondary', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Team invitation
        </Typography>
        <Typography
          component="h1"
          sx={{ mb: 1.5, color: '#061e35', fontSize: { xs: 32, sm: 40 }, lineHeight: 1.12, letterSpacing: '-0.025em', fontWeight: 700 }}
        >
          Join {inviteData.organizationName}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 16, lineHeight: 1.7 }}>
          {inviteData.invitedByName
            ? `${inviteData.invitedByName} invited you to collaborate in Property Peace.`
            : 'You’ve been invited to collaborate in Property Peace.'}
        </Typography>
      </Box>

      <Box
        sx={{
          mb: 4,
          px: 2.5,
          py: 2,
          bgcolor: '#f7faf8',
          border: '1px solid',
          borderColor: '#e1e9e4',
          borderLeft: '4px solid #41a541',
          borderRadius: 2
        }}
      >
        <Typography sx={{ mb: 0.5, color: '#061e35', fontSize: 15, fontWeight: 700 }}>{inviteData.organizationName}</Typography>
        <Typography variant="body2" color="text.secondary">
          You’ll join as {inviteData.role ? `a ${inviteData.role}` : 'a team member'}.
        </Typography>
      </Box>

      <OrganizationInviteAcceptForm inviteToken={token} inviteData={inviteData} />
    </AuthWrapper>
  );
}
