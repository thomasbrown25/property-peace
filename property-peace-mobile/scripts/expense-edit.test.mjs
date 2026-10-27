import assert from 'node:assert/strict';
import test from 'node:test';
import { ExpenseAPI } from '../src/api/expenseAPI.ts';

test('expense edit fetches full DTO and PUTs same id without trusting summary fields', async () => {
  const calls = [];
  const detail = { id: 17, name: 'Repair', amount: 30, propertyId: 3, category: 'Repairs', expenseDate: '2026-08-22', isPaid: true, isRecurring: false };
  const api = new ExpenseAPI({
    async get(url) { calls.push(['get', url]); return { success: true, data: detail }; },
    async put(url, payload) { calls.push(['put', url, payload]); return { success: true, data: detail }; },
    async post() { throw Error('unexpected POST'); },
  });
  assert.deepEqual(await api.getExpense(17), detail);
  assert.deepEqual(await api.updateExpense(17, { id: 17, name: 'Repair' }), detail);
  assert.deepEqual(calls, [['get', '/api/Expense/17'], ['put', '/api/Expense/17', { id: 17, name: 'Repair' }]]);
  await assert.rejects(() => api.updateExpense(18, { id: 17 }), /mismatch/);
});
