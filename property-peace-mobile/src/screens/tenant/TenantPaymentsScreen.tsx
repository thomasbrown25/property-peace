import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import apiClient from '../../services/apiClient';
import { createTenantPaymentsAPI, type PayReadiness, type TenantLease, type TenantPayment, type TenantRent } from '../../api/tenantPaymentsAPI';
import { billForLease, canPayRent, creditedRentTotal, paymentStatus } from '../../features/tenantPayments/model';
import { useAppTheme } from '../../theme/AppTheme';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useAppSelector } from '../../store/hooks';

const api = createTenantPaymentsAPI(apiClient);
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const message = (error: any) => String(error?.message || error?.detail || 'Payments are temporarily unavailable.');

type Checkout = (clientSecret: string) => Promise<'submitted' | 'canceled'>;
function PaymentsContent({ checkout, keyError }: { checkout?: Checkout; keyError?: string }) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [leases, setLeases] = useState<TenantLease[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [rent, setRent] = useState<TenantRent | null>(null);
  const [history, setHistory] = useState<TenantPayment[]>([]);
  const [readiness, setReadiness] = useState<PayReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  const selectedRef = useRef<number | null>(null);

  const load = useCallback(async (preferred?: number | null) => {
    const token = ++requestRef.current;
    try {
      setError('');
      // Readiness is independent of the selected lease; never infer permission from a balance.
      const [scopes, gate] = await Promise.all([api.leases(), api.readiness().catch(() => null)]);
      const id = scopes.find(x => x.id === (preferred ?? selectedRef.current))?.id ?? scopes.find(x => x.isActive)?.id ?? scopes[0]?.id ?? null;
      if (id === null) {
        if (token === requestRef.current) { setLeases([]); setSelected(null); selectedRef.current = null; setRent(null); setHistory([]); setReadiness(gate); }
        return;
      }
      const [record, payments] = await Promise.all([api.rent(id), api.history(id)]);
      if (token !== requestRef.current) return;
      setLeases(scopes); setSelected(id); selectedRef.current = id; setRent(record); setHistory(payments); setReadiness(gate);
    } catch (e) {
      if (token === requestRef.current) { setLeases([]); setSelected(null); selectedRef.current = null; setRent(null); setHistory([]); setReadiness(null); setError(message(e)); }
    } finally {
      if (token === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); return () => { requestRef.current++; }; }, [load]));
  const lease = leases.find(x => x.id === selected) ?? null;
  const bill = billForLease(lease, rent);
  const eligible = canPayRent(lease, rent, readiness) && !!checkout && !busy && !loading && !error;
  const blockers = readiness?.blockers.map(x => x.message || x.code).filter(Boolean).join(' · ');
  const whyUnavailable = !lease ? 'No tenant lease is available.' : !readiness?.allowed ? blockers || 'Online payments are not available yet.' : !lease.isActive ? 'This lease is not active.' : lease.rentCollectionByPlatform !== true ? 'Online rent collection is not enabled for this lease.' : !rent || !bill ? 'Rent balance is unavailable.' : !!rent.processingPaymentCount ? 'A payment is processing. Check history before paying again.' : bill.amount <= 0 ? 'No rent is due right now.' : 'Secure checkout is unavailable.';

  const pay = async () => {
    if (busyRef.current || !eligible || !lease || !bill) return;
    busyRef.current = true;
    setBusy(true); setCheckoutNote('');
    try {
      // Recheck server authorization and balance immediately before creating the intent.
      const [gate, currentRent] = await Promise.all([api.readiness(), api.rent(lease.id)]);
      if (!canPayRent(lease, currentRent, gate)) throw new Error('Rent payment is not available. Refresh your bill.');
      const currentBill = billForLease(lease, currentRent)!;
      if (currentBill.amount !== bill.amount) throw new Error('Your rent balance changed. Refresh before paying.');
      const operationId = Crypto.randomUUID();
      if (!checkout) throw new Error('Secure checkout is unavailable.');
      const { clientSecret } = await api.createIntent(lease.id, currentBill.amount, operationId);
      const result = await checkout(clientSecret);
      if (result === 'canceled') {
        setCheckoutNote('Checkout canceled. No payment is shown as paid until the server confirms it.');
      } else {
        setCheckoutNote('Payment submitted. Card and bank payments are only marked paid after server confirmation; bank payments may take several days.');
      }
    } catch (e) {
      Alert.alert('Payment unavailable', message(e));
    } finally {
      busyRef.current = false; setBusy(false);
      setRefreshing(true); await load(lease.id);
    }
  };
  const surface = { backgroundColor: colors.surface, borderColor: colors.border };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <LandlordPageHeader title="Payments" />
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 24) + 100 }}>
      <Text style={styles.eyebrow}>YOUR HOME · PAYMENTS</Text>
      <Text style={[styles.title, { color: colors.text }]}>Pay & bill</Text>
      <Text style={[styles.caption, { color: colors.muted }]}>Your rent balance and payment history, straight from your lease.</Text>
      {loading ? <ActivityIndicator style={{ marginVertical: 32 }} color={colors.accent} /> : <>
        {error ? <View style={[styles.notice, surface]}><Text style={{ color: colors.text }}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { setLoading(true); void load(); }}><Text style={[styles.link, { color: colors.accent }]}>Try again</Text></TouchableOpacity></View> : null}
        {leases.length > 1 && <View style={styles.leaseChoices}>{leases.map(item => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: item.id === selected }} key={item.id} style={[styles.choice, surface, item.id === selected && { borderColor: colors.accent }]} onPress={() => { setSelected(item.id); selectedRef.current = item.id; setRent(null); setHistory([]); setReadiness(null); setLoading(true); void load(item.id); }}><Text style={{ color: colors.text, fontWeight: '700' }}>{item.propertyName || 'Your property'} · {item.unitName || `Lease ${item.id}`}</Text></TouchableOpacity>)}</View>}
        {lease && <View style={[styles.card, surface]}>
          <Text style={[styles.label, { color: colors.muted }]}>{lease.propertyName || 'YOUR LEASE'} · {lease.unitName || `#${lease.id}`}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{bill ? money(bill.amount) : 'Balance unavailable'}</Text>
          <Text style={[styles.caption, { color: colors.muted }]}>{bill ? `Rent due · ${date(bill.dueDate)}` : 'Unable to verify the current rent bill.'}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Rent only. Fees and deposits are not included in this checkout.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !eligible }} disabled={!eligible} style={[styles.payButton, !eligible && styles.disabled]} onPress={() => void pay()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>{bill?.amount ? `Pay ${money(bill.amount)} securely` : 'Pay rent securely'}</Text>}</TouchableOpacity>
          {!eligible && <Text style={[styles.small, { color: colors.muted }]}>{keyError || whyUnavailable}</Text>}
          {checkoutNote ? <Text style={[styles.small, { color: colors.accent }]}>{checkoutNote}</Text> : null}
        </View>}
        <Text style={[styles.section, { color: colors.text }]}>Payment history</Text>
        <Text style={[styles.caption, { color: colors.muted, marginBottom: 12 }]}>Only finalized rent payments count as paid. Bank transfers may remain processing.</Text>
        {history.length > 0 && <Text style={[styles.small, { color: colors.muted, marginBottom: 12 }]}>Confirmed rent payments: {money(creditedRentTotal(history))}</Text>}
        {!history.length && <View style={[styles.card, surface]}><Text style={{ color: colors.muted }}>{error ? 'History is unavailable.' : 'No payments recorded for this lease yet.'}</Text></View>}
        {history.map((payment, index) => <View key={`${payment.id ?? 'payment'}-${index}`} style={[styles.row, surface]}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{payment.paymentType || 'Rent'} · {date(payment.paymentDate)}</Text><Text style={[styles.small, { color: colors.muted }]}>{payment.method || 'Payment method not listed'}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={[styles.rowTitle, { color: colors.text }]}>{Number.isFinite(payment.amount) ? money(payment.amount) : '—'}</Text><Text style={[styles.status, { color: paymentStatus(payment) === 'Paid' ? (mode === 'dark' ? '#8cdda4' : '#35734c') : colors.muted }]}>{paymentStatus(payment)}</Text></View></View>)}
      </>}
    </ScrollView>
  </View>;
}

