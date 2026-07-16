import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Box, Typography, CircularProgress, Alert, Button, Stack } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { tenantInviteAPI } from 'api';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';

// ================================|| TENANT - INVITE ACCEPT (PORTAL) ||================================ //
// This page is shown when the tenant clicks the in-app notification for a portal invite.
// Renders inline with portal styling (dashboard layout) - no redirect to auth flow.

export default function TenantInviteAcceptPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invite, setInvite] = useState(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const loadPendingInvite = async () => {
      try {
        const response = await tenantInviteAPI.getPendingInvite();
        const data = response?.data?.data ?? response?.data;

        if (data?.inviteToken) {
          setInvite(data);
        }

        setError(null);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    };

    loadPendingInvite();
  }, []);

  const handleAccept = async () => {
    if (!invite?.inviteToken) return;

    setAccepting(true);
    try {
      const email = user?.email || user?.Email || invite?.email;
      const acceptResponse = await tenantInviteAPI.acceptTenantInvite({
        inviteToken: invite.inviteToken,
        email: email?.trim() || ''
      });

      if (acceptResponse?.success) {
        const propertyName = invite?.tenant?.propertyName || invite?.propertyName || acceptResponse?.data?.propertyName || 'the property';
        openSnackbar({
          open: true,
          message: `Successfully connected to ${propertyName}!`,
          variant: 'alert',
          alert: { color: 'success' }
        });
        navigate('/tenant/dashboard', { replace: true });
      } else {
        setError(acceptResponse?.message || 'Failed to accept invitation.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading invitation...
        </Typography>
      </Box>
    );
  }

  if (error && !invite) {
    return (
      <Box>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/tenant/dashboard' }, { label: 'Invitation' }]} />
        <MainCard sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h5">Invitation</Typography>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" onClick={() => navigate('/tenant/dashboard')}>
              Back to Dashboard
            </Button>
          </Stack>
        </MainCard>
      </Box>
    );
  }

  // Has pending invite - show accept UI (portal style)
  if (invite) {
    return (
      <Box>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/tenant/dashboard' }, { label: 'Invitation' }]} />
        <MainCard sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <Typography variant="h4" fontWeight={600}>
              You&apos;ve Been Invited!
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                You&apos;ve been invited to join <strong>{invite.tenant?.propertyName || invite.propertyName || 'a property'}</strong>.
              </Typography>
            </Alert>
            <Stack spacing={1} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Property:</strong> {invite.tenant?.propertyName || invite.propertyName || 'N/A'}
              </Typography>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/tenant/dashboard')} disabled={accepting}>
                Decline
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Box>
    );
  }

  // No pending invite
  return (
    <Box>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/tenant/dashboard' }, { label: 'Invitation' }]} />
      <MainCard sx={{ mt: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h5">No pending invitations</Typography>
          <Typography variant="body2" color="text.secondary">
            You don&apos;t have any pending property invitations. If you received an invite by email, use the link in that email.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/tenant/dashboard')}>
            Back to Dashboard
          </Button>
        </Stack>
      </MainCard>
    </Box>
  );
}
