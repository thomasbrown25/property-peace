import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  FormLabel, InputLabel, MenuItem, Radio, RadioGroup, Select, Stack, TextField, Typography
} from '@mui/material';
import { authenticatePublicShowing, bookPublicShowing, cancelPublicShowing, getPreScreenCatalog, getPublicAvailability, reschedulePublicShowing, submitPublicInquiry, verifyLeadContact } from 'api/leads';
import { formatZonedDateTime, getLeadErrorMessage, toUtcIso } from 'utils/leads';

const freshKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const bool = (value) => value === '' ? null : value === 'yes';
const initialForm = { name: '', email: '', phone: '', moveInDate: '', occupants: '', pets: '', smoking: '', incomeRange: '', requestedShowingTime: '' };

export default function PublicInquiryDialog({ open, onClose, listingId, propertyName }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [catalog, setCatalog] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [browserSession, setBrowserSession] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [booking, setBooking] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(freshKey);
  const [form, setForm] = useState(initialForm);
  const [manageMode, setManageMode] = useState(false);
  const [showingReference, setShowingReference] = useState('');
  const [managementCode, setManagementCode] = useState('');
  const [management, setManagement] = useState(null);
  const [managementComplete, setManagementComplete] = useState('');

  useEffect(() => {
    if (!open || !listingId) return;
    setLoading(true); setError('');
    Promise.all([getPreScreenCatalog(listingId), getPublicAvailability(listingId, new Date().toISOString())])
      .then(([nextCatalog, availability]) => { setCatalog(nextCatalog); setSlots(Array.isArray(availability) ? availability : []); })
      .catch((requestError) => setError(getLeadErrorMessage(requestError, 'Inquiry options could not be loaded. You may retry.')))
      .finally(() => setLoading(false));
  }, [open, listingId]);

  const close = () => {
    if (submitting) return;
    onClose();
    setTimeout(() => {
      setError(''); setResult(null); setVerificationCode(''); setBrowserSession(''); setSelectedSlot(''); setBooking(null);
      setManageMode(false); setShowingReference(''); setManagementCode(''); setManagement(null); setManagementComplete('');
      setIdempotencyKey(freshKey()); setForm(initialForm);
    }, 250);
  };
  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const requestedShowingTime = form.requestedShowingTime ? toUtcIso(form.requestedShowingTime, timeZone) : null;
      if (form.requestedShowingTime && !requestedShowingTime) {
        setError('That requested wall-clock time is nonexistent or ambiguous in this timezone. Choose another time.');
        return;
      }
      const receipt = await submitPublicInquiry(listingId, {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null,
        source: 'listingWebsite', idempotencyKey,
        answers: { moveInDate: form.moveInDate || null, occupants: form.occupants ? Number(form.occupants) : null,
          hasPets: bool(form.pets), smoking: bool(form.smoking), incomeRange: form.incomeRange || null, requestedShowingTime }
      });
      if (!receipt) throw new Error('Inquiry receipt was not returned.');
      setResult(receipt);
    } catch (requestError) {
      setError(getLeadErrorMessage(requestError, requestError?.message || 'Your inquiry could not be accepted. Please review it and try again.'));
    } finally { setSubmitting(false); }
  };
  const verify = async (event) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const response = await verifyLeadContact(listingId, verificationCode.trim());
      if (!response?.session) throw new Error('Verification could not be processed.');
      setBrowserSession(response.session); setVerificationCode('');
      const availability = await getPublicAvailability(listingId, new Date().toISOString());
      setSlots(Array.isArray(availability) ? availability : []);
    } catch (requestError) {
      setError(getLeadErrorMessage(requestError, requestError?.message || 'Verification could not be processed.'));
    } finally { setSubmitting(false); }
  };
  const book = async () => {
    setSubmitting(true); setError('');
    try {
      const confirmed = await bookPublicShowing(listingId, {
        availabilityId: Number(selectedSlot), timeZoneId: timeZone, idempotencyKey: freshKey(), session: browserSession
      });
      setBooking(confirmed);
    } catch (requestError) {
      setError(getLeadErrorMessage(requestError, 'The code or showing time could not be confirmed. Re-enter the newest code and try again.'));
      setBrowserSession(''); setSelectedSlot('');
    } finally { setSubmitting(false); }
  };
  const authenticateManagement = async (event) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const next = await authenticatePublicShowing(listingId, Number(showingReference), managementCode);
      if (!next?.session || !next?.showing?.concurrencyToken) throw new Error('Showing access could not be confirmed.');
      setManagement(next); setManagementCode('');
      const availability = await getPublicAvailability(listingId, new Date().toISOString());
      setSlots(Array.isArray(availability) ? availability : []);
    } catch (requestError) {
      setManagement(null); setManagementCode('');
      setError(getLeadErrorMessage(requestError, 'The showing reference or management code could not be confirmed.'));
    } finally { setSubmitting(false); }
  };
  const cancelManaged = async () => {
    if (!globalThis.confirm?.('Cancel this showing? This cannot be undone.')) return;
    setSubmitting(true); setError('');
    try {
      await cancelPublicShowing(listingId, Number(showingReference), management.session, management.showing.concurrencyToken);
      setManagement(null); setManagementCode(''); setShowingReference('');
      setManagementComplete('Your showing was cancelled.');
    } catch (requestError) {
      setManagement(null); setError(getLeadErrorMessage(requestError, 'The showing could not be cancelled. Re-enter your code and try again.'));
    } finally { setSubmitting(false); }
  };
  const rescheduleManaged = async () => {
    setSubmitting(true); setError('');
    try {
      await reschedulePublicShowing(listingId, Number(showingReference), {
        availabilityId: Number(selectedSlot), timeZoneId: timeZone, idempotencyKey: freshKey(),
        session: management.session, concurrencyToken: management.showing.concurrencyToken
      });
      setManagement(null); setManagementCode(''); setShowingReference(''); setSelectedSlot('');
      setManagementComplete('Your showing was rescheduled.');
    } catch (requestError) {
      setManagement(null); setSelectedSlot('');
      setError(getLeadErrorMessage(requestError, 'The showing could not be rescheduled. Re-enter your code and choose an available time.'));
    } finally { setSubmitting(false); }
  };
  const config = catalog?.configuration || {};

  return <Dialog open={open} onClose={close} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1.5 } }}>
    <DialogTitle>{manageMode ? 'Manage a showing' : booking ? 'Showing confirmed' : browserSession ? 'Choose a showing' : result ? 'Verify your contact' : `Ask about ${propertyName || 'this home'}`}</DialogTitle>
    <DialogContent dividers>
      {loading && <Stack alignItems="center" role="status" sx={{ py: 4 }}><CircularProgress /><Typography sx={{ mt: 1 }}>Loading inquiry options…</Typography></Stack>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && manageMode && <Stack spacing={2}>
        {managementComplete && <Alert severity="success" role="status">{managementComplete}</Alert>}
        {!management && !managementComplete && <Box component="form" id="public-showing-management-form" onSubmit={authenticateManagement}>
          <Stack spacing={2}>
            <Alert severity="info">Use the non-secret showing reference from your confirmation and the management code delivered separately. Codes are never placed in links.</Alert>
            <TextField required type="number" label="Showing reference" value={showingReference} onChange={(e) => setShowingReference(e.target.value)} inputProps={{ min: 1, inputMode: 'numeric' }} autoFocus />
            <TextField required type="password" label="Management code" value={managementCode} onChange={(e) => setManagementCode(e.target.value)} autoComplete="off" inputProps={{ maxLength: 200 }} helperText="Kept only while this dialog is open." />
          </Stack>
        </Box>}
        {management && <Stack spacing={2}>
          <Alert severity="success">Showing access confirmed for this action.</Alert>
          <Box><Typography variant="caption" color="text.secondary">Current showing ({timeZone})</Typography><Typography>{formatZonedDateTime(management.showing.startsAtUtc, timeZone)} – {formatZonedDateTime(management.showing.endsAtUtc, timeZone)}</Typography></Box>
          {!slots.length ? <Alert severity="info">No alternative showing times are currently available.</Alert> : <FormControl fullWidth><InputLabel id="managed-showing-label">New showing time</InputLabel><Select labelId="managed-showing-label" label="New showing time" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>{slots.map((slot) => <MenuItem key={slot.id} value={String(slot.id)}>{formatZonedDateTime(slot.startsAtUtc, timeZone)} – {formatZonedDateTime(slot.endsAtUtc, timeZone)}</MenuItem>)}</Select></FormControl>}
          <Typography variant="caption" color="text.secondary">Times are displayed in {timeZone}. Availability can change, and stale changes fail closed.</Typography>
        </Stack>}
      </Stack>}
      {!manageMode && !loading && booking && <Alert severity="success"><strong>Your showing is confirmed.</strong> {formatZonedDateTime(booking.startsAtUtc, timeZone)} – {formatZonedDateTime(booking.endsAtUtc, timeZone)}. Confirmation delivery may still be pending.</Alert>}
      {!loading && result && !browserSession && !booking && <Stack spacing={2}>
        <Alert severity="success"><strong>Your inquiry was accepted.</strong> Check your email for the contact verification entry code. Delivery may still be pending.</Alert>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}><Typography variant="caption" color="text.secondary">Inquiry receipt</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{result.receipt}</Typography></Box>
        <Box component="form" id="public-verification-form" onSubmit={verify}><TextField fullWidth required label="Verification entry code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} autoComplete="one-time-code" inputProps={{ maxLength: 200 }} helperText="Enter the code exactly as delivered. For privacy, booking—not this response—confirms whether it is valid." /></Box>
      </Stack>}
      {!loading && browserSession && !booking && <Stack spacing={2}>
        <Alert severity="info">Verification was processed. Select a time to confirm both the code and booking. Availability can change.</Alert>
        {!slots.length ? <Alert severity="info">No public showing times are currently available.</Alert> : <FormControl fullWidth><InputLabel id="public-showing-label">Showing time</InputLabel><Select labelId="public-showing-label" label="Showing time" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>{slots.map((slot) => <MenuItem key={slot.id} value={String(slot.id)}>{formatZonedDateTime(slot.startsAtUtc, timeZone)} – {formatZonedDateTime(slot.endsAtUtc, timeZone)}</MenuItem>)}</Select></FormControl>}
      </Stack>}
      {!manageMode && !loading && !result && <Box component="form" id="public-inquiry-form" onSubmit={submit}>
        <Alert severity="info" sx={{ mb: 2 }}>Send a lightweight inquiry before applying. Your contact must be verified before a showing can be booked.</Alert>
        <Stack spacing={2}>
          <TextField required label="Full name" autoComplete="name" value={form.name} onChange={(e) => setForm((value) => ({ ...value, name: e.target.value }))} inputProps={{ maxLength: 200 }} />
          <TextField required type="email" label="Email" autoComplete="email" value={form.email} onChange={(e) => setForm((value) => ({ ...value, email: e.target.value }))} inputProps={{ maxLength: 320 }} />
          <TextField type="tel" label="Phone (optional)" autoComplete="tel" value={form.phone} onChange={(e) => setForm((value) => ({ ...value, phone: e.target.value }))} inputProps={{ maxLength: 32 }} />
          {config.askMoveInDate && <TextField type="date" label="Preferred move-in date (optional)" InputLabelProps={{ shrink: true }} value={form.moveInDate} onChange={(e) => setForm((value) => ({ ...value, moveInDate: e.target.value }))} helperText="Used to compare your timing with the home’s availability." />}
          {config.askOccupants && <TextField type="number" label="Number of occupants (optional)" inputProps={{ min: 1, max: 50 }} value={form.occupants} onChange={(e) => setForm((value) => ({ ...value, occupants: e.target.value }))} helperText="Used for lawful occupancy limits and space needs." />}
          {config.askPets && <FormControl><FormLabel id="pets-label">Pets (optional)</FormLabel><RadioGroup row aria-labelledby="pets-label" value={form.pets} onChange={(e) => setForm((value) => ({ ...value, pets: e.target.value }))}><FormControlLabel value="yes" control={<Radio />} label="Yes" /><FormControlLabel value="no" control={<Radio />} label="No" /></RadioGroup><Typography variant="caption" color="text.secondary">Used to compare with the published pet policy and accommodations process.</Typography></FormControl>}
          {config.askSmoking && <FormControl><FormLabel id="smoking-label">Would anyone smoke at the property? (optional)</FormLabel><RadioGroup row aria-labelledby="smoking-label" value={form.smoking} onChange={(e) => setForm((value) => ({ ...value, smoking: e.target.value }))}><FormControlLabel value="yes" control={<Radio />} label="Yes" /><FormControlLabel value="no" control={<Radio />} label="No" /></RadioGroup><Typography variant="caption" color="text.secondary">Used to compare with the published smoke-free policy.</Typography></FormControl>}
          {config.askIncomeRange && <FormControl><InputLabel id="income-range-label">Income range (optional)</InputLabel><Select labelId="income-range-label" label="Income range (optional)" value={form.incomeRange} onChange={(e) => setForm((value) => ({ ...value, incomeRange: e.target.value }))}><MenuItem value="">Prefer not to answer</MenuItem><MenuItem value="under-2x">Under 2× monthly rent</MenuItem><MenuItem value="2x-3x">2×–3× monthly rent</MenuItem><MenuItem value="3x-plus">3× or more monthly rent</MenuItem></Select><Typography variant="caption" color="text.secondary" sx={{ mt: .5 }}>Used to explain published affordability criteria; no documents are collected here.</Typography></FormControl>}
          {config.askRequestedShowingTime && <TextField type="datetime-local" label="Requested showing time (optional)" InputLabelProps={{ shrink: true }} value={form.requestedShowingTime} onChange={(e) => setForm((value) => ({ ...value, requestedShowingTime: e.target.value }))} helperText={`Entered in ${timeZone}; nonexistent or ambiguous DST times are rejected.`} />}
          <Box><Typography variant="subtitle2">Published showing availability</Typography>{!slots.length ? <Typography variant="body2" color="text.secondary">No public showing times are currently available.</Typography> : <Stack spacing={.75} sx={{ mt: 1 }}>{slots.slice(0, 6).map((slot) => <Box key={slot.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider' }}><Typography variant="body2">{formatZonedDateTime(slot.startsAtUtc, timeZone)} – {formatZonedDateTime(slot.endsAtUtc, timeZone)}</Typography></Box>)}</Stack>}<Typography variant="caption" color="text.secondary">Availability can change. Verification is required before booking.</Typography></Box>
          <Typography variant="caption" color="text.secondary">Do not include SSNs, bank information, or identity documents.</Typography>
        </Stack>
      </Box>}
    </DialogContent>
    <DialogActions>{manageMode ? (managementComplete ? <Button variant="contained" onClick={close}>Done</Button> : management ? <><Button onClick={close} disabled={submitting}>Close</Button><Button color="error" onClick={cancelManaged} disabled={submitting}>Cancel showing</Button><Button variant="contained" onClick={rescheduleManaged} disabled={submitting || !selectedSlot}>{submitting ? 'Saving…' : 'Reschedule'}</Button></> : <><Button onClick={() => { setManageMode(false); setManagementCode(''); setError(''); }} disabled={submitting}>Back</Button><Button type="submit" form="public-showing-management-form" variant="contained" disabled={submitting || !showingReference || !managementCode.trim()}>{submitting ? 'Checking…' : 'Continue'}</Button></>) : booking ? <Button variant="contained" onClick={close}>Done</Button> : browserSession ? <><Button onClick={close} disabled={submitting}>Close</Button><Button variant="contained" disabled={submitting || !selectedSlot} onClick={book}>{submitting ? 'Confirming…' : 'Book showing'}</Button></> : result ? <><Button onClick={close} disabled={submitting}>Close</Button><Button type="submit" form="public-verification-form" variant="contained" disabled={submitting || !verificationCode.trim()}>{submitting ? 'Processing…' : 'Verify and continue'}</Button></> : <><Button onClick={() => setManageMode(true)} disabled={submitting}>Manage a showing</Button><Button onClick={close} disabled={submitting}>Cancel</Button><Button type="submit" form="public-inquiry-form" variant="contained" disabled={submitting || loading || !form.name.trim() || !form.email.trim()} startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}>{submitting ? 'Submitting…' : 'Send inquiry'}</Button></>}</DialogActions>
  </Dialog>;
}
