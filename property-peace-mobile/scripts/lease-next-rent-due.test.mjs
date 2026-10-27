import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../src/features/leases/nextRentDueDate.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports, Date });
const { nextRentDueDate } = exports;
const lease = { startDate: '2026-01-10', endDate: '2027-01-31', rentDueDay: 15, rentFrequency: 'Monthly' };
const today = (value) => new Date(`${value}T12:00:00`);

test('next monthly rent date includes today and advances after the due day', () => {
  assert.equal(nextRentDueDate(lease, today('2026-10-14')), '2026-10-15');
  assert.equal(nextRentDueDate(lease, today('2026-10-15')), '2026-10-15');
  assert.equal(nextRentDueDate(lease, today('2026-10-16')), '2026-11-15');
});

test('respects start and end dates and never substitutes the lease end as a rent date', () => {
  assert.equal(nextRentDueDate({ ...lease, startDate: '2026-10-20' }, today('2026-10-01')), '2026-11-15');
  assert.equal(nextRentDueDate({ ...lease, endDate: '2026-10-14' }, today('2026-10-01')), null);
  assert.equal(nextRentDueDate({ ...lease, endDate: '2026-10-15' }, today('2026-10-16')), null);
});

test('clamps the 31st and handles leap years and month-end schedules', () => {
  const lateMonth = { ...lease, startDate: '2028-01-01', endDate: '2028-04-30', rentDueDay: 31 };
  assert.equal(nextRentDueDate(lateMonth, today('2028-02-01')), '2028-02-29');
  assert.equal(nextRentDueDate({ ...lateMonth, rentDueDay: -1 }, today('2028-02-29')), '2028-02-29');
  assert.equal(nextRentDueDate(lateMonth, today('2028-03-31')), '2028-03-31');
});

test('quarterly and yearly rent follow their own intervals, not every month', () => {
  assert.equal(nextRentDueDate({ ...lease, rentFrequency: 'Quarterly' }, today('2026-02-01')), '2026-04-15');
  assert.equal(nextRentDueDate({ ...lease, rentFrequency: 'Yearly' }, today('2026-02-01')), '2027-01-15');
});

test('missing or invalid terms cannot produce an invented rent date', () => {
  assert.equal(nextRentDueDate({ ...lease, rentDueDay: null }, today('2026-10-01')), null);
  assert.equal(nextRentDueDate({ ...lease, endDate: undefined }, today('2026-10-01')), null);
  assert.equal(nextRentDueDate({ ...lease, startDate: '2026-02-30' }, today('2026-10-01')), null);
  assert.equal(nextRentDueDate({ ...lease, rentFrequency: 'Weekly' }, today('2026-10-01')), null);
});
