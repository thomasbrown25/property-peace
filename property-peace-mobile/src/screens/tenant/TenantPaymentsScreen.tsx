import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import apiClient from '../../services/apiClient';
import { createTenantPaymentsAPI, type PayReadiness, type TenantCharge, type TenantLease, type TenantPayment, type TenantRent } from '../../api/tenantPaymentsAPI';
import { billForLease, canPayFee, canPayRent, chargeBalanceLabel, chargeDate, leaseHomeLabel, parseRentPayment, pendingFeePayment, pendingRentPayment, paymentStatus, rentIsLate } from '../../features/tenantPayments/model';
import { submitFeePayment, submitRentPayment } from '../../features/tenantPayments/checkout';
import { useAppTheme } from '../../theme/AppTheme';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useAppSelector } from '../../store/hooks';

const api = createTenantPaymentsAPI(apiClient);
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const message = (error: any) => String(error?.message || error?.detail || 'Payments are temporarily unavailable.');

type Checkout = (clientSecret: string) => Promise<'submitted' | 'canceled'>;
type FeeHold = { paymentIntentId: string; amount: number; chargeId: string; previousRemaining: number };
function PaymentsContent({ checkout, keyError }: { checkout?: Checkout; keyError?: string }) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [leases, setLeases] = useState<TenantLease[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [rent, setRent] = useState<TenantRent | null>(null);
  const [history, setHistory] = useState<TenantPayment[]>([]);
  const [charges, setCharges] = useState<TenantCharge[]>([]);
  const [chargeError, setChargeError] = useState('');
  const [selectedFee, setSelectedFee] = useState<string | null>(null);
  const selectedFeeRef = useRef<string | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const [feeNote, setFeeNote] = useState('');
  const [feePending, setFeePending] = useState<Record<string, FeeHold>>({});
  const feePendingRef = useRef<Record<string, FeeHold>>({});
  // Retain unresolved holds across lease switches, including a switch during intent creation.
  const feePendingByLeaseRef = useRef<Record<number, Record<string, FeeHold>>>({});
  const [readiness, setReadiness] = useState<PayReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [pending, setPending] = useState<{ paymentIntentId: string; amount: number } | null>(null);
  const pendingRef = useRef<{ paymentIntentId: string; amount: number } | null>(null);
  const amountLeaseRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  const selectedRef = useRef<number | null>(null);

  const load = useCallback(async (preferred?: number | null) => {
    const token = ++requestRef.current;
    try {
      setError(''); setChargeError('');
      // Readiness is independent of the selected lease; never infer permission from a balance.
      const [scopes, gate] = await Promise.all([api.leases(), api.readiness().catch(() => null)]);
      const id = scopes.find(x => x.id === (preferred ?? selectedRef.current))?.id ?? scopes.find(x => x.isActive)?.id ?? scopes[0]?.id ?? null;
      if (id === null) {
        if (token === requestRef.current) { setLeases([]); setSelected(null); selectedRef.current = null; setRent(null); setHistory([]); setCharges([]); setChargeError(''); setReadiness(gate); setAmountInput(''); amountLeaseRef.current = null; pendingRef.current = null; setPending(null); setCheckoutNote(''); selectedFeeRef.current = null; setSelectedFee(null); setFeeInput(''); setFeeNote(''); feePendingRef.current = {}; setFeePending({}); }
        return;
      }
      const [record, payments, chargeResult] = await Promise.all([
        api.rent(id), api.history(id),
        api.charges(id).then(value => ({ value, error: '' }), e => ({ value: [] as TenantCharge[], error: message(e) })),
      ]);
      if (token !== requestRef.current) return;
      if (amountLeaseRef.current !== id) {
        amountLeaseRef.current = id;
        setAmountInput(Number.isFinite(record?.rentDue) ? record!.rentDue.toFixed(2) : '');
        pendingRef.current = null; setPending(null); setCheckoutNote('');
        selectedFeeRef.current = null; setSelectedFee(null); setFeeInput(''); setFeeNote(''); feePendingRef.current = {}; setFeePending({});
      } else if (pendingRef.current && !pendingRentPayment(pendingRef.current, payments)) {
        pendingRef.current = null; setPending(null);
        setCheckoutNote('Check payment history and the updated rent balance before paying again.');
      }
      if (chargeResult.error === '') {
        const holds = feePendingByLeaseRef.current[id] ?? {};
        // A fallback to another lease is not evidence about the previous lease's hold.
        const stillPending = selectedRef.current === id
          ? Object.fromEntries(Object.entries(holds).filter(([, intent]) => pendingFeePayment(intent, payments, chargeResult.value.find(charge => charge.chargeId === intent.chargeId))))
          : holds;
        const resolved = Object.keys(stillPending).length !== Object.keys(holds).length;
        feePendingByLeaseRef.current[id] = stillPending;
        feePendingRef.current = stillPending; setFeePending(stillPending);
        if (resolved) setFeeNote('Check the updated charge balance and payment history before paying again.');
        if (selectedFeeRef.current && !chargeResult.value.some(charge => charge.chargeId === selectedFeeRef.current)) {
          selectedFeeRef.current = null; setSelectedFee(null); setFeeInput('');
        }
      }
      setLeases(scopes); setSelected(id); selectedRef.current = id; setRent(record); setHistory(payments); setCharges(chargeResult.value); setChargeError(chargeResult.error); setReadiness(gate);
    } catch (e) {
      if (token === requestRef.current) { setLeases([]); setSelected(null); selectedRef.current = null; setRent(null); setHistory([]); setCharges([]); setChargeError(''); setReadiness(null); setError(message(e)); }
    } finally {
      if (token === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); return () => { requestRef.current++; }; }, [load]));
  const lease = leases.find(x => x.id === selected) ?? null;
  const bill = billForLease(lease, rent);
  const amount = parseRentPayment(amountInput, bill?.amount ?? NaN);
  const eligible = canPayRent(lease, rent, readiness) && !!checkout && !busy && !loading && !error && !pending && amount !== null;
  const whyUnavailable = !lease ? 'No tenant lease is available.' : !lease.isActive ? 'This lease is not active.' : lease.rentCollectionByPlatform !== true ? '' : !rent || !bill ? 'Rent balance is unavailable.' : pending ? 'Payment submitted; awaiting server confirmation. Refresh to check your balance.' : !!rent.processingPaymentCount ? 'A payment is processing. Check history before paying again.' : bill.amount <= 0 ? 'No rent is due right now.' : bill.amount < 0.5 ? 'Rent due is below the $0.50 minimum for online payment.' : amount === null ? 'Enter $0.50 or more, up to the rent due, with no more than two decimal places.' : readiness?.allowed !== true ? '' : 'Secure checkout is unavailable.';

  const pay = async () => {
    if (busyRef.current || !eligible || !lease || !bill) return;
    const leaseId = lease.id;
    busyRef.current = true;
    setBusy(true); setCheckoutNote('');
    try {
      if (!checkout) throw new Error('Secure checkout is unavailable.');
      const result = await submitRentPayment({ api, lease, displayedRent: rent, input: amountInput,
        uuid: () => Crypto.randomUUID(), isCurrent: () => selectedRef.current === leaseId && amountLeaseRef.current === leaseId,
        onIntentCreated: intent => { pendingRef.current = intent; setPending(intent); }, checkout });
      if (selectedRef.current !== leaseId) return;
      if (result.result === 'canceled') {
        setCheckoutNote('Checkout canceled. The created payment remains blocked until the server reports its final status. Refresh to check history.');
      } else {
        pendingRef.current = { paymentIntentId: result.paymentIntentId, amount: result.amount };
        setPending(pendingRef.current);
        setCheckoutNote(`${money(result.amount)} submitted · processing until server confirmation. Rent due above updates only after confirmation; bank payments may take several days.`);
      }
    } catch (e) {
      if (selectedRef.current === leaseId) {
        if (pendingRef.current) setCheckoutNote('Checkout could not finish. The created payment is on hold until its server status is known; refresh history before paying again.');
        Alert.alert('Payment unavailable', message(e));
      }
    } finally {
      busyRef.current = false; setBusy(false);
      if (selectedRef.current === leaseId) { setRefreshing(true); await load(leaseId); }
    }
  };
  const payFee = async (charge: TenantCharge) => {
    if (busyRef.current || !lease || selectedFeeRef.current !== charge.chargeId || !canPayFee(lease, charge, readiness) ||
      !checkout || loading || !!error || !!chargeError || feePendingRef.current[charge.chargeId] ||
      parseRentPayment(feeInput, charge.remaining) === null) return;
    const leaseId = lease.id;
    busyRef.current = true; setBusy(true); setFeeNote('');
    try {
      const result = await submitFeePayment({ api, lease, displayedFee: charge, input: feeInput,
        uuid: () => Crypto.randomUUID(), isCurrent: () => selectedRef.current === leaseId && selectedFeeRef.current === charge.chargeId,
        onIntentCreated: intent => {
          feePendingByLeaseRef.current[leaseId] = { ...feePendingByLeaseRef.current[leaseId], [charge.chargeId]: intent };
          if (selectedRef.current === leaseId) {
            feePendingRef.current = feePendingByLeaseRef.current[leaseId]; setFeePending(feePendingRef.current);
          }
        }, checkout });
      if (selectedRef.current !== leaseId || selectedFeeRef.current !== charge.chargeId) return;
      setFeeNote(result.result === 'canceled'
        ? 'Checkout canceled. The created payment remains on hold until the server reports its final status. Refresh to check history.'
        : `${money(result.amount)} submitted · processing until server confirmation. Fee balance updates only after confirmation; bank payments may take several days.`);
    } catch (e) {
      if (selectedRef.current === leaseId) {
        if (feePendingRef.current[charge.chargeId]) setFeeNote('Checkout could not finish. The created payment remains on hold until its server status is known.');
        Alert.alert('Payment unavailable', message(e));
      }
    } finally {
      busyRef.current = false; setBusy(false);
      if (selectedRef.current === leaseId) { setRefreshing(true); await load(leaseId); }
    }
  };
  const surface = { backgroundColor: colors.surface, borderColor: colors.border };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <LandlordPageHeader title="Payments" logo />
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 24) + 100 }}>
      <Text style={styles.eyebrow}>YOUR HOME · PAYMENTS</Text>
      <Text style={[styles.title, { color: colors.text }]}>Pay & bill</Text>
      <Text style={[styles.caption, { color: colors.muted }]}>Your rent balance and payment history, straight from your lease.</Text>
      {loading ? <ActivityIndicator style={{ marginVertical: 32 }} color={colors.accent} /> : <>
        {error ? <View style={[styles.notice, surface]}><Text style={{ color: colors.text }}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { setLoading(true); void load(); }}><Text style={[styles.link, { color: colors.accent }]}>Try again</Text></TouchableOpacity></View> : null}
        {leases.length > 1 && <View style={styles.leaseChoices}>{leases.map(item => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: item.id === selected }} key={item.id} style={[styles.choice, surface, item.id === selected && { borderColor: colors.accent }]} onPress={() => { if (item.id === selectedRef.current) return; setSelected(item.id); selectedRef.current = item.id; amountLeaseRef.current = null; setAmountInput(''); pendingRef.current = null; setPending(null); setCheckoutNote(''); selectedFeeRef.current = null; setSelectedFee(null); setFeeInput(''); setFeeNote(''); feePendingRef.current = {}; setFeePending({}); setRent(null); setHistory([]); setCharges([]); setChargeError(''); setReadiness(null); setLoading(true); void load(item.id); }}><Text style={{ color: colors.text, fontWeight: '700' }}>{leaseHomeLabel(item)}</Text></TouchableOpacity>)}</View>}
        {lease && <View style={[styles.card, surface]}>
          <Text style={[styles.label, { color: colors.muted }]}>{leaseHomeLabel(lease)}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{bill ? money(bill.amount) : 'Balance unavailable'}</Text>
          <Text style={[styles.caption, { color: colors.muted }]}>{bill ? `Rent left to pay (server balance) · ${date(bill.dueDate)}` : 'Unable to verify the current rent bill.'}</Text>
          {bill && rentIsLate(rent) && <Text style={[styles.late, { color: mode === 'dark' ? '#ff9cae' : '#b42336' }]}>Past due</Text>}
          <Text style={[styles.small, { color: colors.text, fontWeight: '700', marginTop: 16 }]}>Rent payment amount ($)</Text>
          <TextInput accessibilityLabel="Rent payment amount in dollars" keyboardType="decimal-pad" value={amountInput} onChangeText={setAmountInput} editable={!busy && !pending} selectTextOnFocus style={[styles.amountField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="0.00" placeholderTextColor={colors.muted} />
          <Text style={[styles.small, { color: colors.muted }]}>Pay all or part of rent only. Minimum $0.50; payment history and rent left update after server confirmation.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !eligible }} disabled={!eligible} style={[styles.payButton, !eligible && styles.disabled]} onPress={() => void pay()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>{amount !== null ? `Pay ${money(amount)} toward rent` : 'Pay rent securely'}</Text>}</TouchableOpacity>
          {!eligible && (whyUnavailable || readiness?.allowed === true && keyError) ? <Text style={[styles.small, { color: colors.muted }]}>{readiness?.allowed === true && keyError || whyUnavailable}</Text> : null}
          {checkoutNote ? <Text style={[styles.small, { color: colors.accent }]}>{checkoutNote}</Text> : null}
        </View>}
        <Text style={[styles.section, { color: colors.text }]}>Charges</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>Select an unpaid fee to pay all or part of its remaining balance. Deposits cannot be paid online. Balances update only after server confirmation.</Text>
        {chargeError ? <View style={[styles.notice, surface]}><Text style={{ color: colors.text }}>Charges are unavailable: {chargeError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { setRefreshing(true); void load(); }}><Text style={[styles.link, { color: colors.accent }]}>Try again</Text></TouchableOpacity></View> : null}
        {!chargeError && !charges.length && <View style={[styles.card, surface]}><Text style={{ color: colors.muted }}>{error ? 'Charges are unavailable.' : 'No charges recorded for this lease.'}</Text></View>}
        {!chargeError && charges.map(charge => <View key={charge.chargeId} style={[styles.card, surface]}>
          <Text style={[styles.label, { color: colors.muted }]}>{charge.type}</Text>
          <Text style={[styles.rowTitle, { color: colors.text, marginTop: 8 }]}>{charge.title}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Due {chargeDate(charge.dueDate)} · Original {money(charge.amount)}</Text>
          <Text style={[styles.rowTitle, { color: colors.text, marginTop: 10 }]}>Remaining {money(charge.remaining)}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Paid {money(charge.paid)} · {chargeBalanceLabel(charge)}</Text>
          {charge.type.toLowerCase() === 'fee' && /^fee:[1-9]\d*$/.test(charge.chargeId) && charge.remaining > 0 && <>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Select ${charge.title} fee`} accessibilityState={{ selected: selectedFee === charge.chargeId }}
              disabled={busy} onPress={() => { selectedFeeRef.current = charge.chargeId; setSelectedFee(charge.chargeId); setFeeInput(charge.remaining.toFixed(2)); setFeeNote(''); }}
              style={[styles.choice, { borderColor: selectedFee === charge.chargeId ? colors.accent : colors.border, marginTop: 14 }]}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{selectedFee === charge.chargeId ? 'Selected fee' : 'Select fee to pay'}</Text>
            </TouchableOpacity>
            {selectedFee === charge.chargeId && <>
              <Text style={[styles.small, { color: colors.text, fontWeight: '700' }]}>Fee payment amount ($)</Text>
              <TextInput accessibilityLabel="Fee payment amount in dollars" keyboardType="decimal-pad" value={feeInput} onChangeText={setFeeInput}
                editable={!busy && !feePending[charge.chargeId]} selectTextOnFocus style={[styles.amountField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="0.00" placeholderTextColor={colors.muted} />
              <Text style={[styles.small, { color: colors.muted }]}>Minimum $0.50; no more than {money(charge.remaining)}, with at most two decimal places. Bank payments may take several days.</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canPayFee(lease, charge, readiness) || !checkout || !!keyError || busy || loading || !!error || !!feePending[charge.chargeId] || parseRentPayment(feeInput, charge.remaining) === null }}
                disabled={!canPayFee(lease, charge, readiness) || !checkout || !!keyError || busy || loading || !!error || !!feePending[charge.chargeId] || parseRentPayment(feeInput, charge.remaining) === null}
                style={[styles.payButton, (!canPayFee(lease, charge, readiness) || !checkout || !!keyError || busy || loading || !!error || !!feePending[charge.chargeId] || parseRentPayment(feeInput, charge.remaining) === null) && styles.disabled]}
                onPress={() => void payFee(charge)}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>{parseRentPayment(feeInput, charge.remaining) !== null ? `Pay ${money(parseRentPayment(feeInput, charge.remaining)!)} toward ${charge.title} fee` : 'Pay fee securely'}</Text>}</TouchableOpacity>
              {feePending[charge.chargeId] ? <Text style={[styles.small, { color: colors.muted }]}>Payment submitted or started; awaiting server status. Refresh before paying this fee again.</Text> : null}
              {!canPayFee(lease, charge, readiness) && !feePending[charge.chargeId] ? <Text style={[styles.small, { color: colors.muted }]}>{readiness?.allowed !== true ? readiness?.blockers.map(x => x.message).filter(Boolean).join(' · ') || 'Fee checkout is unavailable.' : 'This fee is not available for payment while a payment is processing or the lease is ineligible.'}</Text> : null}
              {!checkout && keyError ? <Text style={[styles.small, { color: colors.muted }]}>{keyError}</Text> : null}
              {feeNote ? <Text style={[styles.small, { color: colors.accent }]}>{feeNote}</Text> : null}
            </>}
          </>}
          {charge.payments.map(payment => <View key={`${payment.id}-${payment.paymentDate}`} style={[styles.chargePayment, { borderColor: colors.border }]}>
            <Text style={[styles.small, { color: colors.muted, marginTop: 0, flex: 1 }]}>Payment · {chargeDate(payment.paymentDate)} · {paymentStatus(payment)}</Text>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{money(payment.amount)}</Text>
          </View>)}
        </View>)}
        <Text style={[styles.section, { color: colors.text }]}>Payment history</Text>
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
  small: { fontSize: 12, lineHeight: 18, marginTop: 8 }, late: { fontSize: 14, fontWeight: '800', marginTop: 10 }, amountField: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, minHeight: 48, marginTop: 8, fontSize: 18 }, payButton: { backgroundColor: '#0b5cab', borderRadius: 9, minHeight: 52, marginTop: 21, alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: '#8c9da9' }, payText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  row: { borderWidth: 1, borderRadius: 10, padding: 15, marginBottom: 9, flexDirection: 'row', gap: 10 }, rowTitle: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  chargePayment: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  notice: { borderWidth: 1, borderRadius: 9, padding: 15, marginTop: 20 }, link: { fontWeight: '800', marginTop: 10 }, leaseChoices: { marginTop: 17, gap: 8 }, choice: { padding: 13, borderWidth: 1, borderRadius: 9 }, fallback: { flex: 1, padding: 24, gap: 20 },
});
