import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/rentCollection/propertyOverdue.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', js)(module, module.exports);
const { propertyOverdueAmounts } = module.exports;

test('sums only canonical overdue rent per property and matches portfolio overdue', () => {
  const amounts = propertyOverdueAmounts({ summary: { overdue: 325.75 }, rentRecords: [
    { propertyId: 1, overdueAmount: 125.5, rentDue: 900, unpaidFees: [{ amount: 20 }] },
    { PropertyId: '1', OverdueAmount: 200.25 },
    { propertyId: 2, overdueAmount: 0, rentDue: 400 },
  ] });
  assert.equal(amounts.get('1'), 325.75);
  assert.equal(amounts.get('2'), 0);
  assert.equal(amounts.get('3') ?? 0, 0);
});
test('paid records clear their overdue amount', () => {
  assert.equal(propertyOverdueAmounts({ Summary: { Overdue: 0 }, RentRecords: [{ PropertyId: 1, OverdueAmount: 0 }] }).get('1'), 0);
});
test('incomplete or inconsistent records never claim paid', () => {
  for (const payload of [
    { summary: { overdue: 100 } },
    { summary: { overdue: 100 }, rentRecords: [{ propertyId: 1, rentDue: 100 }] },
    { summary: { overdue: 100 }, rentRecords: [{ propertyId: 1, overdueAmount: 0 }] },
    { summary: { overdue: 0 }, rentRecords: [{ overdueAmount: 0 }] },
  ]) assert.equal(propertyOverdueAmounts(payload), null);
});
test('dashboard rows replace unread count with overdue amount or paid and use rent response', () => {
  const screen = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  const rows = screen.slice(screen.indexOf('attentionProperties.map((item)'), screen.indexOf('</DashboardSection>', screen.indexOf('attentionProperties.map((item)')));
  assert.doesNotMatch(rows, /item\.unread|unread message/);
  assert.match(rows, /item\.overdueAmount > 0/);
  assert.match(rows, /Paid/);
  assert.match(screen, /propertyOverdueAmounts\(results\[3\]\.value\)/);
});
