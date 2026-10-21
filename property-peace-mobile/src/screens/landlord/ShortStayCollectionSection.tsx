import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import collectionAPI, { type CollectionApplication, type CollectionRequirements } from '../../api/shortStayCollectionAPI';
import { applicationConflict, collectionUnavailable, currentApplication, feePolicyUrl, hostedIdentityUrl, policyReady, scopeMatches } from '../../features/properties/shortStayCollection';
import { useAppTheme } from '../../theme/AppTheme';

// The server owns the organization/applicant scope. Never collect or persist identity documents,
// account numbers, or the short-lived hosted session URL on the device.
export default function ShortStayCollectionSection({ propertyId }: { propertyId: string }) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [requirements, setRequirements] = useState<CollectionRequirements | null>(null);
  const [apps, setApps] = useState<CollectionApplication[] | null>(null);
  const [authority, setAuthority] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const generation = useRef(0);
  const locked = useRef(false);
  const identityLaunching = useRef(false);
  const launchedId = useRef<number | null>(null);
  const refresh = useCallback(async (preserveError = false) => {
    const request = ++generation.current;
    // Stale policy and application state may never authorize writes while a reload is pending.
    setRequirements(null); setApps(null); setAuthority(false); setConsent(false);
    if (!preserveError) setError('');
    try {
      const [requirementsResult, appsResult] = await Promise.all([collectionAPI.requirements(), collectionAPI.applications()]);
      if (!Array.isArray(appsResult)) throw new Error('Invalid applications');
      if (alive.current && request === generation.current) { setRequirements(requirementsResult); setApps(appsResult); }
    } catch {
      if (alive.current && request === generation.current) setError('Could not load collection requirements or applications. Retry before taking action.');
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const onReturn = () => {
      if (locked.current) return;
      const id = launchedId.current;
      launchedId.current = null;
      if (id === null) { void refresh(); return; }
      locked.current = true;
      void (async () => {
        try { await collectionAPI.identityRefresh(id); }
        catch { if (alive.current) setError('Identity status could not be refreshed. Retry from the application below.'); }
        finally { if (alive.current) await refresh(true); identityLaunching.current = false; locked.current = false; }
      })();
    };
    const unsubscribe = navigation.addListener('focus', onReturn);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') onReturn(); });
    return () => { alive.current = false; ++generation.current; launchedId.current = null; unsubscribe(); listener.remove(); };
  }, [navigation, refresh]);
  const mutate = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (e) {
      if (alive.current) {
        // Only known, non-sensitive server messages are rendered. Never echo Stripe URLs or raw errors.
        const message = e instanceof Error ? e.message : (e as { message?: string })?.message;
        setError(message === 'Connect account unavailable'
          ? 'A connected payout account is not available for your user. Complete account setup before applying.'
          : message === 'Invalid property scope' || message === 'Scope or policy changed' || message === 'Application changed'
            ? 'The property scope or application changed. Reload and review it before trying again.'
            : message === 'Fee policy unavailable'
              ? 'The current fee policy is unavailable. Try again later.'
              : 'Could not complete the collection action. Reload status and try again.');
      }
    }
    finally { if (alive.current) await refresh(true); locked.current = false; if (alive.current) setBusy(false); }
  };
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={action} style={[styles.button, { backgroundColor: colors.accent }, (busy || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  const id = Number(propertyId);
  const validId = Number.isSafeInteger(id) && id > 0 && String(id) === propertyId;
  const app = apps ? currentApplication(apps) : null;
  const conflict = apps ? applicationConflict(apps) : false;
  const ready = policyReady(requirements);
  const matching = app ? scopeMatches(app, id) : true;
  const inScope = !!app && app.propertyIds.includes(id);
  const editable = !!apps && !conflict && (!app || (app.status === 'draft' && matching));
  const canSave = ready && validId && editable && authority && consent;
  const canSubmit = ready && !!app && matching && !conflict && app.status === 'draft' && app.authorityAttested && app.feePolicyConsentVersion === requirements.feePolicyConsentVersion;
  const canVerify = ready && !!app && inScope && !conflict && (app.status === 'submitted' || app.status === 'identityPending') && app.feePolicyConsentVersion === requirements.feePolicyConsentVersion;
  const openPolicy = () => void mutate(async () => {
    if (!ready || !feePolicyUrl(requirements.feePolicyUrl)) return;
    if (!await Linking.canOpenURL(requirements.feePolicyUrl)) throw new Error('Policy link unavailable');
    await Linking.openURL(requirements.feePolicyUrl);
  });
  return <View>
    <Text style={[styles.heading, { color: colors.text }]}>Collection application</Text>
    <Text style={{ color: colors.muted }}>Apply to collect short-stay payments for this property. This does not enable guest booking or checkout. Approval is reviewed separately.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!notice && <Text style={{ color: colors.text }}>{notice}</Text>}
    {button('Reload collection status', () => void refresh())}
    {!apps && <ActivityIndicator color={colors.accent} />}
    {apps && !ready && <Text accessibilityRole="alert" style={styles.error}>{collectionUnavailable(requirements)}</Text>}
    {apps && conflict && <Text accessibilityRole="alert" style={styles.error}>Multiple active applications were returned. Contact support; editing is disabled.</Text>}
    {apps && app && <>
      <Text style={{ color: colors.text, marginTop: 12 }}>Application #{app.id} · {app.status.replace(/([A-Z])/g, ' $1').toLowerCase()}</Text>
      <Text style={{ color: colors.text }}>Property scope: {app.propertyIds.join(', ') || 'Unavailable'}</Text>
      {!matching && <Text accessibilityRole="alert" style={styles.error}>This application covers a different or multi-property scope. Editing and submission from this property are disabled so its existing scope is not replaced.</Text>}
      {app.status === 'rejected' && <Text style={{ color: colors.muted }}>A rejected application cannot be edited; reload to check current status.</Text>}
      {app.status === 'payoutApproved' && <Text style={{ color: colors.muted }}>Approved by review; this screen does not offer booking or checkout.</Text>}
    </>}
    {apps && ready && <>
      <Text style={{ color: colors.text, marginTop: 12 }}>Fee policy version: {requirements.feePolicyConsentVersion}</Text>
      {button('Read current fee policy', openPolicy)}
      {editable && <>
        <Text style={{ color: colors.muted, marginTop: 12 }}>Only the current property ({propertyId}) will be included in a new draft. Your Connect account must already be available on the server. No identity or bank details are entered here.</Text>
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: authority }} accessibilityLabel="I have authority to apply for this property" onPress={() => setAuthority(value => !value)} style={styles.checkbox}><Text style={{ color: colors.text }}>{authority ? '☑' : '☐'} I attest that I have authority to apply for this property.</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: consent }} accessibilityLabel="I consent to the current fee policy" onPress={() => setConsent(value => !value)} style={styles.checkbox}><Text style={{ color: colors.text }}>{consent ? '☑' : '☐'} I have read and consent to fee policy version {requirements.feePolicyConsentVersion}.</Text></TouchableOpacity>
        {button('Save collection draft', () => void mutate(async () => {
          if (!canSave) return;
          // Re-read the server scope and policy immediately before the write; do not clobber a
          // draft edited in another session or consent to a superseded fee policy.
          const [latestPolicy, latestApps] = await Promise.all([collectionAPI.requirements(), collectionAPI.applications()]);
          if (!policyReady(latestPolicy) || latestPolicy.feePolicyConsentVersion !== requirements.feePolicyConsentVersion ||
            !Array.isArray(latestApps) || applicationConflict(latestApps) ||
            (currentApplication(latestApps) && (!scopeMatches(currentApplication(latestApps)!, id) || currentApplication(latestApps)!.status !== 'draft')))
            throw new Error('Scope or policy changed');
          await collectionAPI.saveDraft([id], latestPolicy.feePolicyConsentVersion);
        }), !canSave)}
      </>}
      {app && (matching || (inScope && app.status !== 'draft')) && <>
        {app.status === 'draft' && app.feePolicyConsentVersion !== requirements.feePolicyConsentVersion && <Text accessibilityRole="alert" style={styles.error}>Fee policy changed. Review the current policy and save a new consent before submitting.</Text>}
        {app.status === 'draft' && button('Submit collection application', () => void mutate(async () => {
          if (!canSubmit) return;
          const latest = await collectionAPI.requirements();
          const latestApps = await collectionAPI.applications();
          const draft = Array.isArray(latestApps) ? currentApplication(latestApps) : null;
          if (!policyReady(latest) || latest.feePolicyConsentVersion !== requirements.feePolicyConsentVersion ||
            !draft || draft.id !== app.id || draft.rowVersion !== app.rowVersion || !scopeMatches(draft, id) || draft.status !== 'draft') throw new Error('Application changed');
          await collectionAPI.submit();
        }), !canSubmit)}
        {canVerify && button('Continue with Stripe Identity', () => {
          if (identityLaunching.current || locked.current) return;
          identityLaunching.current = true; // Lock before the first await, not after a state update.
          void mutate(async () => {
            let launched = false;
            try {
              const response = await collectionAPI.identitySession(app.id);
              if (!response?.url) { if (alive.current) setNotice('No hosted identity link is available. Reload status to check progress.'); return; }
              if (!hostedIdentityUrl(response.url)) throw new Error('Untrusted identity URL');
              if (!await Linking.canOpenURL(response.url)) throw new Error('Identity link unavailable');
              await Linking.openURL(response.url);
              launchedId.current = app.id;
              launched = true;
              // URL only exists in this call stack; never retain it in state or logs.
            } finally {
              // Keep a successful launch locked until return/status refresh; retry after failure.
              if (!launched) identityLaunching.current = false;
            }
          });
        })}
        {app.status === 'identityPending' && ready && button('Refresh identity status', () => void mutate(async () => { await collectionAPI.identityRefresh(app.id); }))}
        {app.status !== 'draft' && <Text style={{ color: colors.muted, marginTop: 8 }}>Verification and approval are determined by the server and Stripe. Reload status after returning from Stripe; no documents are stored here.</Text>}
      </>}
    </>}
  </View>;
}
const styles = StyleSheet.create({ heading: { fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 9 }, button: { minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 12 }, buttonText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.5 }, checkbox: { minHeight: 44, justifyContent: 'center', marginTop: 12 }, error: { color: '#bf3d37', marginVertical: 8 } });
