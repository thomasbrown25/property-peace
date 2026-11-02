import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { extendedStayAgreementAPI as api } from 'api/extendedStayAgreement';
import { agreementDraft } from './extendedStayAgreement';

export default function ExtendedStayAgreementBuilder() {
  const { propertyId, unitId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [occupantName, setOccupantName] = useState('');
  useEffect(() => {
    let live = true;
    api.list(unitId).then((data) => { if (live) setRows(data); })
      .catch(() => { if (live) setError('Could not load agreements. Check owner access and try again.'); });
    return () => { live = false; };
  }, [unitId]);
  async function save(event) {
    event.preventDefault(); setError('');
    let draft;
    try { draft = agreementDraft(startDate, endDate, occupantName); }
    catch (err) { setError(err.message); return; }
    setBusy(true);
    try {
      await api.create(unitId, draft);
      setRows(await api.list(unitId));
      setOccupantName(''); setStartDate(''); setEndDate('');
    } catch (err) { setError(err?.response?.status === 409 ? 'Dates are occupied. Reload availability and choose another interval.' :
      'Could not save the agreement. Nothing was confirmed; please retry.'); }
    finally { setBusy(false); }
  }
  return <Box sx={{ maxWidth: 820, mx: 'auto', p: 3 }}>
    <Button onClick={() => navigate(`/landlord/property/${propertyId}/unit/${unitId}/short-stay`)}>Back to short-stay setup</Button>
    <Typography variant="h4" sx={{ my: 2 }}>Extended-stay agreement drafts</Typography>
    <Alert severity="warning" sx={{ mb: 2 }}>Development only. Saved drafts reserve local nights, but are unsigned and are not legally executed leases. No guest booking or payment is created. Airbnb may change independently; monitor calendar sync.</Alert>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {rows === null ? <Button onClick={() => { setError(''); api.list(unitId).then(setRows).catch(() => setError('Could not load agreements.')); }}>Retry loading</Button> : <Stack spacing={2}>
      <Paper component="form" onSubmit={save} sx={{ p: 3 }}><Stack spacing={2}>
        <TextField label="Occupant name" value={occupantName} onChange={(e) => setOccupantName(e.target.value)} inputProps={{ maxLength: 200 }} required />
        <TextField label="Start date (local)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
        <TextField label="End date (checkout, exclusive)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
        <Button type="submit" variant="contained" disabled={busy}>{busy ? <CircularProgress size={20} /> : 'Save unsigned agreement draft'}</Button>
      </Stack></Paper>
      <Typography variant="h6">Saved agreements</Typography>
      {rows.length === 0 ? <Typography>No agreements yet.</Typography> : rows.map((row) => <Paper key={row.id} sx={{ p: 2 }}>
        <Typography>{row.occupantName}: {row.startDate} – {row.endDate} (checkout exclusive)</Typography>
        <Typography variant="caption">Unsigned draft · ID {row.id}</Typography>
      </Paper>)}
    </Stack>}
  </Box>;
}
