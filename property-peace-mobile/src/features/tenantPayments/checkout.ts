import type { PayReadiness, TenantCharge, TenantLease, TenantRent } from '../../api/tenantPaymentsAPI';
import { billForLease, canPayFee, canPayRent, parseRentPayment, paymentRows } from './model.ts';

type PaymentAPI = {
  leases(): Promise<TenantLease[]>;
  rent(id: number): Promise<TenantRent | null>;
  readiness(): Promise<PayReadiness>;
  createIntent(id: number, amount: number, operationId: string): Promise<{ clientSecret: string; paymentIntentId: string }>;
};

export async function submitRentPayment({ api, lease, displayedRent, input, uuid, isCurrent, checkout, onIntentCreated }: {
  api: PaymentAPI; lease: TenantLease; displayedRent: TenantRent | null; input: string;
  uuid: () => string; isCurrent: () => boolean; checkout: (clientSecret: string) => Promise<'submitted' | 'canceled'>;
  onIntentCreated?: (intent: { paymentIntentId: string; amount: number }) => void;
}): Promise<{ result: 'submitted' | 'canceled'; amount: number; paymentIntentId: string }> {
  const bill = billForLease(lease, displayedRent);
  const amount = parseRentPayment(input, bill?.amount ?? NaN);
  if (amount === null) throw new Error('Enter a rent amount of at least $0.50, no more than the rent due, using cents only.');
  const [leases, gate, currentRent] = await Promise.all([api.leases(), api.readiness(), api.rent(lease.id)]);
  if (!isCurrent()) throw new Error('Your lease changed. Refresh before paying.');
  const currentLease = leases.find(item => item.id === lease.id) ?? null;
  if (!canPayRent(currentLease, currentRent, gate)) throw new Error('Rent payment is not available. Refresh your bill.');
  const currentBill = billForLease(currentLease, currentRent);
  if (!currentBill || currentBill.amount !== bill?.amount || parseRentPayment(input, currentBill.amount) !== amount) throw new Error('Your rent balance changed. Refresh before paying.');
  const operationId = uuid(); // one fresh ID per attempt; never reuse on a changed amount
  const { clientSecret, paymentIntentId } = await api.createIntent(lease.id, amount, operationId);
  if (!isCurrent()) throw new Error('Your lease changed. Refresh before paying.');
  onIntentCreated?.({ paymentIntentId, amount });
  const result = await checkout(clientSecret);
  return { result, amount, paymentIntentId };
}

export async function submitSelectedRentPayment({ api, lease, displayedRent, charge, input, uuid, isCurrent, checkout, onIntentCreated }: {
  api: PaymentAPI & { charges(id: number): Promise<TenantCharge[]>; createIntent(id: number, amount: number, operationId: string, chargeId: string): Promise<{ clientSecret: string; paymentIntentId: string }> };
  lease: TenantLease; displayedRent: TenantRent | null; charge: TenantCharge; input: string; uuid: () => string;
  isCurrent: () => boolean; checkout: (clientSecret: string) => Promise<'submitted' | 'canceled'>;
  onIntentCreated?: (intent: { paymentIntentId: string; amount: number }) => void;
}): Promise<{ result: 'submitted' | 'canceled'; amount: number; paymentIntentId: string }> {
  const amount = parseRentPayment(input, charge.remaining);
  if (amount === null) throw new Error('Enter $0.50 or more, up to the selected rent balance.');
  const [leases, gate, currentRent, charges] = await Promise.all([api.leases(), api.readiness(), api.rent(lease.id), api.charges(lease.id)]);
  if (!isCurrent()) throw new Error('Your selection changed. Refresh before paying.');
  const currentLease = leases.find(x => x.id === lease.id) ?? null;
  const row = paymentRows(currentLease, currentRent, charges).find(x => x.charge?.chargeId === charge.chargeId && x.route === 'selectedRent' && x.payable);
  if (!canPayRent(currentLease, currentRent, gate) || !row || row.amount !== charge.remaining ||
      billForLease(currentLease, currentRent)?.amount !== billForLease(lease, displayedRent)?.amount)
    throw new Error('Selected rent changed or is unavailable. Refresh before paying.');
  const { clientSecret, paymentIntentId } = await api.createIntent(lease.id, amount, uuid(), charge.chargeId);
  onIntentCreated?.({ paymentIntentId, amount });
  if (!isCurrent()) throw new Error('Your selection changed. Refresh before paying.');
  return { result: await checkout(clientSecret), amount, paymentIntentId };
}

export async function submitFeePayment({ api, lease, displayedFee, input, uuid, isCurrent, checkout, onIntentCreated }: {
  api: Pick<PaymentAPI, 'leases' | 'readiness'> & {
    charges(id: number): Promise<TenantCharge[]>;
    createIntent(id: number, amount: number, operationId: string, chargeId: string): Promise<{ clientSecret: string; paymentIntentId: string }>;
  };
  lease: TenantLease; displayedFee: TenantCharge; input: string; uuid: () => string; isCurrent: () => boolean;
  checkout: (clientSecret: string) => Promise<'submitted' | 'canceled'>;
  onIntentCreated?: (intent: { paymentIntentId: string; amount: number; chargeId: string; previousRemaining: number }) => void;
}): Promise<{ result: 'submitted' | 'canceled'; amount: number; paymentIntentId: string; chargeId: string }> {
  if (!canPayFee(lease, displayedFee, { allowed: true, blockers: [] })) throw new Error('Fee checkout is unavailable. Refresh your charges.');
  const amount = parseRentPayment(input, displayedFee.remaining);
  if (amount === null) throw new Error('Enter a fee amount of at least $0.50, no more than the remaining balance, using cents only.');
  const [leases, gate, charges] = await Promise.all([api.leases(), api.readiness(), api.charges(lease.id)]);
  if (!isCurrent()) throw new Error('Your lease changed. Refresh before paying.');
  const currentLease = leases.find(item => item.id === lease.id) ?? null;
  const currentFee = charges.find(item => item.chargeId === displayedFee.chargeId) ?? null;
  if (!canPayFee(currentLease, currentFee, gate)) throw new Error('Fee checkout is unavailable. Refresh your charges.');
  if (currentFee!.remaining !== displayedFee.remaining || parseRentPayment(input, currentFee!.remaining) !== amount)
    throw new Error('Your fee balance changed. Refresh before paying.');
  const chargeId = displayedFee.chargeId;
  const { clientSecret, paymentIntentId } = await api.createIntent(lease.id, amount, uuid(), chargeId);
  onIntentCreated?.({ paymentIntentId, amount, chargeId, previousRemaining: currentFee!.remaining });
  if (!isCurrent()) throw new Error('Your lease changed. Refresh before paying.');
  const result = await checkout(clientSecret);
  return { result, amount, paymentIntentId, chargeId };
}
