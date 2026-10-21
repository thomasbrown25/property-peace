import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import { useOrganization } from 'contexts/OrganizationContext';
import ConnectOnboardingWizard from 'sections/landlord/payments/ConnectOnboardingWizard';
import { validateConnectOnboardingContext } from 'utils/connectOnboarding';
import { connectReadiness, shortStayConnectAPI } from './short-stay-connect';

export default function ShortStayConnect({ propertyId }) {
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const { user } = useAuth();
  if (organizationLoading) return <CircularProgress aria-label="Loading organization" />;
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id;
  if (!organizationId) return <Alert severity="warning">Select an organization to set up Stripe Connect.</Alert>;
  return <ConnectForOrganization key={`${organizationId}/${user?.id ?? user?.Id}/${propertyId}`} propertyId={propertyId} user={user} />;
}

function ConnectForOrganization({ propertyId, user }) {
  const { properties, propertiesRefetch, isLoading: propertiesLoading, propertiesError } = useFetchProperties();
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preparation, setPreparation] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const live = useRef(false);
  const sequence = useRef(0);
  const running = useRef(false);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setLoaded(false);
    setStatus(null);
    setError('');
    try {
      const result = await shortStayConnectAPI.status();
      if (live.current && request === sequence.current) { setStatus(result); setLoaded(true); }
    } catch (err) {
      if (live.current && request === sequence.current) setError(err?.response?.data?.message || err.message || 'Stripe Connect status is unavailable.');
    } finally { if (live.current && request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    live.current = true;
    load();
    const onFocus = () => { if (!running.current) load(); };
    window.addEventListener('focus', onFocus);
    return () => { live.current = false; ++sequence.current; window.removeEventListener('focus', onFocus); };
  }, [load]);
  const run = async (operation) => {
    if (running.current || !loaded) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const url = await operation();
      if (live.current && typeof url === 'string') window.location.assign(url);
    } catch (err) {
      if (live.current) setError(err?.response?.data?.message || err.message || 'Stripe setup could not be completed.');
    } finally { running.current = false; if (live.current) setBusy(false); }
  };
  const start = async () => {
    if (running.current || !loaded || status?.accountId || !propertyId) return;
    running.current = true;
    setPreparing(true);
    setError('');
    try {
      const saved = await shortStayConnectAPI.preparation();
      if (live.current) { setPreparation(saved); setWizardOpen(true); }
    } catch (err) {
      if (live.current) setError(err?.response?.data?.message || err.message || 'Payout setup could not be loaded.');
    } finally { running.current = false; if (live.current) setPreparing(false); }
  };
  const create = (context) => {
    const errors = validateConnectOnboardingContext(context, properties.map((p) => p?.id ?? p?.Id).filter((id) => id != null));
    if (Object.keys(errors).length) { setError('Confirm your property authority before continuing to Stripe.'); return; }
    run(() => shortStayConnectAPI.create(context));
  };
  const readiness = connectReadiness(status);
  const demo = user?.isDemo === true || user?.IsDemo === true;
  return <Paper sx={{ p: 3 }}>
    <Stack spacing={2}>
      <Typography variant="h6">Stripe Connect for short stays</Typography>
      <Typography color="text.secondary">Set up the payout account for your selected organization before applying for optional Property Peace collection review. Stripe collects identity, tax and bank details on its hosted pages. Stripe KYC is separate from Property Peace review; neither setup nor Stripe readiness enables bookings or payouts here.</Typography>
      {demo && <Alert severity="info">Stripe setup is unavailable in demo mode.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <CircularProgress aria-label="Loading Stripe Connect status" size={24} />}
      {loaded && readiness && <>
        <Typography>Connected account: {status.accountId ? 'Created' : 'Not set up'}</Typography>
        {!status.accountId && !propertyId && <Typography variant="body2" color="text.secondary">To create a Connect account, open a property's short-stay owner setup and confirm your property authority there.</Typography>}
        {status.accountId && <>
          <Typography>Stripe KYC: {readiness.kyc}</Typography>
          <Typography>Charges: {readiness.charges}</Typography>
          <Typography>Payouts: {readiness.payouts}</Typography>
          <Typography>Card payments capability: {readiness.card}</Typography>
          <Typography variant="body2" color="text.secondary">Unavailable means Stripe could not confirm the capability; it does not mean active. Charges and payouts are provider statuses, not Property Peace permission to collect short-stay payments.</Typography>
        </>}
      </>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="outlined" disabled={loading || busy || preparing} onClick={load}>Refresh Stripe status</Button>
        {loaded && !demo && !status.accountId && <Button variant="contained" disabled={busy || preparing || !propertyId} onClick={start}>Set up Stripe Connect</Button>}
        {loaded && !demo && status.accountId && <Button variant="contained" disabled={busy} onClick={() => run(() => shortStayConnectAPI.onboard())}>Continue Stripe onboarding</Button>}
      </Stack>
      <ConnectOnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onContinue={create}
        properties={properties} propertiesLoading={propertiesLoading} propertiesError={propertiesError}
        onRetryProperties={propertiesRefetch} user={user} initialDraft={preparation} preparationLoading={preparing} loading={busy} />
    </Stack>
  </Paper>;
}
