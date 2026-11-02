import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Divider, Stack, TextField, Typography } from '@mui/material';
import axios from 'utils/axios';
import { formatCurrency } from 'utils/formatters';
import { addManualLeaseCharge, getLeaseChargeDefinitions, leaseDetailCharges } from './leaseDetailCharges.mjs';

const cardSx = { p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' };
const blankForm = { name: '', amount: '', dueDate: '' };

function ChargeSection({ title, items, empty, detail }) {
  return (
    <Box sx={cardSx}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1.5 }}>{title}</Typography>
      {items.length ? <Stack divider={<Divider flexItem />}>
        {items.map((item, index) => (
          <Stack key={`${item.id ?? item.name}-${index}`} direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ py: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{item.name}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{detail(item)}</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(item.amount ?? 0)}</Typography>
          </Stack>
        ))}
      </Stack> : <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{empty}</Typography>}
    </Box>
  );
}

export default function LeaseChargesTab({ leaseId }) {
  const [definitions, setDefinitions] = useState(null);
  const [loadedLeaseId, setLoadedLeaseId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);
  const activeLeaseId = useRef(leaseId);
  activeLeaseId.current = leaseId;
  const { recurring, fees, lateFees, deposits } = leaseDetailCharges(loadedLeaseId === leaseId ? definitions : null);
  const [kind, setKind] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const sequence = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const result = await getLeaseChargeDefinitions(axios, leaseId);
      if (sequence !== requestId.current || activeLeaseId.current !== leaseId) return false;
      setDefinitions(result);
      setLoadedLeaseId(leaseId);
      return true;
    } catch (err) {
      if (sequence === requestId.current && activeLeaseId.current === leaseId) {
        setLoadError(err?.response?.data?.message || err?.message || 'Lease charges could not be loaded.');
      }
      return false;
    } finally {
      if (sequence === requestId.current && activeLeaseId.current === leaseId) setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    setDefinitions(null);
    setLoadedLeaseId(null);
    setKind(null);
    setSaving(false);
    setNotice('');
    if (leaseId) void refresh();
    return () => { requestId.current += 1; };
  }, [leaseId, refresh]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    const submittedLeaseId = leaseId;
    const submittedGeneration = requestId.current;
    let finalGeneration = submittedGeneration;
    try {
      await addManualLeaseCharge(axios, leaseId, kind, form);
      if (activeLeaseId.current !== submittedLeaseId || requestId.current !== submittedGeneration) return;
      setKind(null);
      setForm(blankForm);
      const refreshGeneration = requestId.current + 1;
      finalGeneration = refreshGeneration;
      const refreshed = await refresh();
      if (activeLeaseId.current === submittedLeaseId && requestId.current === refreshGeneration) setNotice(refreshed
        ? `${kind === 'fee' ? 'Fee' : 'Deposit'} saved.`
        : 'Charge saved, but charges could not be refreshed. Try again.');
    } catch (err) {
      if (activeLeaseId.current !== submittedLeaseId || requestId.current !== submittedGeneration) return;
      const message = err?.response?.data?.message || err?.response?.data?.Message || err?.message;
      setError(err?.response?.status === 404 || err?.response?.status === 405
        ? 'Adding charges is not available on this server yet. Nothing was saved.'
        : (typeof message === 'string' ? message : 'Charge could not be saved. Nothing was added.'));
    } finally {
      if (activeLeaseId.current === submittedLeaseId && requestId.current === finalGeneration) setSaving(false);
    }
  };

  const openForm = (next) => { setKind(next); setForm(blankForm); setError(''); setNotice(''); };
  const dueDetail = (item) => item.dueDate ? `Due ${String(item.dueDate).slice(0, 10)}` : 'Due date not set';
  return (
    <Stack spacing={2}>
      {loading && <Typography role="status" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Loading lease charges…</Typography>}
      {loadError && <Stack direction="row" alignItems="center" spacing={1}><Typography role="alert" color="error.main">{loadError}</Typography><Button onClick={refresh}>Retry</Button></Stack>}
      {leaseId && loadedLeaseId === leaseId && !loading && !loadError && <>
      <ChargeSection title="Recurring charges" items={recurring} empty="No recurring rent defined." detail={(item) => `${item.frequency} rent${item.dueDay ? ` · Due day ${item.dueDay}` : ''}`} />
      <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>Only rent is supported as a recurring lease charge. Additional recurring fees are not available.</Typography>
      <ChargeSection title="One-time fees" items={fees} empty="No one-time fees recorded." detail={dueDetail} />
      {lateFees.length > 0 && <ChargeSection title="Late-fee rules" items={lateFees.map((fee) => ({ id: fee.id ?? fee.Id, name: fee.name ?? fee.Name ?? 'Late fee', amount: fee.amount ?? fee.Amount }))} empty="No late-fee rules." detail={() => 'Configured rule · not a charge until assessed'} />}
      <ChargeSection title="Deposits" items={deposits} empty="No deposits recorded." detail={dueDetail} />
      </>}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" onClick={() => openForm('fee')} disabled={!leaseId || loadedLeaseId !== leaseId || saving}>Add one-time fee</Button>
        <Button variant="outlined" onClick={() => openForm('deposit')} disabled={!leaseId || loadedLeaseId !== leaseId || saving}>Add deposit</Button>
      </Stack>
      {notice && <Typography role="status" color="success.main" sx={{ fontSize: '0.75rem' }}>{notice}</Typography>}
      {kind && <Box component="form" onSubmit={submit} sx={cardSx}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Add {kind === 'fee' ? 'one-time fee' : 'deposit'}</Typography>
        <Stack spacing={1.5}>
          <TextField label="Name" required size="small" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} inputProps={{ maxLength: 200 }} />
          <TextField label="Amount" required size="small" type="number" inputProps={{ min: '0.01', step: '0.01' }} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <TextField label="Due date" required size="small" type="date" InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          {error && <Typography role="alert" color="error.main" sx={{ fontSize: '0.75rem' }}>{error}</Typography>}
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save charge'}</Button>
            <Button disabled={saving} onClick={() => { setKind(null); setError(''); }}>Cancel</Button>
          </Stack>
        </Stack>
      </Box>}
    </Stack>
  );
}
