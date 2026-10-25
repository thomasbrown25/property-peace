import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chargePresentation, leaseChargeOptions, readChargesResponse } from './leaseCharges.js';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('charge presentation retains server supplied balances and linked payment activity', () => {
  const charge = { chargeId: 17, type: 'Fee', title: 'Pet fee', dueDate: '2026-11-01', amount: 125, paid: 25, remaining: 100,
    payments: [{ id: 5, amount: 25, status: 'Completed', paymentDate: '2026-10-20' }] };
  assert.deepEqual(chargePresentation(charge), { ...charge, isRent: false, canPay: false, isPooledDeposit: false });
  assert.equal(chargePresentation({ ...charge, type: 'Rent', remaining: 60 }).canPay, true);
  assert.equal(chargePresentation({ ...charge, type: 'Deposit', remaining: 0 }).canPay, false);
});

test('charge response rejects malformed data instead of claiming no charges', () => {
  assert.deepEqual(readChargesResponse({ success: true, data: [] }), []);
  assert.deepEqual(readChargesResponse([{ chargeId: 2 }]), [{ chargeId: 2 }]);
  assert.throws(() => readChargesResponse({ success: false }), /unavailable/i);
});

test('landlord lease choices honor selected property and unit and exclude draft units', () => {
  const properties = [{ id: 1, name: 'One', units: [{ id: 3, name: 'A', lease: { id: 11 } }, { id: 4 }] },
    { id: 2, name: 'Two', units: [{ id: 5, lease: { id: 12 } }] }];
  assert.deepEqual(leaseChargeOptions(properties, 1, 3).map((option) => option.id), [11]);
  assert.deepEqual(leaseChargeOptions(properties).map((option) => option.id), [11, 12]);
});

test('tenant charges are read-only while the separate lease-wide rent checkout remains available', async () => {
  const tenant = await source('../pages/tenant/payments.jsx');
  assert.match(tenant, /\/api\/payment\/\$\{leaseId\}\/tenant-charges/);
  assert.doesNotMatch(tenant, /onPayRent=|canPayRent=/);
  assert.match(tenant, /<LeaseChargeList[\s\S]*?onRetry=\{\(\) => setChargeRefresh/);
  assert.match(tenant, /onClick=\{openPaymentForSelectedLease\}[\s\S]*?Make Payment/);
  assert.match(tenant, /useRentPaymentActionReadiness\('Pay'\)/);
});

test('landlord loads selected lease charges without altering existing payment ledger', async () => {
  const landlord = await source('../sections/landlord/finances/PaymentsTab.jsx');
  const finances = await source('../pages/landlord/finances.jsx');
  assert.match(landlord, /\/api\/payment\/\$\{selectedChargeLeaseId\}\/charges/);
  assert.match(landlord, /<LeaseChargeList/);
  assert.match(landlord, /<PaymentRow/);
  assert.match(finances, /properties=\{properties\}/);
});

test('charge rows keep deposit and rent read-only; tenant fee action is separately gated', async () => {
  const list = await source('../components/payments/LeaseChargeList.jsx');
  assert.doesNotMatch(list, /onPayRent|canPayRent|Pay \{String\(charge\.type/);
  assert.match(list, /onPayFee && charge\.canPayFee/);
  assert.match(list, /Deposits cannot be paid online here/);
  assert.match(list, /charge\.payments/);
  assert.match(list, /charge\.remaining/);
  assert.match(list, /onRetry && <Button[^>]*onClick=\{onRetry\}>Refresh balances<\/Button>/);
  assert.match(list, /only after.*confirmation/i);
});

test('pooled deposit is labeled as a combined lease balance, not an individual deposit bill', async () => {
  const list = await source('../components/payments/LeaseChargeList.jsx');
  assert.equal(chargePresentation({ chargeId: 'deposit:pooled:42', type: 'Deposit', title: 'Deposits' }).isPooledDeposit, true);
  assert.equal(chargePresentation({ chargeId: 'deposit:9', type: 'Deposit' }).isPooledDeposit, false);
  assert.match(list, /charge\.isPooledDeposit/);
  assert.match(list, /Combined deposits/);
  assert.match(list, /credited to the combined balance/);
  assert.match(list, /Lease start/);
});

test('lease switches never display charges from the previously selected lease', async () => {
  const tenant = await source('../pages/tenant/payments.jsx');
  const landlord = await source('../sections/landlord/finances/PaymentsTab.jsx');
  assert.match(tenant, /chargeResultLeaseId === selectedLeaseId \? charges : \[\]/);
  assert.match(landlord, /chargeResultLeaseId === selectedChargeLeaseId \? charges : \[\]/);
});
