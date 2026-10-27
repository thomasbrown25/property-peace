import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentRows, parseRentPayment } from '../src/features/tenantPayments/model.ts';
import { createTenantPaymentsAPI } from '../src/api/tenantPaymentsAPI.ts';

const lease = { id: 17, isActive: true, rentCollectionByPlatform: true, rentFrequency: 'Monthly', rentDueDay: 1, startDate: '2026-01-01', endDate: '2026-12-31' };
const rent = { leaseId: 17, rentDue: 200, rentDueIsOverdue: true, currentMonthRentDueDate: '2026-10-01' };
const installment = { chargeId: 'rent:17:2026-01-01', type: 'Rent', title: 'January rent', dueDate: '2026-01-01', amount: 200, remaining: 100, paid: 100, payments: [] };
const newer = { ...installment, chargeId: 'rent:17:2026-02-01', title: 'February rent', dueDate: '2026-02-01' };
const fee = { chargeId: 'fee:41', type: 'Fee', title: 'Pet fee', dueDate: '2026-02-01', amount: 75, remaining: 75, paid: 0, payments: [] };
const deposit = { ...fee, chargeId: 'deposit:pooled:17', type: 'Deposit' };
const today = new Date('2026-10-25T12:00:00Z');

test('two overdue rent installments display as one authoritative lease balance with separate fee and no deposit checkout', () => {
  const rows = paymentRows(lease, rent, [installment, newer, fee, deposit], today);
  assert.deepEqual(rows.map(r => [r.charge?.chargeId, r.route, r.payable, r.amount]), [
    [undefined, 'rent', true, 200], ['fee:41', 'fee', true, 75],
  ]);
  assert.equal(parseRentPayment('25.50', rows[0].amount), 25.5);
  assert.equal(parseRentPayment('200.01', rows[0].amount), null);
});
test('accruing or unmatched rent still displays only one authoritative rent balance', () => {
  for (const [l, r, c] of [
    [lease, { ...rent, rentDue: 250 }, [installment, newer]],
    [lease, { ...rent, rentDue: 100 }, [{ ...installment, chargeId: 'rent:17:2026-10-01', dueDate: '2026-10-01' }]],
    [{ ...lease, rentDueDay: 5 }, { ...rent, rentDue: 100 }, [installment]],
  ]) {
    const rows = paymentRows(l, r, c, today);
    assert.deepEqual(rows.map(x => x.route), ['rent']);
    assert.equal(rows[0].amount, r.rentDue);
    assert.equal(rows[0].charge, null);
  }
});
test('intent transport rejects foreign lease rent and deposit selectors', async () => {
  const calls = [];
  const api = createTenantPaymentsAPI({ get: async () => null, post: async (_url, body) => { calls.push(body); return { success: true, data: { clientSecret: 'pi_x_secret_y', paymentIntentId: 'pi_x' } }; } });
  const op = '123e4567-e89b-42d3-a456-426614174000';
  await api.createIntent(17, 25.5, op, installment.chargeId);
  assert.equal(calls[0].chargeId, installment.chargeId);
  await assert.rejects(api.createIntent(17, 25.5, op, 'rent:18:2026-01-01'), /Invalid selected charge/);
  await assert.rejects(api.createIntent(17, 25.5, op, 'deposit:pooled:17'), /Invalid selected charge/);
  assert.equal(calls.length, 1);
});
