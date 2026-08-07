import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import {
  addStaffAvailability, getPreScreenCatalog, getStaffAvailability, setPreScreenConfiguration, updateStaffAvailability
} from 'api/leads';
import { formatZonedDateTime, getLeadErrorMessage, toUtcIso } from 'utils/leads';

const CONFIG_FIELDS = [
  ['askMoveInDate', 'Move-in date'], ['askOccupants', 'Number of occupants'], ['askPets', 'Pets'],
  ['askSmoking', 'Smoking policy'], ['askIncomeRange', 'Income range'], ['askRequestedShowingTime', 'Requested showing time']
];

export default function ListingLeadSettings({ listings, timeZone }) {
  const [listingId, setListingId] = useState('');
  const [tab, setTab] = useState(0);
  const [availability, setAvailability] = useState([]);
  const [config, setConfig] = useState(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [zone, setZone] = useState(timeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (selected = listingId) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const [slots, catalog] = await Promise.all([getStaffAvailability(selected), getPreScreenCatalog(selected)]);
      setAvailability(Array.isArray(slots) ? slots : []);
      setConfig(catalog?.configuration || null);
    } catch (requestError) { setError(getLeadErrorMessage(requestError, 'Listing lead settings could not be loaded.')); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (listingId) load(listingId); else { setAvailability([]); setConfig(null); } }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSlot = async () => {
    const starts = toUtcIso(startsAt, zone); const ends = toUtcIso(endsAt, zone);
    if (!starts || !ends) { setError('A start or end time is nonexistent or ambiguous in this timezone. Choose unambiguous wall-clock times.'); return; }
    if (Date.parse(ends) <= Date.parse(starts)) { setError('The showing end must be after its start.'); return; }
    setBusy(true); setError('');
    try { await addStaffAvailability(listingId, { startsAt: starts, endsAt: ends, timeZoneId: zone }); setStartsAt(''); setEndsAt(''); await load(); }
    catch (requestError) { setError(getLeadErrorMessage(requestError)); setBusy(false); }
  };
  const toggleSlot = async (slot) => {
    setBusy(true); setError('');
    try { await updateStaffAvailability(listingId, slot.id, { startsAt: slot.startsAtUtc, endsAt: slot.endsAtUtc, timeZoneId: slot.timeZoneId, isDisabled: !slot.isDisabled, concurrencyToken: slot.concurrencyToken }); await load(); }
    catch (requestError) { setError(getLeadErrorMessage(requestError)); setBusy(false); }
  };
  const saveConfig = async () => {
    setBusy(true); setError('');
    try { const saved = await setPreScreenConfiguration(listingId, config); setConfig(saved); }
    catch (requestError) { setError(getLeadErrorMessage(requestError)); }
    finally { setBusy(false); }
  };

  return <Box>
    <Typography variant="h6" fontWeight={750}>Listing lead settings</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Manage concise pre-screen questions and bookable showing windows by property listing.</Typography>
    <FormControl size="small" fullWidth><InputLabel id="settings-listing-label">Listing / property</InputLabel><Select labelId="settings-listing-label" label="Listing / property" value={listingId} onChange={(e) => setListingId(e.target.value)}><MenuItem value="">Select a listing</MenuItem>{listings.map((listing) => <MenuItem key={listing.id} value={String(listing.id)}>{listing.label}</MenuItem>)}</Select></FormControl>
    {listingId && <><Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Listing lead settings sections" sx={{ mt: 1 }}><Tab id="settings-tab-0" aria-controls="settings-panel-0" label="Availability" /><Tab id="settings-tab-1" aria-controls="settings-panel-1" label="Pre-screen" /></Tabs>{error && <Alert severity="error" sx={{ my: 1.5 }}>{error}</Alert>}{busy && <CircularProgress size={20} sx={{ my: 1 }} />}
      {tab === 0 && <Stack role="tabpanel" id="settings-panel-0" aria-labelledby="settings-tab-0" spacing={1.5} sx={{ mt: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" fullWidth type="datetime-local" label="Starts" InputLabelProps={{ shrink: true }} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /><TextField size="small" fullWidth type="datetime-local" label="Ends" InputLabelProps={{ shrink: true }} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Stack>
        <TextField size="small" label="IANA timezone" value={zone} onChange={(e) => setZone(e.target.value)} helperText="Times are converted to UTC before saving." />
        <Button variant="contained" disabled={busy} onClick={addSlot}>Add showing window</Button>
        {!availability.length && !busy ? <Alert severity="info">No showing availability has been added for this listing.</Alert> : availability.map((slot) => <Box key={slot.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider' }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="body2" fontWeight={700}>{formatZonedDateTime(slot.startsAtUtc, timeZone)}</Typography><Typography variant="caption" color="text.secondary">Ends {formatZonedDateTime(slot.endsAtUtc, timeZone)} · saved as {slot.timeZoneId}</Typography></Box><Button size="small" onClick={() => toggleSlot(slot)}>{slot.isDisabled ? 'Enable' : 'Disable'}</Button></Stack></Box>)}
      </Stack>}
      {tab === 1 && config && <Stack role="tabpanel" id="settings-panel-1" aria-labelledby="settings-tab-1" sx={{ mt: 1.5 }}>{CONFIG_FIELDS.map(([key, label]) => <FormControlLabel key={key} control={<Checkbox checked={Boolean(config[key])} onChange={(e) => setConfig((current) => ({ ...current, [key]: e.target.checked }))} />} label={label} />)}<Alert severity="info" sx={{ my: 1 }}>These optional, policy-related questions come from the protected backend catalog. Custom protected-class questions are not supported.</Alert><Button variant="contained" disabled={busy} onClick={saveConfig}>Save pre-screen questions</Button></Stack>}
    </>}
  </Box>;
}
