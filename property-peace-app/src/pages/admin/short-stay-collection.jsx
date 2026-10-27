import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { adminShortStayCollectionAPI } from 'api/adminShortStayCollection';
import { availableActions, reasonCodes, validCaseReference } from './short-stay-collection-review';

const labels = {
  submitted: 'Submitted', identityPending: 'Identity pending', identityVerified: 'Identity verified',
  underReview: 'Under review', payoutApproved: 'Payout approved', suspended: 'Suspended', rejected: 'Rejected'
};
const actionLabels = { 'begin-review': 'Begin review', approve: 'Approve', suspend: 'Suspend', reject: 'Reject' };
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export default function AdminShortStayCollection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [authority, setAuthority] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminShortStayCollectionAPI.list();
      setItems(Array.isArray(result) ? result : []);
    } catch {
      setError('Unable to load collection review queue.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (item, nextAction) => {
    setSelected(item);
    setAction(nextAction);
    setCaseReference('');
    setReasonCode('');
    setAuthority(false);
    setConfirmed(false);
    setError('');
  };
  const close = () => {
    if (!saving) { setSelected(null); setAction(''); }
  };
  const canSubmit = confirmed && (action !== 'approve' || (authority && validCaseReference(caseReference))) &&
    (!['suspend', 'reject'].includes(action) || reasonCodes.includes(reasonCode));
  const submit = async () => {
    if (!selected || !canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      if (action === 'begin-review') await adminShortStayCollectionAPI.beginReview(selected.id);
      if (action === 'approve') await adminShortStayCollectionAPI.approve(selected.id, caseReference, authority);
      if (action === 'suspend') await adminShortStayCollectionAPI.suspend(selected.id, reasonCode);
      if (action === 'reject') await adminShortStayCollectionAPI.reject(selected.id, reasonCode);
      setSelected(null);
      setAction('');
      await load();
    } catch {
      setError('Unable to update application. It may have changed or no longer meet server requirements. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3">Short-stay collection review</Typography>
        <Typography color="text.secondary">Internal application queue. Approval is subject to independent server checks of identity, Connect eligibility, property scope and policy; this screen does not enable booking or payments.</Typography>
      </Box>
      <Alert severity="warning">Use only non-sensitive case IDs. Do not enter identity documents, bank details, personal data or free-form reviewer notes here.</Alert>
      <Box><Button variant="outlined" onClick={load} disabled={loading || saving}>Refresh queue</Button></Box>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : items.length === 0 ?
        <Paper variant="outlined" sx={{ p: 3 }}><Typography>No submitted applications in the queue.</Typography></Paper> :
        <Stack spacing={2}>
          {items.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 2.5 }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h5">Application #{item.id}</Typography>
                  <Chip size="small" label={labels[item.status] || 'Unknown status'} />
                </Stack>
                <Typography variant="body2">Applicant user #{item.applicantUserId} · Organization #{item.organizationId}</Typography>
                <Typography variant="body2">Selected property IDs: {Array.isArray(item.propertyIds) && item.propertyIds.length ? item.propertyIds.join(', ') : '—'}</Typography>
                <Typography variant="body2" color="text.secondary">Submitted: {formatDate(item.submittedAt)} · Approved: {formatDate(item.approvedAt)}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {availableActions(item.status).map((nextAction) => (
                    <Button key={nextAction} variant={nextAction === 'approve' ? 'contained' : 'outlined'} color={['suspend', 'reject'].includes(nextAction) ? 'error' : 'primary'} onClick={() => open(item, nextAction)}>
                      {actionLabels[nextAction]}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>}
      <Dialog open={Boolean(selected)} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{actionLabels[action]} · Application #{selected?.id}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">Selected properties: {selected?.propertyIds?.join(', ') || '—'}. Confirm this action for this application.</Typography>
            {action === 'approve' && <>
              <TextField label="Internal case reference" value={caseReference} onChange={(event) => setCaseReference(event.target.value)} inputProps={{ maxLength: 64 }} helperText="4–64 letters or numbers only. No names, emails or identity information." required error={Boolean(caseReference) && !validCaseReference(caseReference)} />
              <FormControlLabel control={<Checkbox checked={authority} onChange={(event) => setAuthority(event.target.checked)} />} label="I independently verified the applicant's authority to collect for each selected property." />
              <Alert severity="info">The server separately verifies identity and Connect eligibility. This confirmation is not a legal certification.</Alert>
            </>}
            {['suspend', 'reject'].includes(action) && <TextField select label="Reason code" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} required>
              {reasonCodes.map((code) => <MenuItem key={code} value={code}>{code.replaceAll('_', ' ')}</MenuItem>)}
            </TextField>}
            {action === 'begin-review' && <Alert severity="info">This starts internal review only; it does not approve collection.</Alert>}
            <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label={`I confirm ${actionLabels[action]?.toLowerCase() || 'this decision'} for this application.`} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={saving}>Cancel</Button>
          <Button onClick={submit} variant="contained" color={['suspend', 'reject'].includes(action) ? 'error' : 'primary'} disabled={!canSubmit || saving}>{saving ? 'Saving…' : `Confirm ${actionLabels[action]?.toLowerCase() || 'action'}`}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
