import { useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { CalendarOutlined } from '@ant-design/icons';
import { cancelShowing, completeShowing } from 'api/leads';
import { formatZonedDateTime, getLeadErrorMessage, titleCaseStatus } from 'utils/leads';

export default function ShowingsPanel({ showings = [], loading, error, timeZone, onChanged, compact = false }) {
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const act = async (showing, action) => {
    if (action === 'cancel' && !globalThis.confirm('Cancel this showing? This action will notify the prospect.')) return;
    setBusyId(showing.id);
    setActionError('');
    try {
      if (action === 'cancel') await cancelShowing(showing.id, showing.concurrencyToken);
      else await completeShowing(showing.id, action === 'noShow', showing.concurrencyToken);
      await onChanged?.();
    } catch (requestError) {
      setActionError(getLeadErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  };
  if (loading) return <Stack direction="row" spacing={1} alignItems="center" role="status"><CircularProgress size={18} /><Typography variant="body2">Loading showings…</Typography></Stack>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!showings.length) return <><Alert severity="info">No showings are scheduled for this view.</Alert>{actionError && <Alert severity="error" sx={{ mt: 1 }}>{actionError}</Alert>}</>;
  return <Stack spacing={1.25}>
    {actionError && <Alert severity="error" onClose={() => setActionError('')}>{actionError}</Alert>}
    {showings.map((showing) => (
    <Box key={showing.id} sx={{ p: compact ? 1.25 : 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box><Stack direction="row" spacing={1} alignItems="center"><CalendarOutlined /><Typography fontWeight={700}>{formatZonedDateTime(showing.startsAtUtc, timeZone)}</Typography></Stack><Typography variant="caption" color="text.secondary">Lead #{showing.leadId} · Listing #{showing.listingId} · Ends {formatZonedDateTime(showing.endsAtUtc, timeZone)}</Typography></Box>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap"><Chip size="small" label={titleCaseStatus(showing.status)} />{showing.status === 'confirmed' && <><Button size="small" disabled={busyId === showing.id} onClick={() => act(showing, 'complete')}>Complete</Button><Button size="small" disabled={busyId === showing.id} onClick={() => act(showing, 'noShow')}>No-show</Button><Button size="small" color="error" disabled={busyId === showing.id} onClick={() => act(showing, 'cancel')}>Cancel</Button></>}</Stack>
      </Stack>
    </Box>
  ))}</Stack>;
}
