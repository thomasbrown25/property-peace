import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import axiosServices from 'utils/axios';
import { createRentMethodsApi } from 'utils/connectedRentStripe.mjs';

const methodsApi = createRentMethodsApi(axiosServices);

// Mounted by lease + account, so a prior lease's methods and mutations cannot leak into a new one.
export default function SavedRentPaymentMethods({ leaseId, stripeAccountId, refresh }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMethods([]);
    setError('');
    methodsApi.list(leaseId, stripeAccountId).then((paymentMethods) => {
      if (!active) return;
      setMethods(paymentMethods);
    }).catch((err) => {
      if (active) setError(err.response?.data?.message || err.message || 'Unable to load payment methods.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leaseId, stripeAccountId, refresh, revision]);

  const mutate = async (methodId, action) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await methodsApi.mutate(leaseId, methodId, action);
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to update payment method.');
    } finally { setBusy(false); }
  };

  return <Stack spacing={1.5} sx={{ px: 3, py: 2 }}>
    <Typography variant="subtitle2">Saved for this rent recipient</Typography>
    <Typography variant="body2" color="text.secondary">Methods saved with a different landlord are not shared with this account.</Typography>
    {error && <Alert severity="error" action={<Button onClick={() => setRevision((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
    {loading ? <CircularProgress size={20} /> : methods.length ? methods.map((method) => <Box key={method.id}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="body2">{method.brand || method.bankName || method.type} ending in {method.last4}</Typography>
        {method.isDefault && <Chip size="small" label="Default" />}
        {!method.isDefault && <Button size="small" disabled={busy} onClick={() => mutate(method.id, 'default')}>Make default</Button>}
        <Button size="small" color="error" disabled={busy} onClick={() => mutate(method.id, 'remove')}>Remove</Button>
      </Stack>
    </Box>) : !error && <Typography variant="body2" color="text.secondary">No saved payment methods for this rent recipient.</Typography>}
  </Stack>;
}
