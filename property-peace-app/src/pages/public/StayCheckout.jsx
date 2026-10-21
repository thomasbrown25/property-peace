import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { createStayHold, getStayHold, startStayPayment } from 'api/stayCheckout';
import { moneyFromCents } from './stay-contract.mjs';
import { canStartPayment, getOrCreateHoldKey, guestCheckoutError, holdKeyStorageName, receiptMatches, shouldPollStatus, statusMatches, stayTuple, validReservationCode } from './stay-checkout-state.mjs';

const warningColor = '#8b402f';
const accent = '#2d6b54';
const moneyRow = (label, cents) => moneyFromCents(cents) && <Stack key={label} direction="row" justifyContent="space-between" gap={2}><Typography>{label}</Typography><Typography>{moneyFromCents(cents)}</Typography></Stack>;
const readableExpiry = (value) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Unknown';

function PaymentForm({ code, unitId, clientSecret, onSubmitted }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setError('');
    try {
      const latest = await getStayHold(code);
      if (!statusMatches(latest, code) || !canStartPayment(latest.status, latest.holdExpiresAt)) {
        setError('This reservation is no longer payable. Refresh its status before trying again.');
        await onSubmitted();
        return;
      }
      const validation = await elements.submit();
      if (validation.error) { setError(validation.error.message || 'Check your payment details.'); return; }
      // Same-origin route only; never put the client secret, personal data, or a payment ID in our URL.
      const returnUrl = new URL(`/stay/${encodeURIComponent(unitId)}`, window.location.origin);
      returnUrl.searchParams.set('reservation', code);
      const result = await stripe.confirmPayment({ elements, clientSecret, redirect: 'if_required', confirmParams: { return_url: returnUrl.href } });
      if (result.error) setError(result.error.message || 'Payment could not be submitted. Check the reservation status before retrying.');
      await onSubmitted(); // Stripe's client result is NEVER confirmation of a reservation.
    } catch {
      setError('Could not confirm payment. Check your reservation status before retrying.');
      await onSubmitted();
    } finally { setPaying(false); }
  };
  return <Box component="form" onSubmit={submit} sx={{ mt: 3 }}>
    <PaymentElement />
    {error && <Typography role="alert" sx={{ mt: 2, color: warningColor }}>{error}</Typography>}
    <Button type="submit" fullWidth variant="contained" disabled={!stripe || !elements || paying} sx={{ mt: 3, bgcolor: accent, py: 1.4 }}>{paying ? 'Submitting securely…' : 'Submit payment'}</Button>
    <Typography sx={{ mt: 1, fontSize: 13, color: '#586b76' }}>Your stay is not confirmed until the reservation status says Confirmed. Bank payments may take several business days to process.</Typography>
  </Box>;
}

