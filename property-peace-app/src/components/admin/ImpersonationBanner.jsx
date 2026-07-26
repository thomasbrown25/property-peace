import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { LogoutOutlined, WarningOutlined } from '@ant-design/icons';
import useAuth from 'hooks/useAuth';

const formatRemaining = (milliseconds) => {
  if (milliseconds <= 0) return 'expired';
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export default function ImpersonationBanner() {
  const { impersonation, returnToAdmin } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!impersonation) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [impersonation]);

  const remaining = useMemo(() => {
    const expires = new Date(impersonation?.sessionExpiresAt).getTime();
    return Number.isFinite(expires) ? expires - now : null;
  }, [impersonation?.sessionExpiresAt, now]);

  useEffect(() => {
    if (remaining !== null && remaining <= 5000 && !returning) {
      setReturning(true);
      returnToAdmin({ expired: true }).catch(() => setReturning(false));
    }
  }, [remaining, returnToAdmin, returning]);

  if (!impersonation) return null;

  const handleReturn = async () => {
    setReturning(true);
    setError('');
    try {
      await returnToAdmin();
    } catch (err) {
      setError(err?.message || 'Unable to return to the administrator session. Please try again.');
      setReturning(false);
    }
  };

  return (
    <Alert
      severity="warning"
      icon={<WarningOutlined />}
      sx={{ mb: 2, position: 'sticky', top: 72, zIndex: 1100, boxShadow: 2 }}
      action={(
        <Button color="warning" variant="contained" size="small" onClick={handleReturn} disabled={returning} startIcon={returning ? <CircularProgress size={16} color="inherit" /> : <LogoutOutlined />}>
          Return to admin
        </Button>
      )}
    >
      <Stack spacing={0.25}>
        <Typography variant="subtitle2">
          You are logged in as {impersonation.targetName}{impersonation.targetEmail ? ` (${impersonation.targetEmail})` : ''}
        </Typography>
        <Box component="span" sx={{ typography: 'caption' }}>
          Reason: {impersonation.reason}
          {impersonation.supportReference ? ` · Reference: ${impersonation.supportReference}` : ''}
          {remaining !== null ? ` · Session expires in ${formatRemaining(remaining)}` : ''}
        </Box>
        {error && <Typography variant="caption" color="error.dark">{error}</Typography>}
      </Stack>
    </Alert>
  );
}
