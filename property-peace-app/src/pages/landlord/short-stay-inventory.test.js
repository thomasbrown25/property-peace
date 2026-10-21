import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createInventorySnapshot } from './short-stay-inventory.js';

const report = (unitId = 7, start = '2026-10-20', end = '2026-10-23') => ({
  unitId, start, end, timeZoneId: 'America/New_York', totalNights: 3,
  ownerBlockedNights: 1, airbnbBlockedNights: 1, overlapNights: 0, blockedNights: 2,
  unblockedNights: 1, pricedUnblockedNights: 1, unpricedUnblockedNights: 0,
  airbnbSyncStatus: 'stale', airbnbSyncStaleWarning: true,
  bookingMetricsAvailable: false, revenueMetricsAvailable: false, occupancyMetricsAvailable: false
});
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const harness = (api) => {
  let state = {};
  const controller = createInventorySnapshot({ api, unitId: 7, update: (change) => { state = { ...state, ...change }; } });
  controller.activate();
  return { controller, state: () => state };
};

test('inventory uses property-local keys, rejects invalid ranges without API calls, and never reports zero on failure', async () => {
  const calls = [];
  const h = harness({ getInventoryReport: async (...args) => { calls.push(args); return report(); } });
  await h.controller.load('2026-10-20', '2026-10-23');
  assert.deepEqual(calls, [[7, '2026-10-20', '2026-10-23']]);
  assert.deepEqual(h.state().report, report());
  await h.controller.load('2026-10-23', '2026-10-20');
  assert.equal(h.state().report, null);
  assert.match(h.state().error, /end after start/);
  assert.equal(calls.length, 1);
  h.controller.invalidate();
});

test('empty, mismatched, incomplete and failed responses clear the previous snapshot', async () => {
  let response = report();
  const h = harness({ getInventoryReport: async () => response });
  await h.controller.load('2026-10-20', '2026-10-23');
  for (response of [null, report(8), report(7, '2026-10-21'), { ...report(), unblockedNights: undefined }, { ...report(), pricedUnblockedNights: 0 }]) {
    await h.controller.load('2026-10-20', '2026-10-23');
    assert.equal(h.state().report, null);
    assert.ok(h.state().error);
  }
  response = Promise.reject(new Error('Service unavailable'));
  await h.controller.load('2026-10-20', '2026-10-23');
  assert.equal(h.state().report, null);
  assert.match(h.state().error, /Service unavailable/);
});

test('late responses cannot overwrite newer range, refresh, or an unmounted/switched unit', async () => {
  const pending = [];
  const h = harness({ getInventoryReport: () => { const item = deferred(); pending.push(item); return item.promise; } });
  const first = h.controller.load('2026-10-20', '2026-10-23');
  const second = h.controller.load('2026-10-21', '2026-10-24');
  pending[1].resolve(report(7, '2026-10-21', '2026-10-24'));
  await second;
  pending[0].resolve(report());
  await first;
  assert.equal(h.state().report.start, '2026-10-21');
  const third = h.controller.load('2026-10-21', '2026-10-24');
  assert.equal(h.state().report, null);
  h.controller.invalidate();
  pending[2].resolve(report(7, '2026-10-21', '2026-10-24'));
  await third;
  assert.equal(h.state().report, null);
});

test('web API and UI contract: read-only owner snapshot, no booking inference or checkout', async () => {
  const apiSource = (await readFile(new URL('../../api/shortStay.js', import.meta.url), 'utf8')).replace("import axios from 'utils/axios';", 'const axios = globalThis.__inventoryAxios;');
  const calls = [];
  globalThis.__inventoryAxios = { get: async (...args) => { calls.push(args); return { data: { success: true, data: report() } }; } };
  try {
    const { shortStayAPI } = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);
    assert.deepEqual(await shortStayAPI.getInventoryReport('7', '2026-10-20', '2026-10-23'), report());
    assert.deepEqual(calls, [['/api/short-stay/units/7/inventory-report', { params: { start: '2026-10-20', end: '2026-10-23' }, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }]]);
  } finally { delete globalThis.__inventoryAxios; }
  const page = await readFile(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
  assert.match(page, /<InventorySnapshotCard/);
  assert.match(page, /createInventorySnapshot/);
  assert.match(page, /refreshInventory\(start, end\)/);
  assert.match(page, /airbnbAction\(\(\) => airbnbController\.refresh\(\), true\)/);
  assert.doesNotMatch(page, /checkout-session|createCheckout|CheckoutButton/);
  const card = await readFile(new URL('./short-stay-inventory-card.jsx', import.meta.url), 'utf8');
  for (const phrase of ['Unblocked nights, not booked/occupancy', 'Priced unblocked nights', 'Unpriced unblocked nights', 'Booking metrics: Unavailable', 'Revenue metrics: Unavailable', 'Occupancy metrics: Unavailable', 'Airbnb imported availability may be out of date']) assert.ok(card.includes(phrase), phrase);
  assert.doesNotMatch(card, /checkout|Checkout|\$\{report\./);
});

test('snapshot card renders real zero counts only on valid response, and no counts while unavailable', async () => {
  const ts = createRequire(new URL('../../../../property-peace-mobile/package.json', import.meta.url))('typescript');
  const source = await readFile(new URL('./short-stay-inventory-card.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'h' } }).outputText;
  const exports = {};
  const h = (type, props, ...children) => ({ type, props, children });
  vm.runInNewContext(compiled, { exports, h, require: () => Object.fromEntries(['Alert', 'CircularProgress', 'Paper', 'Stack', 'Typography'].map(name => [name, name])) });
  const text = (node) => node == null || node === false ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.children) : String(node);
  const props = { start: '2026-10-20', end: '2026-10-23', timeZoneId: 'America/New_York' };
  const visible = text(exports.default({ ...props, snapshot: { report: report(), loading: false, error: '' } }));
  assert.match(visible, /Unblocked nights, not booked\/occupancy:\s+1/);
  assert.match(visible, /Airbnb imported availability may be out of date/);
  assert.match(visible, /Booking metrics: Unavailable/);
  const zero = text(exports.default({ ...props, snapshot: { report: { ...report(), blockedNights: 3, unblockedNights: 0, pricedUnblockedNights: 0, unpricedUnblockedNights: 0 }, loading: false, error: '' } }));
  assert.match(zero, /Unblocked nights, not booked\/occupancy:\s+0/);
  for (const snapshot of [{ report: null, loading: false, error: 'Service unavailable' }, { report: report(), loading: true, error: '' }, { report: report(7, '2026-10-21'), loading: false, error: '' }]) {
    const rendered = text(exports.default({ ...props, snapshot }));
    assert.doesNotMatch(rendered, /Unblocked nights, not booked\/occupancy:/);
  }
});
