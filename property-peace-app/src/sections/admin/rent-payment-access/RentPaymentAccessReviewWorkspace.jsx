import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { approveRentPaymentAccessRequest, getRentPaymentAccessRequest, listRentPaymentAccessRequests, rejectRentPaymentAccessRequest, suspendRentPaymentAccessRequest } from 'api/rentPaymentAccess';

const filters = ['Pending', 'Approved', 'Rejected', 'Suspended'];
const apiStatus = (status) => status.toLowerCase();
const date = (value) => (value ? new Date(value).toLocaleString() : '—');
const safeError = (error, fallback) => error?.response?.data?.message || error?.response?.data?.title || fallback;
const permittedDecisions = { Pending: ['approve', 'reject', 'suspend'], Approved: ['suspend'], Rejected: [], Suspended: [] };

export default function RentPaymentAccessReviewWorkspace() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (publicId) setDetail((await getRentPaymentAccessRequest(publicId)).data);
      else setRequests((await listRentPaymentAccessRequests(apiStatus(filter))).data || []);
    } catch (requestError) { setError(safeError(requestError, 'Unable to load rent payment access requests.')); }
    finally { setLoading(false); }
  }, [filter, publicId]);
  useEffect(() => { load(); }, [load]);

  const openDecision = (nextDecision) => { setDecision(nextDecision); setReason(''); setNotes(''); setError(''); };
  const submitDecision = async () => {
    if (!detail || !decision) return;
    setSaving(true); setError('');
    try {
      const payload = { decisionReason: reason.trim(), internalNotes: notes.trim(), rowVersion: detail.rowVersion || detail.RowVersion };
      if (decision === 'approve') await approveRentPaymentAccessRequest(publicId, payload);
      if (decision === 'reject') await rejectRentPaymentAccessRequest(publicId, payload);
      if (decision === 'suspend') await suspendRentPaymentAccessRequest(publicId, payload);
      setDecision(null); await load();
    } catch (requestError) {
      if (requestError?.response?.status === 409) setError('This request changed. Refresh the latest details before deciding.');
      else setError(safeError(requestError, 'Unable to update this access request.'));
    } finally { setSaving(false); }
  };

  const status = detail?.status || detail?.Status;
  const decisions = permittedDecisions[status] || [];
  const organizationName = detail?.organizationName || detail?.OrganizationName || 'this organization';
  const requestedBy = detail?.requestedBy || detail?.RequestedBy || '—';
  const requestedAt = detail?.requestedAtUtc || detail?.RequestedAtUtc;
  const auditEvents = detail?.auditEvents || detail?.AuditEvents || [];
  const connectedPayeeExists = detail?.connectedPayeeExists || detail?.ConnectedPayeeExists === true;
  const needsReason = decision === 'reject' || decision === 'suspend';

  return <Stack spacing={3}>
    <Box><Typography variant="h3">Rent payment access</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>Access approval unlocks payment onboarding, not tenant payments.</Typography></Box>
    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Refresh latest</Button>}>{error}</Alert>}
    {loading ? <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box> : publicId ? <Stack spacing={2}>
      <Button variant="text" sx={{ alignSelf: 'flex-start' }} onClick={() => navigate('/admin/rent-payment-access')}>Back to requests</Button>
      <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h4">{organizationName}</Typography><Chip size="small" label={status || 'Unknown'} /></Stack>
        <Typography variant="body2">Organization ID: {detail?.organizationId || detail?.OrganizationId || '—'}</Typography>
        <Typography variant="body2">Requester: {requestedBy} · Requested {date(requestedAt)}</Typography>
        <Typography variant="body2" color="text.secondary">Reason: {detail?.decisionReason || detail?.DecisionReason || '—'}</Typography>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>Audit timeline</Typography>
        {auditEvents.map((item, index) => <Typography key={item.id || index} variant="body2" color="text.secondary">{date(item.occurredAtUtc || item.OccurredAtUtc)} · {item.nextStatus || item.NextStatus}</Typography>)}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
          {decisions.includes('approve') && <Button variant="contained" onClick={() => openDecision('approve')}>Approve access</Button>}
          {decisions.includes('reject') && <Button color="warning" variant="outlined" onClick={() => openDecision('reject')}>Reject request</Button>}
          {decisions.includes('suspend') && <Button color="error" variant="outlined" startIcon={<StopOutlined />} onClick={() => openDecision('suspend')}>Suspend access</Button>}
        </Stack>
        {connectedPayeeExists && <Button variant="text" onClick={() => navigate('/admin/stripe-payees')}>Open separate Stripe payee review</Button>}
      </Stack></Paper>
    </Stack> : <><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}><TextField select size="small" label="Status" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ minWidth: 180 }}>{filters.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField><Button variant="outlined" startIcon={<ReloadOutlined />} onClick={load}>Refresh</Button></Stack><Stack spacing={1.5}>{requests.length ? requests.map((request) => <Paper key={request.publicId || request.PublicId} variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography variant="h6">{request.organizationName || request.OrganizationName}</Typography><Typography variant="body2" color="text.secondary">{request.requestedBy || request.RequestedBy || '—'} · {date(request.requestedAtUtc || request.RequestedAtUtc)}</Typography></Box><Button onClick={() => navigate(`/admin/rent-payment-access/${request.publicId || request.PublicId}`)}>Review</Button></Stack></Paper>) : <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No requests match this filter.</Typography></Paper>}</Stack></>}
    <Dialog open={Boolean(decision)} onClose={() => !saving && setDecision(null)} fullWidth maxWidth="sm"><DialogTitle>{decision === 'approve' ? `Approve access for ${organizationName}?` : decision === 'reject' ? 'Reject access request' : 'Suspend access'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{decision === 'approve' && <Alert severity="info">This unlocks payment onboarding, not tenant payments.</Alert>}{needsReason && <TextField required label={decision === 'reject' ? 'User-safe rejection reason' : 'User-safe suspension reason'} value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={3} inputProps={{ maxLength: 1000 }} />}<TextField label="Admin-only internal notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={3} inputProps={{ maxLength: 2000 }} helperText="Admin-only internal notes are never shown to the requester." /></Stack></DialogContent><DialogActions><Button onClick={() => setDecision(null)} disabled={saving}>Cancel</Button><Button variant="contained" color={decision === 'suspend' ? 'error' : 'primary'} onClick={submitDecision} disabled={saving || (needsReason && !reason.trim())}>{saving ? 'Saving…' : 'Confirm decision'}</Button></DialogActions></Dialog>
  </Stack>;
}