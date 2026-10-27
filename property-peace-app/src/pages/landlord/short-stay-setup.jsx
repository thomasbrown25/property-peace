import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createShortStaySetupLoader } from 'utils/shortStaySetupLoader';
import { Alert, Box, Button, Checkbox, CircularProgress, Divider, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { shortStayAPI } from 'api/shortStay';
import { blockPayload, isLocalDate, listingPayload, ratePayload, rangeRatePayload, setupError } from 'utils/shortStaySetup';
import { createPhotoGallery, validatePhotoSelection } from './short-stay-photos';
import { airbnbBlockIsManual, createAirbnbCalendar, formatAirbnbInstant } from './short-stay-airbnb';
import { createGuidebookDraft } from './short-stay-guidebook';
import ShortStayCollection from './short-stay-collection.jsx';
import ShortStayConnect from './short-stay-connect.jsx';
import { createInventorySnapshot } from './short-stay-inventory';
import InventorySnapshotCard from './short-stay-inventory-card.jsx';

const EMPTY_DRAFT = {
  nightlyBasePrice: '', weekendNightlyRate: '', weeklyDiscountPercent: '0', monthlyDiscountPercent: '0', minimumNights: '1', capacity: '1', cleaningFee: '0',
  checkInTime: '', checkOutTime: '', houseRules: '', amenities: '', cancellationPolicy: '', lodgingTaxRatePercent: '', publicTitle: '', publicSummary: ''
};
const pricingDraft = (listing) => ({ ...EMPTY_DRAFT, ...listing, weekendNightlyRate: listing.weekendNightlyRate ?? '', weeklyDiscountPercent: listing.weeklyDiscountPercent ?? 0, monthlyDiscountPercent: listing.monthlyDiscountPercent ?? 0, checkInTime: listing.checkInTime?.slice(0, 5) || '', checkOutTime: listing.checkOutTime?.slice(0, 5) || '' });

export default function ShortStaySetup() {
  const { propertyId, unitId } = useParams();
  return <ShortStaySetupForUnit key={`${propertyId}/${unitId}`} propertyId={propertyId} unitId={unitId} />;
}

function ShortStaySetupForUnit({ propertyId, unitId }) {
  const navigate = useNavigate();
  const [timeZoneId, setTimeZoneId] = useState('');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [taxAttested, setTaxAttested] = useState(false);
  const [savedTax, setSavedTax] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [reason, setReason] = useState('');
  const [rateDate, setRateDate] = useState('');
  const [rate, setRate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeRate, setRangeRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [inventory, setInventory] = useState({ report: null, loading: false, error: '' });
  const [inventoryController] = useState(() => createInventorySnapshot({
    api: shortStayAPI, unitId,
    update: (change) => setInventory((current) => ({ ...current, ...change }))
  }));
  const [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const [listingExists, setListingExists] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const photoInput = useRef(null);
  const airbnbInput = useRef(null);
  const [airbnb, setAirbnb] = useState({ status: null, loading: false, busy: false, error: '', notice: '' });
  const [guidebook, setGuidebook] = useState({ draft: null, exists: false, loading: false, busy: false, error: '', notice: '' });
  const [guidebookController] = useState(() => createGuidebookDraft({
    api: shortStayAPI, unitId,
    update: (change) => setGuidebook((current) => ({ ...current, ...change }))
  }));
  const [airbnbController] = useState(() => createAirbnbCalendar({
    api: shortStayAPI, unitId,
    update: (change) => setAirbnb((current) => ({ ...current, ...change }))
  }));
  const [gallery] = useState(() => createPhotoGallery({
    api: shortStayAPI, unitId,
    update: (change) => {
      if ('photos' in change) setPhotos(change.photos);
      if ('loading' in change) setPhotoLoading(change.loading);
      if ('error' in change) setPhotoError(change.error);
    }
  }));
  const [loader] = useState(() => createShortStaySetupLoader({
    api: shortStayAPI, propertyId, unitId,
    update: (change) => {
      if ('verified' in change) setVerified(change.verified);
      if ('loading' in change) setLoading(change.loading);
      if ('error' in change) setError(change.error);
      if ('notice' in change) setNotice(change.notice);
      if ('timeZoneId' in change) setTimeZoneId(change.timeZoneId);
      if ('draft' in change) {
        const listing = change.draft;
        setListingExists(Boolean(listing));
        setSavedTax(listing);
        setTaxAttested(false);
        setDraft(listing ? pricingDraft(listing) : EMPTY_DRAFT);
      }
      if ('calendar' in change) setCalendar(change.calendar);
      if ('start' in change) setStart(change.start);
      if ('end' in change) setEnd(change.end);
      if ('calendarLoading' in change) setCalendarLoading(change.calendarLoading);
      if ('calendarError' in change) setCalendarError(change.calendarError);
    }
  }));
  const refreshCalendar = loader.calendar;
  const refreshInventory = inventoryController.load;
  const refreshSetup = loader.load;
  useEffect(() => { loader.activate(); refreshSetup(); return () => loader.invalidate(); }, [loader, refreshSetup]);
  useEffect(() => {
    if (verified && !loading && timeZoneId && start && end) {
      inventoryController.activate();
      refreshInventory(start, end);
    } else {
      inventoryController.invalidate();
      setInventory({ report: null, loading: false, error: '' });
    }
    return () => inventoryController.invalidate();
  }, [inventoryController, refreshInventory, verified, loading, timeZoneId, start, end]);
  useEffect(() => {
    if (verified && !loading) {
      guidebookController.activate();
      guidebookController.load();
    } else {
      guidebookController.invalidate();
      setGuidebook({ draft: null, exists: false, loading: false, busy: false, error: '', notice: '' });
    }
    return () => guidebookController.invalidate();
  }, [guidebookController, verified, loading]);
  useEffect(() => {
    if (verified && !loading && timeZoneId) {
      airbnbController.activate();
      airbnbController.load();
    } else {
      airbnbController.invalidate();
      setAirbnb({ status: null, loading: false, busy: false, error: '', notice: '' });
    }
    return () => {
      airbnbController.invalidate();
      if (airbnbInput.current) airbnbInput.current.value = '';
    };
  }, [airbnbController, verified, loading, timeZoneId]);
  useEffect(() => {
    if (listingExists && verified && !loading) {
      gallery.activate();
      gallery.load(true);
    } else {
      gallery.invalidate();
      gallery.load(false);
    }
    return () => gallery.invalidate();
  }, [gallery, listingExists, verified, loading]);

  const action = async (request, success, refresh = false) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request();
      if (!loader.isActive()) return;
      setNotice(success);
      if (refresh) {
        await Promise.all([refreshCalendar(start, end), refreshInventory(start, end)]);
      }
    } catch (err) { if (loader.isActive()) setError(setupError(err)); }
    finally { if (loader.isActive()) setBusy(false); }
  };

  const field = (key, label, props = {}) => <TextField key={key} label={label} value={draft[key] ?? ''} onChange={(e) => setDraft((current) => ({ ...current, [key]: e.target.value }))} fullWidth {...props} />;
  const applySavedListing = (saved) => {
    setDraft(pricingDraft(saved));
    setSavedTax(saved);
    setTaxAttested(false);
    setListingExists(true);
  };
  const disabled = busy || loading;
  const airbnbAction = async (request, refreshDates = false) => {
    const success = await request();
    if (success && refreshDates && loader.isActive()) await Promise.all([refreshCalendar(start, end), refreshInventory(start, end)]);
  };
  const photoAction = async (request, success) => {
    setBusy(true);
    setPhotoError('');
    setNotice('');
    try {
      await request();
      if (loader.isActive()) setNotice(success);
    } catch (err) { if (loader.isActive()) setPhotoError(setupError(err)); }
    finally { if (loader.isActive()) setBusy(false); }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Button onClick={() => navigate(`/landlord/property/${propertyId}`)}>Back to property</Button>
      <Typography variant="h4" sx={{ my: 2 }}>Short-stay owner setup</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>Owner setup only — guests cannot book yet.</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {error && <Button disabled={busy || loading} onClick={refreshSetup} sx={{ mb: 2 }}>Retry loading setup</Button>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {loading ? <CircularProgress aria-label="Loading short-stay setup" /> : verified && <Stack spacing={3}>
        <ShortStayConnect propertyId={propertyId} />
        <ShortStayCollection propertyId={propertyId} />
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Private owner guidebook draft</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Visible only to the owner team. Saving does not publish to guests. Use plain text only; do not enter access codes, passwords, contact details or other secrets.</Typography>
          {guidebook.error && <Alert severity="error" sx={{ mb: 2 }}>{guidebook.error}</Alert>}
          {guidebook.notice && <Alert severity="success" sx={{ mb: 2 }}>{guidebook.notice}</Alert>}
          {guidebook.loading ? <CircularProgress size={24} aria-label="Loading guidebook draft" /> : guidebook.draft ? <Stack spacing={2}>
            {[
              ['houseRules', 'House rules'],
              ['arrivalOverview', 'Arrival overview'],
              ['localNotes', 'Local notes']
            ].map(([key, label]) => <TextField key={key} label={label} value={guidebook.draft[key] ?? ''} multiline minRows={3} fullWidth disabled={guidebook.busy} inputProps={{ maxLength: 2000 }} helperText={`${(guidebook.draft[key] ?? '').length}/2000 characters`} onChange={(event) => {
              const value = event.target.value;
              setGuidebook((current) => ({ ...current, draft: { ...current.draft, [key]: value }, error: '', notice: '' }));
            }} />)}
            <Button variant="contained" disabled={guidebook.busy || !verified || loading} onClick={() => guidebookController.save(guidebook.draft)}>Save guidebook draft</Button>
            {guidebook.exists && <Button color="error" variant="outlined" disabled={guidebook.busy || !verified || loading} onClick={() => {
              if (window.confirm('Permanently discard this private guidebook draft? This permanently removes the saved draft and cannot be undone. Unsaved edits will also be lost.')) guidebookController.discard();
            }}>Discard guidebook draft</Button>}
          </Stack> : <Button disabled={guidebook.busy} onClick={() => guidebookController.load()}>Retry loading guidebook draft</Button>}
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Property time zone</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Use an IANA zone (for example, America/New_York). This applies to all short-stay units at this property.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="IANA time zone" value={timeZoneId} onChange={(e) => setTimeZoneId(e.target.value)} fullWidth placeholder="America/New_York" />
            <Button variant="contained" disabled={disabled || !timeZoneId.trim()} onClick={() => action(async () => {
              await shortStayAPI.saveTimeZone(propertyId, timeZoneId.trim());
              await refreshSetup();
            }, 'Property time zone saved.')}>Save time zone</Button>
          </Stack>
        </Paper>
        {start && end && <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Listing draft</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Private owner draft; this does not create a public lease listing or enable bookings.</Typography>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Public listing copy</Typography>
            <Typography color="text.secondary">Publicly visible to guests if this listing is published. Do not include access codes or private addresses. Plain text only.</Typography>
            {field('publicTitle', 'Public title', { inputProps: { maxLength: 100 }, helperText: `${draft.publicTitle?.length ?? 0}/100 characters` })}
            {field('publicSummary', 'Public summary', { multiline: true, minRows: 3, inputProps: { maxLength: 1200 }, helperText: `${draft.publicSummary?.length ?? 0}/1200 characters` })}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {field('nightlyBasePrice', 'Base nightly price', { type: 'number', inputProps: { min: 0.01, step: 0.01 } })}
              {field('minimumNights', 'Minimum nights', { type: 'number', inputProps: { min: 1, step: 1 } })}
              {field('capacity', 'Sleeping capacity', { type: 'number', inputProps: { min: 1, step: 1 } })}
              {field('cleaningFee', 'Cleaning fee', { type: 'number', inputProps: { min: 0, step: 0.01 } })}
            </Stack>
            <Divider />
            <Typography variant="subtitle1">Nightly pricing and stay discounts</Typography>
            <Typography color="text.secondary">Price priority: a date override wins over the Friday and Saturday weekend rate, which wins over the base nightly price. Blank weekend rate removes it. Stays of 7 or more nights receive the weekly discount; at 28 or more nights, a nonzero monthly discount takes precedence. Enter 0% to disable either discount. Discounts are calculated by the server on the nightly subtotal, not the cleaning fee.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {field('weekendNightlyRate', 'Weekend nightly rate', { type: 'number', inputProps: { min: 0.01, max: 999999.99, step: 0.01 }, helperText: 'Optional; clear and save to use the base rate on Fridays and Saturdays.' })}
              {field('weeklyDiscountPercent', 'Weekly discount (%)', { type: 'number', inputProps: { min: 0, max: 99.99, step: 0.01 } })}
              {field('monthlyDiscountPercent', 'Monthly discount (%)', { type: 'number', inputProps: { min: 0, max: 99.99, step: 0.01 } })}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {field('checkInTime', 'Check-in time', { type: 'time', InputLabelProps: { shrink: true } })}
              {field('checkOutTime', 'Check-out time', { type: 'time', InputLabelProps: { shrink: true } })}
            </Stack>
            {field('houseRules', 'House rules', { multiline: true, minRows: 2, inputProps: { maxLength: 4000 } })}
            {field('amenities', 'Amenities', { multiline: true, minRows: 2, inputProps: { maxLength: 4000 } })}
            {field('cancellationPolicy', 'Cancellation policy', { multiline: true, minRows: 2, inputProps: { maxLength: 2000 } })}
            <Divider />
            <Typography variant="subtitle1">Lodging tax configuration</Typography>
            <Typography color="text.secondary">Enter the rate you have determined applies to this listing. Leave blank if not configured; 0% must be entered explicitly if applicable. Property Peace does not determine your applicable tax rate or collect or remit lodging taxes for you; any estimated tax is not a tax payment.</Typography>
            {savedTax?.lodgingTaxRatePercent != null ? <Alert severity="info">
              Saved owner/manager-provided rate: {savedTax.lodgingTaxRatePercent}% · Attested {savedTax.taxPolicyAttestedAtUtc ? new Date(savedTax.taxPolicyAttestedAtUtc).toLocaleString() : 'timestamp unavailable'} by user ID {savedTax.taxPolicyAttestedByUserId ?? 'unavailable'}. This is an owner/manager attestation, not a Property Peace tax determination.
            </Alert> : <Alert severity="warning">No lodging tax rate or attestation saved. Bookings may be blocked until configured.</Alert>}
            {field('lodgingTaxRatePercent', 'Lodging tax rate (%)', { type: 'number', inputProps: { min: 0, max: 100, step: 0.0001 }, helperText: 'Owner/manager-provided percentage; blank means unset, not 0%.' })}
            <FormControlLabel control={<Checkbox checked={taxAttested} disabled={disabled} onChange={(e) => setTaxAttested(e.target.checked)} />} label="I confirm that I am responsible as the owner/manager for determining the correct lodging tax rate and calculating and remitting applicable lodging taxes." />
            <Typography variant="body2" color="text.secondary">Check this box each time you save a rate or correct it. Removing the rate clears the attestation; bookings may be blocked until a rate is set again.</Typography>
            <Button variant="contained" disabled={disabled || !timeZoneId} onClick={() => {
              if (savedTax?.lodgingTaxRatePercent != null && String(draft.lodgingTaxRatePercent ?? '').trim() === '' &&
                  !window.confirm('Clear the saved lodging tax rate and attestation? Bookings may be blocked until a rate is set and attested again.')) return;
              action(async () => {
                const saved = await shortStayAPI.saveListing(unitId, listingPayload(draft, taxAttested));
                if (loader.isActive()) applySavedListing(saved);
              }, 'Draft saved.', true);
            }}>Save draft</Button>
            {savedTax?.lodgingTaxRatePercent != null && <Button color="error" variant="outlined" disabled={disabled || !timeZoneId} onClick={() => {
              if (!window.confirm('Clear the saved lodging tax rate and attestation? Bookings may be blocked until you set and attest a rate again. This saves the other currently edited listing fields as well.')) return;
              action(async () => {
                const saved = await shortStayAPI.saveListing(unitId, listingPayload({ ...draft, lodgingTaxRatePercent: '' }, false));
                if (loader.isActive()) applySavedListing(saved);
              }, 'Lodging tax rate and attestation cleared.', true);
            }}>Clear saved tax configuration</Button>}
          </Stack>
        </Paper>}
        {listingExists && <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Listing photos</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Private owner draft photos. Signed image links expire; refresh to get new links. Up to 20 photos, 5 per upload, PNG/JPEG only, 5 MB each.</Typography>
          {photoError && <Alert severity="error" sx={{ mb: 2 }}>{photoError}</Alert>}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <input ref={photoInput} aria-label="Choose listing photos" type="file" accept="image/png,image/jpeg" multiple disabled={disabled || photoLoading || photos.length >= 20} onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setSelectedPhotos(files);
                try { validatePhotoSelection(files, photos.length); setPhotoError(''); }
                catch (err) { setPhotoError(setupError(err)); }
              }} />
              <Button variant="contained" disabled={disabled || photoLoading || !selectedPhotos.length || photos.length >= 20} onClick={() => photoAction(async () => {
                await gallery.upload(selectedPhotos);
                setSelectedPhotos([]);
                if (photoInput.current) photoInput.current.value = '';
              }, 'Photos uploaded.')}>Upload photos</Button>
              <Button variant="outlined" disabled={disabled || photoLoading} onClick={() => gallery.load(true)}>Refresh photos</Button>
            </Stack>
            {photoLoading && <CircularProgress size={24} aria-label="Loading listing photos" />}
            {!photoLoading && photos.length === 0 && <Typography color="text.secondary">No listing photos yet.</Typography>}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 2 }}>
              {[...photos].sort((a, b) => a.displayOrder - b.displayOrder).map((photo) => <Box key={photo.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Box component="img" src={photo.url} alt={photo.isCoverPhoto ? 'Listing cover photo' : `Listing photo ${photo.displayOrder}`} referrerPolicy="no-referrer" sx={{ width: '100%', height: 150, objectFit: 'cover' }} />
                <Stack spacing={1} sx={{ p: 1 }}>
                  <Typography variant="body2">{photo.isCoverPhoto ? 'Cover photo' : `Photo ${photo.displayOrder}`}</Typography>
                  {!photo.isCoverPhoto && <Button disabled={disabled || photoLoading} onClick={() => photoAction(() => gallery.cover(photo.id), 'Cover photo updated.')}>Make cover</Button>}
                  <Button color="error" disabled={disabled || photoLoading} onClick={() => photoAction(() => gallery.remove(photo.id), 'Photo deleted.')}>Delete photo</Button>
                </Stack>
              </Box>)}
            </Box>
          </Stack>
        </Paper>}
        {start && end && <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Airbnb calendar import</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            In Airbnb: Calendar → Availability → Connect calendars → Connect to another website. Copy the HTTPS export URL and paste it here. Imported dates are read-only; this is not a booking channel or a live two-way sync.
          </Typography>
          {airbnb.error && <Alert severity="error" sx={{ mb: 2 }}>{airbnb.error}</Alert>}
          {airbnb.notice && <Alert severity="success" sx={{ mb: 2 }}>{airbnb.notice}</Alert>}
          {airbnb.loading ? <CircularProgress size={24} aria-label="Loading Airbnb status" /> : <Stack spacing={2}>
            <Typography>Connection: {airbnb.status?.enabled ? 'Connected' : 'Not connected'} · Health: {airbnb.status?.health?.replaceAll('_', ' ') || 'Unknown'}</Typography>
            {airbnb.status?.enabled && <>
              <Typography variant="body2">Last attempted: {formatAirbnbInstant(airbnb.status.lastAttemptAtUtc, airbnb.status.timeZoneId || timeZoneId)}</Typography>
              <Typography variant="body2">Last successful: {formatAirbnbInstant(airbnb.status.lastSuccessAtUtc, airbnb.status.timeZoneId || timeZoneId)}</Typography>
              {airbnb.status.nextAttemptAtUtc && <Typography variant="body2">Next attempt: {formatAirbnbInstant(airbnb.status.nextAttemptAtUtc, airbnb.status.timeZoneId || timeZoneId)}</Typography>}
              {airbnb.status.health === 'stale' || airbnb.status.health === 'retrying' ? <Alert severity="warning">Imported availability may be out of date. Check Airbnb directly before relying on these dates.</Alert> : null}
            </>}
            <TextField inputRef={airbnbInput} label="Airbnb HTTPS iCal export URL" type="url" autoComplete="off" fullWidth disabled={disabled || airbnb.busy} helperText={airbnb.status?.enabled ? 'Paste a new export URL to replace this connection. The existing URL is never displayed.' : 'The export URL is a secret; keep it private.'} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="contained" disabled={disabled || airbnb.busy || airbnb.loading} onClick={() => {
                const input = airbnbInput.current;
                const url = input?.value.trim();
                if (!url) { setAirbnb((current) => ({ ...current, error: 'Enter an Airbnb HTTPS export URL.' })); return; }
                airbnbAction(async () => {
                  const saved = await airbnbController.connect(url);
                  if (saved && input) input.value = '';
                  return saved;
                }, true);
              }}>{airbnb.status?.enabled ? 'Replace Airbnb calendar' : 'Connect Airbnb calendar'}</Button>
              <Button variant="outlined" disabled={disabled || airbnb.busy || airbnb.loading || !airbnb.status?.enabled} onClick={() => airbnbAction(() => airbnbController.refresh(), true)}>Queue refresh</Button>
              <Button color="error" disabled={disabled || airbnb.busy || airbnb.loading || !airbnb.status?.enabled} onClick={() => {
                if (window.confirm('Disconnect Airbnb calendar? This clears all imported dates for this unit. Manual blocks remain.'))
                  airbnbAction(() => airbnbController.disconnect(), true);
              }}>Disconnect (clears imported dates)</Button>
              <Button disabled={disabled || airbnb.busy || airbnb.loading} onClick={() => { airbnbController.load(); refreshInventory(start, end); }}>Reload status</Button>
            </Stack>
          </Stack>}
        </Paper>}
        {start && end && <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Manual availability and nightly rates</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Dates are property-local yyyy-MM-dd. End dates are exclusive (checkout day is not blocked). Blocks and overrides are owner edits, not reservations.</Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="View from" type="date" InputLabelProps={{ shrink: true }} value={start} onChange={(e) => setStart(e.target.value)} fullWidth />
              <TextField label="View through (exclusive)" type="date" InputLabelProps={{ shrink: true }} value={end} onChange={(e) => setEnd(e.target.value)} fullWidth />
              <Button variant="outlined" disabled={disabled || calendarLoading || !timeZoneId} onClick={() => { refreshCalendar(start, end); refreshInventory(start, end); }}>Refresh calendar</Button>
            </Stack>
            {calendarLoading && <CircularProgress size={24} aria-label="Loading calendar" />}
            {calendarError && <Alert severity="error">{calendarError}</Alert>}
            {calendar && <Typography variant="body2">Time zone: {calendar.timeZoneId}. Showing {calendar.startDate} to {calendar.endDate} (exclusive).</Typography>}
            <Divider />
            <Typography variant="subtitle1">Block nights</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First blocked night" type="date" InputLabelProps={{ shrink: true }} value={blockStart} onChange={(e) => setBlockStart(e.target.value)} fullWidth />
              <TextField label="End (exclusive)" type="date" InputLabelProps={{ shrink: true }} value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} fullWidth />
              <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth />
            </Stack>
            <Button variant="outlined" disabled={disabled || !timeZoneId} onClick={() => action(async () => {
              await shortStayAPI.addBlock(unitId, blockPayload(blockStart, blockEnd, reason));
              setReason('');
            }, 'Nights blocked.', true)}>Add block</Button>
            {calendar?.blocks?.length === 0 && <Typography color="text.secondary">No blocks in this window.</Typography>}
            {calendar?.blocks?.map((block) => <Stack key={block.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography>{block.startDate} → {block.endDate} (exclusive) · {block.source === 'Airbnb' ? 'Airbnb imported · Read-only' : `${block.reason || 'No reason'} · ${block.source}`}</Typography>
              {airbnbBlockIsManual(block) && <Button color="error" disabled={disabled} onClick={() => action(() => shortStayAPI.removeBlock(unitId, block.id), 'Block removed.', true)}>Remove</Button>}
            </Stack>)}
            <Divider />
            <Typography variant="subtitle1">Custom rate for a date range</Typography>
            <Typography color="text.secondary">Set the same custom nightly rate for every night in this range (up to 366 nights). The first date is included; the end date is exclusive (checkout day is not priced). Existing overrides on those dates will be replaced. To undo one night, remove its override below.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First priced night" type="date" InputLabelProps={{ shrink: true }} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} fullWidth />
              <TextField label="End (exclusive)" type="date" InputLabelProps={{ shrink: true }} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} fullWidth />
              <TextField label="Custom nightly rate" type="number" inputProps={{ min: 0.01, max: 999999.99, step: 0.01 }} value={rangeRate} onChange={(e) => setRangeRate(e.target.value)} fullWidth />
            </Stack>
            <Button variant="outlined" disabled={disabled || !timeZoneId} onClick={() => action(() => shortStayAPI.saveRateRange(unitId, rangeRatePayload(rangeStart, rangeEnd, rangeRate)), 'Date-range overrides saved.', true)}>Save range rates</Button>
            <Divider />
            <Typography variant="subtitle1">Override one night</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Night" type="date" InputLabelProps={{ shrink: true }} value={rateDate} onChange={(e) => setRateDate(e.target.value)} fullWidth />
              <TextField label="Override nightly rate" type="number" inputProps={{ min: 0.01, step: 0.01 }} value={rate} onChange={(e) => setRate(e.target.value)} fullWidth />
              <Button variant="outlined" disabled={disabled || !timeZoneId} onClick={() => action(() => shortStayAPI.saveRate(unitId, rateDate, ratePayload(rateDate, rate)), 'Nightly override saved.', true)}>Save override</Button>
              <Button color="error" disabled={disabled || !isLocalDate(rateDate)} onClick={() => action(() => shortStayAPI.removeRate(unitId, rateDate), 'Override removed.', true)}>Remove override</Button>
            </Stack>
            {calendar?.nights?.map((night) => <Stack key={night.date} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
              <Typography variant="body2">{night.date}: {night.effectiveRate == null ? 'No rate' : `$${night.effectiveRate}`} {night.overrideRate != null ? '(custom date override)' : '(base or weekend rate)'}</Typography>
              {night.overrideRate != null && <Button color="error" disabled={disabled} onClick={() => action(() => shortStayAPI.removeRate(unitId, night.date), 'Override removed.', true)}>Remove override for {night.date}</Button>}
            </Stack>)}
          </Stack>
        </Paper>}
        {start && end && <InventorySnapshotCard snapshot={inventory} start={start} end={end} timeZoneId={timeZoneId} />}
      </Stack>}
    </Box>
  );
}
