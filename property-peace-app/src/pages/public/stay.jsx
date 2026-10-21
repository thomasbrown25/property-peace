import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Container, Divider, Stack, TextField, Typography } from '@mui/material';
import { getPublicStay, getPublicStayQuote } from 'api/publicStay';
import { moneyFromCents, publicStayError, validateStay } from './stay-contract.mjs';
import { validReservationCode, stayTuple } from './stay-checkout-state.mjs';
import StayCheckout from './StayCheckout.jsx';

const ink = '#061e35';
const edge = '#d8dfda';
const card = { border: `1px solid ${edge}`, borderRadius: '4px', bgcolor: '#fff', p: { xs: 2.5, md: 4 } };
const label = { color: '#526457', textTransform: 'uppercase', letterSpacing: '0.13em', fontWeight: 700, fontSize: 12 };

export default function PublicStayPage() {
  const { unitId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const reservationCode = searchParams.get('reservation');
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dates, setDates] = useState({ checkIn: '', checkOut: '', guests: '1' });
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const quoteController = useRef(null);
  const quoteGeneration = useRef(0);
  const previousUnit = useRef(unitId);

  useEffect(() => {
    if (previousUnit.current !== unitId) {
      previousUnit.current = unitId;
      if (reservationCode) setSearchParams({}, { replace: true });
    }
  }, [unitId, reservationCode, setSearchParams]);

  useEffect(() => {
    // Stripe may append its own payment_intent_client_secret on a redirect. Drop it immediately;
    // only the opaque reservation code belongs in this app's navigable URL.
    if (searchParams.has('payment_intent_client_secret') || searchParams.has('payment_intent') || searchParams.has('redirect_status'))
      setSearchParams(validReservationCode(reservationCode) ? { reservation: reservationCode } : {}, { replace: true });
  }, [searchParams, reservationCode, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    quoteGeneration.current += 1;
    quoteController.current?.abort();
    setListing(null);
    setQuote(null);
    setLoadError('');
    setQuoteError('');
    setLoading(true);
    if (!/^[1-9]\d*$/.test(unitId || '')) {
      setLoadError('This stay is not available.');
      setLoading(false);
      return () => controller.abort();
    }
    getPublicStay(unitId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          if (data?.unitId !== Number(unitId) || typeof data?.title !== 'string' || !Number.isInteger(data?.maxGuests) || !Number.isInteger(data?.minimumNights)) {
            setLoadError('This stay is not available.');
          } else setListing(data);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(publicStayError(error, 'Unable to load this stay. Please try again.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [unitId]);

  const updateDate = (field) => (event) => {
    quoteGeneration.current += 1;
    quoteController.current?.abort();
    setQuoting(false);
    setQuote(null);
    setQuoteError('');
    if (reservationCode) setSearchParams({}, { replace: true });
    setDates((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const estimate = async (event) => {
    event.preventDefault();
    if (!listing || quoting) return;
    const invalid = validateStay(dates, listing);
    if (invalid) {
      setQuoteError(invalid);
      return;
    }
    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    const generation = ++quoteGeneration.current;
    setQuote(null);
    setQuoteError('');
    setQuoting(true);
    try {
      const result = await getPublicStayQuote(unitId, dates, controller.signal);
      if (!controller.signal.aborted && generation === quoteGeneration.current) {
        if (result?.unitId !== Number(unitId) || result?.checkIn !== dates.checkIn || result?.checkOut !== dates.checkOut) {
          setQuoteError('The estimate did not match your selected stay. Please try again.');
        } else setQuote(result);
      }
    } catch (error) {
      if (!controller.signal.aborted && generation === quoteGeneration.current) {
        setQuoteError(publicStayError(error, 'Unable to estimate these dates. Please try again.'));
      }
    } finally {
      if (generation === quoteGeneration.current) setQuoting(false);
    }
  };

  const location = [listing?.city, listing?.state].filter(Boolean).join(', ');
  const canContinue = listing?.bookingRequestsEnabled === true && quote?.status === 'preflight_available';
  const estimated = moneyFromCents(quote?.estimatedTotalCents);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f6f2', color: ink, pb: 10 }}>
      <Box component="header" sx={{ bgcolor: ink, color: '#fff', borderBottom: '4px solid #b8aa72' }}>
        <Container maxWidth="lg" sx={{ py: 2.5 }}>
          <Typography sx={{ letterSpacing: '0.12em', fontWeight: 800, fontSize: 15 }}>PROPERTY PEACE <Box component="span" sx={{ fontWeight: 400, opacity: 0.8 }}>/ STAYS</Box></Typography>
        </Container>
      </Box>
      <Container component="main" maxWidth="lg" sx={{ pt: { xs: 5, md: 8 } }}>
        {loading && <Stack alignItems="center" gap={2} role="status"><CircularProgress /><Typography>Loading stay…</Typography></Stack>}
        {!loading && loadError && <Box sx={card} role="alert"><Typography variant="h5">Stay unavailable</Typography><Typography sx={{ mt: 1 }}>{loadError}</Typography></Box>}
        {!loading && loadError && /^[1-9]\d*$/.test(unitId || '') && validReservationCode(reservationCode) && <Box sx={{ ...card, mt: 3 }}><StayCheckout key={unitId} unitId={unitId} dates={dates} reservationCode={reservationCode} onReservationChange={() => {}} /></Box>}
        {!loading && !loadError && listing && <>
          <Box sx={{ mb: { xs: 4, md: 6 }, maxWidth: 780 }}>
            <Typography sx={label}>Short stay · {location || 'Location not listed'}</Typography>
            <Typography component="h1" sx={{ mt: 1.5, fontFamily: 'Georgia, serif', fontSize: { xs: 37, md: 56 }, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.1, overflowWrap: 'anywhere' }}>{listing.title}</Typography>
            <Typography sx={{ mt: 2, color: '#50616a', fontSize: 16 }}>Up to {listing.maxGuests} guests · {listing.minimumNights}-night minimum</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(320px, 390px)' }, gap: 3, alignItems: 'start' }}>
            <Stack spacing={3}>
              <Box sx={{ ...card, borderTop: '4px solid #b8aa72' }}>
                <Typography sx={label}>About this stay</Typography>
                {listing.description ? <Typography sx={{ mt: 2, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{listing.description}</Typography> : <Typography sx={{ mt: 2, color: '#586b76' }}>The host has not added a description yet.</Typography>}
              </Box>
              <Box sx={card}>
                <Typography sx={label}>Pricing at a glance</Typography>
                <Typography sx={{ mt: 2, fontFamily: 'Georgia, serif', fontSize: 30 }}>{typeof listing.nightlyBasePrice === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listing.nightlyBasePrice) : 'Price unavailable'} <Box component="span" sx={{ fontFamily: 'inherit', fontSize: 16, color: '#586b76' }}>/ night base rate</Box></Typography>
                <Typography sx={{ mt: 1, color: '#586b76' }}>Nightly rates can vary. Select dates for a server-calculated estimate including cleaning and applicable tax.</Typography>
              </Box>
            </Stack>
            <Box sx={{ ...card, borderTop: '4px solid #2d6b54' }}>
              <Typography sx={label}>Plan your stay</Typography>
              <Typography variant="h5" sx={{ mt: 1, color: ink, fontWeight: 700 }}>Check dates & estimate</Typography>
              <Typography sx={{ my: 2, color: '#586b76', fontSize: 14 }}>Choose property-local calendar dates. Check-in must be after today in the property’s time zone. Estimates are not reservations.</Typography>
              <Box component="form" onSubmit={estimate}>
                <Stack spacing={2}>
                  <TextField label="Check-in" type="date" value={dates.checkIn} onChange={updateDate('checkIn')} InputLabelProps={{ shrink: true }} inputProps={{ 'aria-label': 'Check-in date' }} fullWidth required />
                  <TextField label="Check-out" type="date" value={dates.checkOut} onChange={updateDate('checkOut')} InputLabelProps={{ shrink: true }} inputProps={{ 'aria-label': 'Check-out date' }} fullWidth required />
                  <TextField label="Guests" type="number" value={dates.guests} onChange={updateDate('guests')} inputProps={{ min: 1, max: listing.maxGuests, step: 1 }} fullWidth required />
                  <Button type="submit" variant="contained" disabled={quoting} sx={{ bgcolor: ink, borderRadius: 1, py: 1.4, '&:hover': { bgcolor: '#174062' } }}>{quoting ? 'Checking dates…' : 'Get date estimate'}</Button>
                </Stack>
              </Box>
              {quoteError && <Typography role="alert" sx={{ mt: 2, color: '#a23328' }}>{quoteError}</Typography>}
              {quote && <Box aria-live="polite" sx={{ mt: 3, pt: 2, borderTop: `1px solid ${edge}` }}>
                <Typography sx={{ fontWeight: 700 }}>{quote.status === 'preflight_available' ? 'Preflight check passed' : 'Currently unavailable for these dates'}</Typography>
                {quote.status !== 'preflight_available' && <Typography sx={{ mt: 1, color: '#705b32' }}>A stay cannot be requested for these dates. Try another range.</Typography>}
                {moneyFromCents(quote.discountCents > 0 ? quote.grossNightlySubtotalCents : quote.nightlySubtotalCents) && <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}><Typography>Nightly subtotal</Typography><Typography>{quote.discountCents > 0 ? moneyFromCents(quote.grossNightlySubtotalCents) : moneyFromCents(quote.nightlySubtotalCents)}</Typography></Stack>}
                {Number.isSafeInteger(quote.discountCents) && quote.discountCents > 0 && moneyFromCents(quote.grossNightlySubtotalCents) && <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography>{quote.discountType ? `${quote.discountType} stay discount` : 'Stay discount'}</Typography><Typography>−{moneyFromCents(quote.discountCents)}</Typography></Stack>}
                {moneyFromCents(quote.cleaningFeeCents) && <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography>Cleaning fee</Typography><Typography>{moneyFromCents(quote.cleaningFeeCents)}</Typography></Stack>}
                {moneyFromCents(quote.taxCents) && <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography>Tax</Typography><Typography>{moneyFromCents(quote.taxCents)}</Typography></Stack>}
                {estimated && <><Divider sx={{ my: 2 }} /><Stack direction="row" justifyContent="space-between" sx={{ fontWeight: 700 }}><Typography sx={{ fontWeight: 700 }}>Estimated total</Typography><Typography sx={{ fontWeight: 700 }}>{estimated}</Typography></Stack></>}
                <Typography sx={{ mt: 2, fontSize: 13, color: '#586b76' }}>{quote.availabilityNotice || 'Advisory estimate only; availability is not guaranteed and this is not a payable quote.'}</Typography>
              </Box>}
              <Divider sx={{ my: 3 }} />
              <Typography sx={{ color: '#586b76', fontSize: 14 }}>{listing.availabilityNotice || 'Calendar information is advisory and cannot guarantee availability.'}</Typography>
              {reservationCode && !validReservationCode(reservationCode) && <Typography role="alert" sx={{ mt: 2, color: '#a23328' }}>Invalid reservation link.</Typography>}
              {(canContinue || validReservationCode(reservationCode)) && <StayCheckout key={stayTuple(unitId, dates)} unitId={unitId} dates={dates} allowPayment={listing.bookingRequestsEnabled === true} reservationCode={validReservationCode(reservationCode) ? reservationCode : null} onReservationChange={(code) => setSearchParams({ reservation: code }, { replace: true })} />}
              {!canContinue && !validReservationCode(reservationCode) && <Typography sx={{ mt: 2, color: '#586b76', fontSize: 13 }}>Booking and payment are not available for these dates. No charge has been made.</Typography>}
            </Box>
          </Box>
        </>}
      </Container>
    </Box>
  );
}
