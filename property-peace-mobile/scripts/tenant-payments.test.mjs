import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantPaymentsAPI } from '../src/api/tenantPaymentsAPI.ts';
import { billForLease, creditedRentTotal, paymentStatus, canPayRent, leaseHomeLabel, rentIsLate, chargeBalanceLabel, chargeDate } from '../src/features/tenantPayments/model.ts';

const lease = { id: 17, isActive: true, rentCollectionByPlatform: true, propertyName: 'Oak House', unitName: '2B' };
const rent = { leaseId: 17, rentDue: 825.75, currentMonthRentDueDate: '2026-11-01T00:00:00Z', unpaidFees: [{ amount: 45 }] };
const charges = [
  { chargeId: 'fee:41', type: 'Fee', title: 'Pet fee', dueDate: '2026-11-01', amount: 100, paid: 25, remaining: 75, payments: [{ id: 1, amount: 25, status: 'Paid', paymentDate: '2026-10-25' }] },
  { chargeId: 'deposit:security:17', type: 'Deposit', title: 'Security deposit', dueDate: null, amount: 300, paid: 0, remaining: 300, payments: [] },
];
test('tenant charge route returns scoped server charge balances with payment details unchanged', async () => {
  const urls = [];
  const api = createTenantPaymentsAPI({ get: async url => { urls.push(url); return charges; }, post: async () => { throw Error('read-only'); } });
  assert.deepEqual(await api.charges(17), charges);
  assert.deepEqual(urls, ['/api/payment/17/tenant-charges']);
  await assert.rejects(api.charges(0), /valid lease/);
  await assert.rejects(api.charges('../18'), /valid lease/);
  assert.deepEqual(urls, ['/api/payment/17/tenant-charges']);
});
test('invalid or failed charge reads never become a false empty ledger', async () => {
  for (const response of [{ success: true, data: charges }, { data: charges }, null, { ...charges[0], payments: [] }, [{ ...charges[0], remaining: '75' }], [{ ...charges[0], payments: null }]]) {
    const api = createTenantPaymentsAPI({ get: async () => response, post: async () => null });
    await assert.rejects(api.charges(17), /Invalid tenant charges response/);
  }
});
test('charge labels use server balance only, not invented allocation or pending payment statuses', () => {
  assert.equal(chargeBalanceLabel(charges[0]), 'Partially paid');
  assert.equal(chargeBalanceLabel(charges[1]), 'Outstanding');
  assert.equal(chargeBalanceLabel({ ...charges[0], paid: 100, remaining: 0 }), 'Balance settled');
  assert.equal(chargeBalanceLabel({ ...charges[0], paid: 0, remaining: 75, payments: [{ id: 7, amount: 75, status: 'Processing', paymentDate: null }] }), 'Outstanding');
});
test('charge due dates preserve the server calendar day without local timezone drift', () => {
  assert.equal(chargeDate('2026-11-01'), 'Nov 1, 2026');
  assert.equal(chargeDate('2026-11-01T00:00:00Z'), 'Nov 1, 2026');
  assert.equal(chargeDate(null), '—');
});
test('tenant scoped API routes and exact envelope shapes', async () => {
  const calls = [];
  const api = createTenantPaymentsAPI({
    get: async (url) => { calls.push(['GET', url]); if (url.includes('my-leases')) return { success: true, data: [lease] }; if (url.includes('my-rent')) return { success: true, data: { rentRecords: [rent] } }; if (url.includes('tenant-history')) return [{ id: 'payment:1', leaseId: 17, amount: 20, status: 'Paid', creditsRent: true }]; if (url.includes('readiness')) return { allowed: true, blockers: [] }; return { publishableKey: 'pk_test_abc' }; },
    post: async (url, body) => { calls.push(['POST', url, body]); return { success: true, data: { clientSecret: 'pi_abc_secret_xyz', paymentIntentId: 'pi_abc' } }; },
  });
  assert.deepEqual(await api.leases(), [lease]);
  assert.deepEqual(await api.rent(17), rent);
  assert.equal((await api.history(17))[0].status, 'Paid');
  assert.equal((await api.readiness()).allowed, true);
  assert.equal(await api.publishableKey(), 'pk_test_abc');
  assert.equal((await api.createIntent(17, 825.75, '123e4567-e89b-42d3-a456-426614174000')).paymentIntentId, 'pi_abc');
  assert.deepEqual(calls, [
    ['GET', '/api/lease/tenant/my-leases'], ['GET', '/api/rent-collection/tenant/my-rent?leaseId=17'],
    ['GET', '/api/payment/17/tenant-history'], ['GET', '/api/feature-readiness/rent-payments/pay'],
    ['GET', '/api/stripe/publishable-key'], ['POST', '/api/stripe/create-payment-intent', { leaseId: 17, amount: 825.75, operationId: '123e4567-e89b-42d3-a456-426614174000' }],
  ]);
});
test('malformed responses, invalid ids/amounts and closed readiness fail closed', async () => {
  const api = createTenantPaymentsAPI({ get: async () => ({ success: false, data: [lease] }), post: async () => ({ success: false }) });
  await assert.rejects(api.leases());
  await assert.rejects(api.rent(0));
  await assert.rejects(api.history('../1'));
  await assert.rejects(api.createIntent(17, 0, 'abc'));
  await assert.rejects(api.createIntent(17, 1, 'abc'));
  assert.equal(canPayRent(lease, rent, { allowed: false, blockers: [{ message: 'Setup required' }] }), false);
});
test('bill is server rent due only, never lease face rent, fees or other lease', () => {
  assert.deepEqual(billForLease(lease, rent), { amount: 825.75, dueDate: '2026-11-01T00:00:00Z', leaseId: 17 });
  assert.equal(billForLease(lease, { ...rent, leaseId: 18 }), null);
  assert.equal(canPayRent(lease, rent, { allowed: true, blockers: [] }), true);
  assert.equal(canPayRent(lease, { ...rent, rentDue: 0 }, { allowed: true, blockers: [] }), false);
  assert.equal(canPayRent({ ...lease, rentCollectionByPlatform: false }, rent, { allowed: true, blockers: [] }), false);
});
test('single-family homes omit unit labels and only server-confirmed outstanding rent is late', () => {
  assert.equal(leaseHomeLabel({ ...lease, propertyType: 'SingleFamily' }), 'Oak House');
  assert.equal(leaseHomeLabel({ ...lease, propertyType: 'Single Family' }), 'Oak House');
  assert.equal(leaseHomeLabel({ ...lease, propertyType: 'MultiUnit' }), 'Oak House · 2B');
  assert.equal(leaseHomeLabel(lease), 'Oak House · 2B');
  assert.equal(rentIsLate({ ...rent, rentDueIsOverdue: true }), true);
  assert.equal(rentIsLate({ ...rent, rentDueIsOverdue: false }), false);
  assert.equal(rentIsLate({ ...rent, rentDue: 0, rentDueIsOverdue: true }), false);
  assert.equal(rentIsLate(null), false);
});
test('only server-final rent payments credit totals, processing and local sheet success never do', () => {
  const history = [
    { amount: 20, status: 'Paid', creditsRent: true, paymentType: 'Rent' },
    { amount: 30, status: 'Completed', creditsRent: true, paymentType: 'Rent' },
    { amount: 40, status: 'Processing', creditsRent: false, paymentType: 'Rent' },
    { amount: 50, status: 'Created', creditsRent: true, paymentType: 'Rent' },
    { amount: 60, status: 'Paid', creditsRent: false, paymentType: 'Rent' },
    { amount: 70, status: 'Paid', creditsRent: true, paymentType: 'Fee' },
  ];
  assert.equal(creditedRentTotal(history), 50);
  assert.equal(paymentStatus(history[2]), 'Processing');
  assert.equal(paymentStatus({ status: 'Received' }), 'Received');
  assert.equal(paymentStatus({ status: 'bogus' }), 'Needs review');
});
