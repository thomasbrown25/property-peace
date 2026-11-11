import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { getPaymentTiming, loadPaymentTimings } from './paymentTiming.mjs';

const payment = { id: 12, leaseId: 7, amount: 100, status: 'Completed', paymentDate: '2026-03-02' };
const charge = (dueDate, amount = 100, overrides = {}) => ({
  type: 'Rent', chargeId: 'rent:7:2026-03-01', dueDate,
  payments: [{ id: 12, amount, status: 'Completed', paymentDate: payment.paymentDate }], ...overrides
});

test('payments before or on their allocated due day are on time, later payments are late', () => {
  assert.equal(getPaymentTiming(payment, [charge('2026-03-03')]), 'On time');
  assert.equal(getPaymentTiming(payment, [charge('2026-03-02T00:00:00')]), 'On time');
  assert.equal(getPaymentTiming(payment, [charge('2026-03-01')]), 'Late');
  assert.equal(getPaymentTiming({ ...payment, paymentDate: '2026-03-02T23:59:59-07:00' }, [
    { ...charge('2026-03-02'), payments: [{ ...charge().payments[0], paymentDate: '2026-03-02T23:59:59-07:00' }] }
  ]), 'On time');
});

test('allocation to older debt is late even if received early in a new month', () => {
  assert.equal(getPaymentTiming(payment, [charge('2026-02-01')]), 'Late');
  assert.equal(getPaymentTiming(payment, [charge('2026-02-01', 50), charge('2026-04-01', 50)]), 'Late');
});

test('failed, processing, reversed, zero and adjustment rows cannot look paid on time', () => {
  for (const status of ['Processing', 'Failed', 'Canceled', 'Refunded', 'Disputed', undefined]) {
    assert.equal(getPaymentTiming({ ...payment, status }, [charge('2026-03-03')]), null);
  }
  for (const amount of [0, -100]) assert.equal(getPaymentTiming({ ...payment, amount }, [charge('2026-03-03')]), null);
});

test('unknown, invalid, unmatched and incompletely allocated dates are not guessed', () => {
  for (const charges of [null, [], [charge(null)], [charge('2026-02-30')], [charge('2026-03-03', 50)], [charge('2026-03-03', 100, { payments: [] })]]) {
    assert.equal(getPaymentTiming(payment, charges), null);
  }
  assert.equal(getPaymentTiming({ ...payment, paymentDate: 'invalid' }, [charge('2026-03-03')]), null);
  assert.equal(getPaymentTiming({ ...payment, id: 99 }, [charge('2026-03-03')]), null);
  assert.equal(getPaymentTiming(payment, [charge('2026-03-03', 40), charge('2026-04-01', 60)]), 'On time');
});

test('partial rent receipts are evaluated against their allocated due date', () => {
  assert.equal(getPaymentTiming({ ...payment, amount: 25 }, [charge('2026-03-01', 25)]), 'Late');
  assert.equal(getPaymentTiming({ ...payment, amount: 25 }, [charge('2026-03-03', 25)]), 'On time');
});

test('fees and deposits use their own obligations and never unrelated receipt IDs', () => {
  assert.equal(getPaymentTiming({ ...payment, feeId: 9 }, [charge('2026-03-01', 100, { type: 'Fee', chargeId: 'fee:9' })]), 'Late');
  assert.equal(getPaymentTiming({ ...payment, feeId: 8 }, [charge('2026-03-01', 100, { type: 'Fee', chargeId: 'fee:9' })]), null);
  assert.equal(getPaymentTiming({ ...payment, depositId: 3 }, [charge('2026-03-03', 100, { type: 'Deposit' })]), 'On time');
  const receipt = charge('2026-03-01', 100, { type: 'Deposit', payments: [{ ...charge().payments[0], status: 'Received' }] });
  assert.equal(getPaymentTiming({ ...payment, depositId: 3 }, [receipt]), null);
  assert.equal(getPaymentTiming(payment, [charge('2026-03-01', 100, { type: 'Fee' })]), null);
});

test('fetches once per lease and isolates failures while retaining payment history', async () => {
  const requested = [];
  const payments = [payment, { ...payment, id: 13, leaseId: '7' }, { ...payment, leaseId: 8 }];
  const result = await loadPaymentTimings(payments, async id => {
    requested.push(id);
    if (id === '8') throw new Error('Unavailable');
    return [charge('2026-03-01')];
  });
  assert.deepEqual(requested, ['7', '8']);
  assert.equal(result.timingError, true);
  assert.deepEqual(result.payments.map(row => row.paymentTiming), ['Late', null, null]);
  assert.equal(result.payments.length, 3);
  assert.equal(payment.paymentTiming, undefined);
  assert.deepEqual(await loadPaymentTimings([], () => assert.fail('No leases')), { payments: [], timingError: false });
  assert.equal((await loadPaymentTimings([payment], async () => ({}))).timingError, true);
});

test('table places timing after status only for payments, preserving expense actions and colspan', () => {
  const source = readFileSync(new URL('./PropertyFinanceTable.jsx', import.meta.url), 'utf8');
  const tab = readFileSync(new URL('./PaymentsTab.jsx', import.meta.url), 'utf8');
  for (const text of [source, tab]) parse(text, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(source, /<TableCell>Status<\/TableCell>\s*\{isPayments && <TableCell[^>]*>Payment timing<\/TableCell>\}/);
  assert.match(source, /\{isPayments && <TableCell[^>]*record\.paymentTiming/);
  assert.match(source, /record\.paymentTiming === 'Late' \? 'error.main' : record\.paymentTiming === 'On time' \? 'primary.main' : 'text.secondary'/);
  assert.match(source, /const columnCount = 6 \+ \(showUnit \? 1 : 0\)/);
  assert.match(source, /!isPayments && <TableCell align="center">Actions/);
  assert.match(tab, /await loadPaymentTimings/);
  assert.match(tab, /if \(!controller.signal.aborted\) setResult\(\{ propertyId, \.\.\.timing/);
  assert.match(tab, /Some payment timing could not be loaded/);
});
