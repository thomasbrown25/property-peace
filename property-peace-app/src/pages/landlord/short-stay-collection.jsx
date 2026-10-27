import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Link, Paper, Stack, Typography } from '@mui/material';
import { useOrganization } from 'contexts/OrganizationContext';
import { shortStayAPI } from 'api/shortStay';
import { canSaveCollection, collectionPolicyUrl, collectionStatus, draftPropertyIds, stripeIdentityUrl } from './short-stay-collection';

export default function ShortStayCollection({ propertyId }) {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  if (orgLoading) return <CircularProgress aria-label="Loading organization" />;
  if (!currentOrganization?.id) return <Alert severity="warning">Select an organization to view collection applications.</Alert>;
  return <CollectionForOrganization key={`${currentOrganization.id}/${propertyId}`} propertyId={propertyId} organizationName={currentOrganization.name} />;
}

function CollectionForOrganization({ propertyId, organizationName }) {
  const [requirements, setRequirements] = useState(null);
  const [applications, setApplications] = useState(null);
  const [authority, setAuthority] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const request = useRef(0);
  const running = useRef(false);
  const identityLaunching = useRef(false);
  const load = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setRequirements(null);
    setApplications(null);
    setError('');
    try {
      const [policy, apps] = await Promise.all([shortStayAPI.getCollectionRequirements(), shortStayAPI.getCollectionApplications()]);
      if (mounted.current && sequence === request.current) {
        if (!Array.isArray(apps) || !policy || typeof policy !== 'object') throw new Error('Invalid response');
        setRequirements(policy);
        setApplications(apps);
      }
    } catch {
      if (mounted.current && sequence === request.current) setError('Collection application information is unavailable. Retry before continuing.');
    } finally {
      if (mounted.current && sequence === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    load();
    // Recheck on return from Stripe rather than trusting redirect parameters or browser state.
    const onFocus = () => { if (!running.current) { identityLaunching.current = false; load(); } };
    window.addEventListener('focus', onFocus);
    return () => { mounted.current = false; ++request.current; window.removeEventListener('focus', onFocus); };
  }, [load]);
  const run = async (operation, success) => {
    if (running.current || loading) return;
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      if (mounted.current) {
        setAuthority(false);
        setConsent(false);
        setNotice(success);
        await load();
      }
    } catch {
      if (mounted.current) {
        setRequirements(null);
        setApplications(null);
        setError('Action could not be completed. Refresh the requirements and status before trying again.');
      }
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  };

  const policyUrl = collectionPolicyUrl(requirements);
  const app = applications?.length === 1 ? applications[0] : null;
  const ids = draftPropertyIds(applications, propertyId);
  const canEdit = !loading && !busy && canSaveCollection(requirements, authority, consent, ids);
  const currentIncluded = app?.propertyIds?.includes(Number(propertyId));
  const canSubmit = canEdit && app?.status === 'draft' && currentIncluded &&
    app.authorityAttested === true && app.feePolicyConsentVersion === requirements.feePolicyConsentVersion;
  const canIdentity = !loading && !busy && policyUrl && app && currentIncluded &&
    (app.status === 'submitted' || app.status === 'identityPending');
  const canRefreshIdentity = !loading && !busy && policyUrl && app?.status === 'identityPending' && currentIncluded;
  return <Paper sx={{ p: 3 }}>
    <Stack spacing={2}>
      <Typography variant="h6">Apply to collect short-stay payments</Typography>
      <Alert severity="info">Owner/manager application for {organizationName || 'the selected organization'}. One property at a time in this screen. An existing draft’s other selected properties remain included; saving never replaces them. This is not guest checkout or payout approval.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Button variant="outlined" disabled={busy || loading} onClick={load}>Refresh requirements and application status</Button>
      {loading && <CircularProgress aria-label="Loading collection application" size={24} />}
      {!loading && applications && <>
        {app ? <>
          <Typography>Application status: {collectionStatus(app.status)}</Typography>
          <Typography variant="body2">Selected properties: {Array.isArray(app.propertyIds) ? app.propertyIds.join(', ') : 'Unavailable'}. {currentIncluded ? 'This property is included.' : 'This property is not included.'}</Typography>
          {app.status !== 'draft' && <Alert severity="info">Submitted applications are read-only here. Identity and review status come from the server; this screen does not enable bookings or confirm payouts.</Alert>}
        </> : <Typography>No collection application saved for this account in the selected organization.</Typography>}
        {requirements?.reasonCode && <Alert severity="warning">Collection applications are unavailable ({requirements.reasonCode === 'fee_policy_unavailable' ? 'published fee policy unavailable' : requirements.reasonCode === 'identity_disabled' ? 'identity verification unavailable' : 'requirements unavailable'}). Contact support or retry later.</Alert>}
        {!policyUrl && <Alert severity="warning">The approved fee policy or hosted identity service is unavailable. Saving, submitting and identity verification are disabled until valid requirements load.</Alert>}
        {policyUrl && <>
          <Typography>Fee policy version: {requirements.feePolicyConsentVersion}</Typography>
          <Link href={policyUrl} target="_blank" rel="noopener noreferrer">Read the published short-stay collection fee policy</Link>
          {ids && <>
            <Typography variant="body2">{currentIncluded ? 'Save again only if you need to renew consent.' : 'Saving adds this property to your existing draft without removing its other properties.'}</Typography>
            <FormControlLabel control={<Checkbox checked={authority} disabled={busy} onChange={event => setAuthority(event.target.checked)} />} label="I attest that I am authorized to apply to collect payments for the selected properties." />
            <FormControlLabel control={<Checkbox checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />} label={`I have read and agree to the published fee policy, version ${requirements.feePolicyConsentVersion}.`} />
            <Button variant="contained" disabled={!canEdit} onClick={() => run(() => shortStayAPI.saveCollectionDraft({ propertyIds: ids, authorityAttested: true, feePolicyConsentVersion: requirements.feePolicyConsentVersion }), 'Draft saved. Review status before submitting.')}>Save application draft</Button>
            {app?.status === 'draft' && <Button variant="outlined" disabled={!canSubmit} onClick={() => run(() => shortStayAPI.submitCollection(), 'Application submitted. Identity verification is the next step.')}>Submit application</Button>}
          </>}
          {canIdentity && <Button variant="contained" disabled={busy} onClick={() => {
            if (identityLaunching.current || running.current || loading) return;
            identityLaunching.current = true; // Synchronous: state-driven disabled cannot stop a second click in this render.
            void run(async () => {
              let launched = false;
              try {
                const result = await shortStayAPI.startCollectionIdentity(app.id);
                if (!mounted.current) return;
                if (!result?.url) return; // Already processing or verified: reload server status.
                const safeUrl = stripeIdentityUrl(result.url);
                if (!safeUrl) throw new Error('Untrusted identity destination');
                window.location.assign(safeUrl);
                launched = true;
              } finally {
                // A successful single-use launch stays locked until navigation or a focus recheck.
                if (!launched) identityLaunching.current = false;
              }
            }, 'Identity status refreshed from the server.');
          }}>Continue with Stripe-hosted identity</Button>}
          {canRefreshIdentity && <Button variant="outlined" disabled={busy} onClick={() => run(() => shortStayAPI.refreshCollectionIdentity(app.id), 'Identity status refreshed from the server.')}>Check identity status with Stripe</Button>}
          {app?.status === 'identityPending' && <Typography variant="body2">Verification is not yet confirmed. Check status after returning from Stripe; do not enter identity documents or bank details here.</Typography>}
        </>}
      </>}
    </Stack>
  </Paper>;
}
