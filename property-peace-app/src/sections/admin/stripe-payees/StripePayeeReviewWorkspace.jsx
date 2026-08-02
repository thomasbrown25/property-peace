import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { CheckCircleOutlined, ReloadOutlined, SafetyCertificateOutlined, StopOutlined } from '@ant-design/icons';

import axiosServices from 'utils/axios';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'stripeVerified', label: 'Stripe verified' },
  { value: 'underReview', label: 'Under review' },
  { value: 'payoutApproved', label: 'Payout approved' },
  { value: 'suspended', label: 'Suspended' }
];

const statusColor = {
  onboarding: 'default',
  stripeVerified: 'info',
  underReview: 'warning',
  payoutApproved: 'success',
  suspended: 'error'
};

const statusLabel = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

export default function StripePayeeReviewWorkspace() {
  const [status, setStatus] = useState('all');
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [evidence, setEvidence] = useState('');
  const [notes, setNotes] = useState('');
  const [authority, setAuthority] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPayees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosServices.get('/api/admin/stripe/payees', {
        params: status === 'all' ? {} : { status }
      });
      setPayees(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to load connected payees.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadPayees();
  }, [loadPayees]);

  const summary = useMemo(
    () => ({
      review: payees.filter((item) => ['stripeVerified', 'underReview'].includes(item.status)).length,
      approved: payees.filter((item) => item.status === 'payoutApproved').length,
      suspended: payees.filter((item) => item.status === 'suspended').length
    }),
    [payees]
  );

  const openAction = (payee, nextAction) => {
    setSelected(payee);
    setAction(nextAction);
    setEvidence('');
    setNotes('');
    setAuthority(false);
    setOrganizationId(payee.approvedOrganizationId ? String(payee.approvedOrganizationId) : '');
    setReason('');
    setError('');
  };

  const closeAction = () => {
    if (!saving) {
      setSelected(null);
      setAction(null);
    }
  };

  const submitAction = async () => {
    if (!selected || !action) return;
    setSaving(true);
    setError('');
    try {
      const id = encodeURIComponent(selected.stripeAccountId);
      if (action === 'review') {
        await axiosServices.post(`/api/admin/stripe/payees/${id}/review`);
      } else if (action === 'approve') {
        await axiosServices.post(`/api/admin/stripe/payees/${id}/approve`, {
          evidence: evidence.trim(),
          notes: notes.trim(),
          organizationId: Number(organizationId),
          propertyAuthorityAttested: authority
        });
      } else {
        await axiosServices.post(`/api/admin/stripe/payees/${id}/suspend`, { reason: reason.trim() });
      }
      setSelected(null);
      setAction(null);
      await loadPayees();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.title || 'Unable to update this payee.');
    } finally {
      setSaving(false);
    }
  };

  const approveInvalid =
    !evidence.trim() ||
    !notes.trim() ||
    !authority ||
    !Number.isSafeInteger(Number(organizationId)) ||
    Number(organizationId) <= 0;
  const submitDisabled = saving || (action === 'approve' && approveInvalid) || (action === 'suspend' && !reason.trim());

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3">Stripe payee review</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Stripe verification is not payout approval. Confirm property or management authority before any rent transfer is released.
        </Typography>
      </Box>

      <Alert severity="warning" icon={<SafetyCertificateOutlined />}>
        Do not paste SSNs, tax IDs, dates of birth, identity documents, full bank or card details, or other raw KYC information here. Raw identity data belongs only in Stripe Dashboard.
      </Alert>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography color="text.secondary">Needs review</Typography><Typography variant="h3">{summary.review}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography color="text.secondary">Payout approved</Typography><Typography variant="h3">{summary.approved}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography color="text.secondary">Suspended</Typography><Typography variant="h3">{summary.suspended}</Typography></Paper>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <TextField select size="small" label="Review status" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 220 }}>
          {STATUS_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <Button variant="outlined" startIcon={<ReloadOutlined />} onClick={loadPayees} disabled={loading}>Refresh</Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : payees.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No payees match this status.</Typography></Paper>
      ) : (
        <Stack spacing={2}>
          {payees.map((payee) => (
            <Paper key={payee.stripeAccountId} variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h5" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{payee.stripeAccountId}</Typography>
                    <Chip size="small" label={statusLabel[payee.status] || payee.status} color={statusColor[payee.status] || 'default'} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    User {payee.userId || 'unlinked'} · Added {formatDate(payee.createdAt)} · Stripe snapshot {formatDate(payee.lastStripeSnapshotAt)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.75 }}>
                    Stripe: details {payee.stripeDetailsSubmitted ? 'submitted' : 'missing'}, payouts {payee.stripePayoutsEnabled ? 'enabled' : 'disabled'}, transfers {payee.stripeTransfersActive ? 'active' : 'inactive'}
                  </Typography>
                  {(payee.currentlyDueRequirementCount > 0 || payee.pastDueRequirementCount > 0 || payee.stripeDisabledReason) && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                      Currently due: {payee.currentlyDueRequirementCount}; past due: {payee.pastDueRequirementCount}. {payee.stripeDisabledReason || ''}
                    </Alert>
                  )}
                  {payee.suspensionReason && <Alert severity="error" sx={{ mt: 1.5 }}>{payee.suspensionReason}</Alert>}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Organization scope: {payee.approvedOrganizationId || 'not approved'} · Payout policy: {payee.payoutSchedulePolicy}; instant payouts: {payee.instantPayoutsAllowed ? 'available' : 'blocked'}
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignSelf={{ md: 'center' }}>
                  {payee.status === 'stripeVerified' && <Button variant="outlined" onClick={() => openAction(payee, 'review')}>Begin review</Button>}
                  {['stripeVerified', 'underReview'].includes(payee.status) && (
                    <Button variant="contained" startIcon={<CheckCircleOutlined />} onClick={() => openAction(payee, 'approve')}>Approve</Button>
                  )}
                  {payee.status !== 'suspended' && (
                    <Button color="error" variant="outlined" startIcon={<StopOutlined />} onClick={() => openAction(payee, 'suspend')}>Suspend</Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={Boolean(action)} onClose={closeAction} fullWidth maxWidth="sm">
        <DialogTitle>{action === 'approve' ? 'Approve rent payouts' : action === 'suspend' ? 'Suspend payee' : 'Begin payee review'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">{selected?.stripeAccountId}</Typography>
            {action === 'approve' && (
              <>
                <TextField label="Approved organization ID" type="number" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} inputProps={{ min: 1, step: 1 }} helperText="Approval applies only to this organization. The payee must be an active owner or billing manager." required />
                <TextField label="Evidence reference" value={evidence} onChange={(event) => setEvidence(event.target.value)} inputProps={{ maxLength: 500 }} helperText="Enter only a Stripe Dashboard or internal case/reference ID. Raw identity data belongs only in Stripe Dashboard." required />
                <TextField label="Review notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={3} inputProps={{ maxLength: 2000 }} helperText="Operational summary only; do not include raw KYC or identity data." required />
                <FormControlLabel control={<Checkbox checked={authority} onChange={(event) => setAuthority(event.target.checked)} />} label="I verified this person or business is authorized to collect rent for the linked property or management portfolio." />
              </>
            )}
            {action === 'suspend' && <TextField label="Suspension reason" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={3} inputProps={{ maxLength: 1000 }} required />}
            {action === 'review' && <Alert severity="info">This moves the payee into internal review. It does not enable transfers or payouts.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction} disabled={saving}>Cancel</Button>
          <Button variant="contained" color={action === 'suspend' ? 'error' : 'primary'} onClick={submitAction} disabled={submitDisabled}>
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