function NativeStripePayments() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const checkout: Checkout = async (clientSecret) => {
    const init = await initPaymentSheet({ merchantDisplayName: 'Property Peace', paymentIntentClientSecret: clientSecret, returnURL: 'propertypeace://stripe-redirect', allowsDelayedPaymentMethods: true });
    if (init.error) throw new Error(init.error.message || 'Secure checkout could not start.');
    const result = await presentPaymentSheet();
    if (result.error) {
      if (result.error.code === 'Canceled') return 'canceled';
      throw new Error(result.error.message || 'Payment was not submitted.');
    }
    return 'submitted';
  };
  return <PaymentsContent checkout={checkout} />;
}

export default function TenantPaymentsScreen() {
  const user = useAppSelector(state => state.user.currentUser);
  const scope = `${user?.id ?? user?.Id ?? ''}:${user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? ''}`;
  const [stripeKey, setStripeKey] = useState<{ scope: string; value: string } | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { let active = true; setStripeKey(null); api.publishableKey().then(value => { if (active) { setStripeKey({ scope, value }); setError(''); } }).catch(e => { if (active) { setStripeKey(null); setError(message(e)); } }); return () => { active = false; }; }, [scope]));
  if (!stripeKey || stripeKey.scope !== scope) return <PaymentsContent key={scope} keyError={error || 'Loading secure checkout…'} />;
  return <StripeProvider key={scope} publishableKey={stripeKey.value} urlScheme="propertypeace"><NativeStripePayments /></StripeProvider>;
}

const styles = StyleSheet.create({
  eyebrow: { color: '#b7475a', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 5 }, caption: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  section: { fontSize: 19, fontWeight: '800', marginTop: 28 }, card: { borderWidth: 1, borderRadius: 13, padding: 19, marginTop: 22 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1 }, amount: { fontSize: 34, fontWeight: '800', marginTop: 13 },
  small: { fontSize: 12, lineHeight: 18, marginTop: 8 }, payButton: { backgroundColor: '#0b5cab', borderRadius: 9, minHeight: 52, marginTop: 21, alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: '#8c9da9' }, payText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  row: { borderWidth: 1, borderRadius: 10, padding: 15, marginBottom: 9, flexDirection: 'row', gap: 10 }, rowTitle: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  notice: { borderWidth: 1, borderRadius: 9, padding: 15, marginTop: 20 }, link: { fontWeight: '800', marginTop: 10 }, leaseChoices: { marginTop: 17, gap: 8 }, choice: { padding: 13, borderWidth: 1, borderRadius: 9 }, fallback: { flex: 1, padding: 24, gap: 20 },
});