export default function StayCheckout({ unitId, dates, reservationCode, onReservationChange, allowPayment = false }) {
  const [receipt, setReceipt] = useState(null);
  const [status, setStatus] = useState(null);
  const [payment, setPayment] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const active = useRef(true);
  const inFlight = useRef(false);
  const tuple = stayTuple(unitId, dates);
  const code = reservationCode || receipt?.code;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!validReservationCode(code) || inFlight.current) return;
    inFlight.current = true;
    try {
      const latest = await getStayHold(code);
      if (!active.current) return;
      if (!statusMatches(latest, code)) throw new Error('Unexpected reservation response');
      setStatus(latest);
      if (!canStartPayment(latest.status, latest.holdExpiresAt)) { setPayment(null); setStripePromise(null); }
      setError('');
    } catch (failure) {
      if (active.current) {
        setStatus(null);
        setPayment(null);
        setStripePromise(null);
        setError(guestCheckoutError(failure, 'Unable to check your reservation. Please try again.'));
      }
    } finally { inFlight.current = false; }
  }, [code]);

  useEffect(() => { if (code) { setPollCount(0); refresh(); } }, [code, refresh]);
  useEffect(() => {
    if (!code || pollCount >= 12 || (status && !shouldPollStatus(status.status))) return;
    const timer = window.setTimeout(() => { refresh(); setPollCount((count) => count + 1); }, 3000);
    return () => window.clearTimeout(timer);
  }, [code, status, pollCount, refresh]);

  const createHold = async () => {
    if (busy || receipt || reservationCode) return;
    setBusy(true); setError('');
    try {
      const key = getOrCreateHoldKey(window.sessionStorage, tuple, () => window.crypto.randomUUID());
      const result = await createStayHold(unitId, dates, key);
      if (!active.current) return;
      if (!receiptMatches(result, dates)) throw new Error('Invalid hold receipt');
      setReceipt(result);
      onReservationChange(result.code);
    } catch (failure) {
      if (active.current) {
        if (failure?.reason === 'hold_no_longer_active') window.sessionStorage.removeItem(holdKeyStorageName(tuple));
        setError(guestCheckoutError(failure, 'Could not place or recover the hold. Retry to safely recover the same request; do not start another booking yet.'));
      }
    } finally { if (active.current) setBusy(false); }
  };

  const startPayment = async () => {
    if (busy || !allowPayment || !code || !canStartPayment(status?.status, status?.holdExpiresAt)) return;
    setBusy(true); setError('');
    try {
      const latest = await getStayHold(code);
      if (!statusMatches(latest, code)) throw new Error('Invalid reservation status');
      if (active.current) setStatus(latest);
      if (!canStartPayment(latest.status, latest.holdExpiresAt)) { setError('This hold is no longer payable. Check its status.'); return; }
      const result = await startStayPayment(code);
      if (!active.current) return;
      if (!result?.clientSecret || !/^acct_[a-zA-Z0-9]+$/.test(result.connectedAccountId || '') ||
          !/^pk_(test|live)_/.test(result.publishableKey || '') || !canStartPayment('PendingPayment', result.expiresAtUtc))
        throw new Error('Invalid payment configuration');
      const connectedStripe = loadStripe(result.publishableKey, { stripeAccount: result.connectedAccountId });
      setPayment(result);
      setStripePromise(connectedStripe);
      await refresh();
    } catch (failure) {
      if (active.current) setError(guestCheckoutError(failure, 'Payment could not be started. Check your reservation status before retrying.'));
    } finally { if (active.current) setBusy(false); }
  };

  const expiry = status?.holdExpiresAt || receipt?.expiresAtUtc;
  const payable = canStartPayment(status?.status, expiry);
  const total = status?.totalCents ?? receipt?.totalCents;
  const discountCents = status?.discountCents ?? receipt?.discountCents;
  const grossNightlySubtotalCents = status?.grossNightlySubtotalCents ?? receipt?.grossNightlySubtotalCents;
  const showDiscount = Number.isSafeInteger(discountCents) && discountCents > 0 && moneyFromCents(grossNightlySubtotalCents);
  return <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #d8dfda' }} aria-live="polite">
    {!code && <>
      <Typography sx={{ fontWeight: 700 }}>Secure guest checkout</Typography>
      <Typography sx={{ mt: 1, fontSize: 13, color: '#586b76' }}>Sign in with an existing Property Peace account to place a time-limited hold. No guest signup is available on this page yet. The estimate above is advisory; your hold will show the payable total.</Typography>
      <Button onClick={createHold} disabled={busy} fullWidth variant="contained" sx={{ mt: 2, bgcolor: accent, py: 1.4 }}>{busy ? 'Placing hold…' : 'Place secure hold'}</Button>
    </>}
    {code && <>
      <Typography sx={{ color: '#526457', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, letterSpacing: '0.13em' }}>Your reservation</Typography>
      <Typography component="h2" sx={{ fontFamily: 'Georgia, serif', fontSize: 27, mt: 1 }}>{status?.status === 'Confirmed' ? 'Stay confirmed' : status?.status || 'Checking reservation…'}</Typography>
      {status?.message && <Typography sx={{ mt: 1 }}>{status.message}</Typography>}
      {receipt?.availabilityWarning && <Typography sx={{ mt: 1, fontSize: 13, color: warningColor }}>{receipt.availabilityWarning}</Typography>}
      {expiry && <Typography sx={{ mt: 1, fontSize: 13, color: '#586b76' }}>Hold expires: {readableExpiry(expiry)}</Typography>}
      {moneyFromCents(total) && <Stack spacing={1} sx={{ mt: 2, p: 2, bgcolor: '#f5f6f2' }}>
        {moneyRow('Nightly subtotal', showDiscount ? grossNightlySubtotalCents : status?.nightlySubtotalCents ?? receipt?.nightlySubtotalCents)}
        {showDiscount && <Stack direction="row" justifyContent="space-between" gap={2}><Typography>Stay discount</Typography><Typography>−{moneyFromCents(discountCents)}</Typography></Stack>}
        {moneyRow('Cleaning fee', status?.cleaningFeeCents ?? receipt?.cleaningFeeCents)}
        {moneyRow('Tax', status?.taxCents ?? receipt?.taxCents)}
        <Divider />{moneyRow('Hold total · USD', total)}
      </Stack>}
      {!status && <CircularProgress size={20} sx={{ mt: 2 }} aria-label="Checking reservation status" />}
      {allowPayment && payable && !payment && <Button fullWidth variant="contained" onClick={startPayment} disabled={busy} sx={{ mt: 2, bgcolor: accent, py: 1.4 }}>{busy ? 'Preparing payment…' : 'Continue to secure payment'}</Button>}
      {allowPayment && payable && payment && stripePromise && <Elements key={`${payment.connectedAccountId}:${payment.paymentIntentId}`} stripe={stripePromise} options={{ clientSecret: payment.clientSecret }}><PaymentForm code={code} unitId={unitId} clientSecret={payment.clientSecret} onSubmitted={refresh} /></Elements>}
      {status && shouldPollStatus(status.status) && pollCount >= 12 && <Typography sx={{ mt: 2, fontSize: 13 }}>Automatic checks paused. Refresh to see the latest server status.</Typography>}
      <Button onClick={refresh} sx={{ mt: 2 }} disabled={inFlight.current}>Refresh reservation status</Button>
    </>}
    {error && <><Typography role="alert" sx={{ mt: 2, color: warningColor }}>{error}</Typography>{/Sign in with an existing/.test(error) && <Button component="a" href="/login" sx={{ mt: 1 }}>Sign in</Button>}</>}
  </Box>;
}
