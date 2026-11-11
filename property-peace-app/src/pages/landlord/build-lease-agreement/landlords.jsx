import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, Box, Button, CircularProgress, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import useAuth from 'hooks/useAuth';
import { updateLeaseAgreement } from 'store/lease/lease.action';
import useSupplementalLease from './useSupplementalLease';
import { readAgreement } from './agreementWorkflow.mjs';
import { emptyLandlord, landlordFields, landlordsFromLease, landlordError, landlordPayload } from './landlordDetails.mjs';

export default function LandlordsPage({ leaseData, onSaved }) {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const leaseId = Number(readAgreement(leaseData, 'id'));
  const [landlords, setLandlords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const { lease, loading, error: loadError } = useSupplementalLease(leaseId, leaseData,
    (savedLease) => setLandlords(landlordsFromLease(savedLease, user)));
  const change = (index, key, value) => setLandlords((previous) => previous.map((person, i) => i === index ? { ...person, [key]: value } : person));
  const save = async () => {
    if (inFlight.current || loading || !lease) return;
    const validation = landlordError(landlords);
    if (validation) { setError(validation); return; }
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await dispatch(updateLeaseAgreement(leaseId, landlordPayload(landlords)));
      if (result?.success !== true) throw new Error(result?.message || 'Could not save landlord details.');
      await onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not save landlord details. Your changes are preserved.');
    } finally { inFlight.current = false; setSaving(false); }
  };
  if (loading) return <CircularProgress aria-label="Loading landlord details" />;
  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  return <Stack spacing={3}>
    {error && <Alert severity="error">{error}</Alert>}
    <Box component="fieldset" disabled={saving} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <Stack spacing={3}>
        {landlords.map((person, index) => <Stack key={index} spacing={2}>
          <Typography variant="h5">Landlord {index + 1}</Typography>
          <TextField select fullWidth label="Landlord type" value={person.entityType} onChange={(event) => change(index, 'entityType', event.target.value)}>
            <MenuItem value="Individual">Individual</MenuItem><MenuItem value="Company">Company</MenuItem>
          </TextField>
          <Grid container spacing={2}>
            {Object.entries(landlordFields).filter(([key]) => person.entityType === 'Company' || key !== 'companyName').map(([key, label]) => <Grid key={key} size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label={label} value={person[key]} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                required={person.entityType === 'Company' ? key === 'companyName' : ['firstName', 'lastName'].includes(key)}
                onChange={(event) => change(index, key, event.target.value)} />
            </Grid>)}
          </Grid>
          <Button color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => setLandlords((previous) => previous.filter((_, i) => i !== index))}>Remove landlord</Button>
        </Stack>)}
        <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => setLandlords((previous) => [...previous, emptyLandlord()])}>Add landlord</Button>
      </Stack>
    </Box>
    <Button variant="contained" disabled={saving} sx={{ alignSelf: 'flex-end' }} onClick={save}>
      {saving ? 'Saving…' : 'Save & continue'}
    </Button>
  </Stack>;
}
