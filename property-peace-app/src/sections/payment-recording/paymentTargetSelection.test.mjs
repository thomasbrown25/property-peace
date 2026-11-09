import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { getLatestActivePaymentTarget } from './paymentTargetSelection.mjs';

const target = (id, propertyId, startDate, isRecordable = true) => ({
  leaseId: id, propertyId, isRecordable, lease: { id, startDate }
});

test('latest active lease is property-scoped and independent of unit/list order', () => {
  const older = target(1, 7, '2020-01-01');
  const latest = target(2, '7', '2024-01-01');
  const elsewhere = target(3, 8, '2025-01-01');
  const inactive = target(4, 7, '2026-01-01', false);
  for (const targets of [[older, latest, elsewhere, inactive], [inactive, elsewhere, latest, older]]) {
    assert.equal(getLatestActivePaymentTarget(targets, 7), latest);
  }
  assert.equal(getLatestActivePaymentTarget([older], 7), older);
  assert.equal(getLatestActivePaymentTarget([elsewhere, inactive], 7), null);
  assert.equal(getLatestActivePaymentTarget([older], null), null);
  assert.equal(getLatestActivePaymentTarget([], 7), null);
  assert.equal(getLatestActivePaymentTarget([target(5, 7, 'invalid')], 7), null);
  const pascal = { ...latest, lease: { Id: 2, StartDate: '2024-01-01' } };
  assert.equal(getLatestActivePaymentTarget([older, pascal], 7), pascal);
});

// Exercise the real selector/effects using lightweight hook and UI stubs.
const source = readFileSync(new URL('./TenantPaymentSelector.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '')
  .replace('export default function', 'function').replace(/TenantPaymentSelector\.propTypes = [\s\S]*$/, ''), { loader: 'jsx' }).code;
function harness() {
  let effects = [];
  const ref = { current: false };
  let fetch = { properties: [], isLoading: true };
  let state = {};
  const calls = [];
  const stub = () => null;
  const names = ['React', 'useEffect', 'useMemo', 'useRef', 'useTheme', 'useFetchProperties',
    'getLatestActivePaymentTarget', 'isDetachedSingleUnitType', 'Box', 'Typography', 'CircularProgress',
    'Alert', 'TextField', 'Stack', 'Chip', 'alpha', 'Autocomplete'];
  const Selector = new Function(...names, `${compiled}; return TenantPaymentSelector;`)(
    { createElement: stub }, fn => effects.push(fn), fn => fn(), () => ref,
    () => ({ palette: { grey: {}, primary: {} } }), () => fetch,
    getLatestActivePaymentTarget, () => false, ...Array(9).fill(stub));
  const callbacks = {
    onSelectTenant: tenant => { state.tenant = tenant; },
    onSelectProperty: property => { state.selectedProperty = property; },
    onSelectUnit: unit => { state.selectedUnit = unit; },
    onConfirmLease: lease => { state.selectedLease = lease; calls.push(lease); }
  };
  return {
    render(overrides = {}, data) {
      if (data) fetch = data;
      effects = [];
      Selector({ ...state, ...callbacks, ...overrides });
      effects.forEach(fn => fn());
      return state;
    },
    clear() { state = {}; }, calls
  };
}
const lease = (id, startDate, extra = {}) => ({ id, startDate, isActive: true, endDate: '2099-12-31', ...extra });
const property = { id: 7, name: 'Property', units: [
  { id: 71, lease: lease(1, '2000-01-01') },
  { id: 72, leases: [lease(2, '2001-01-01'), lease(3, '2090-01-01'),
    lease(4, '2005-01-01', { isDeleted: true }), lease(5, '2006-01-01', { isDrafted: true }),
    lease(6, '2007-01-01', { isActive: false }), lease(7, '2008-01-01', { endDate: '2009-01-01' })] }
] };

test('context waits for options and selects the latest eligible unit/lease, not future/draft/deleted/expired', () => {
  const h = harness();
  h.render({ autoSelectPropertyId: 7 });
  assert.equal(h.calls.length, 0);
  const state = h.render({ autoSelectPropertyId: 7 }, { properties: [property], isLoading: false });
  assert.equal(state.selectedLease.id, 2);
  assert.equal(state.selectedUnit.id, 72);
  assert.equal(state.selectedProperty.id, 7);
});

test('global opens do not default; explicit selections and manual clearing are preserved', () => {
  const h = harness();
  h.render({}, { properties: [property], isLoading: false });
  assert.equal(h.calls.length, 0);
  h.render({ autoSelectPropertyId: 7, selectedLease: lease(1, '2000-01-01') });
  assert.equal(h.calls.at(-1).id, 1); // Existing selection hydration, not a new default.
  h.calls.length = 0;
  h.clear();
  h.render({ autoSelectPropertyId: 7 });
  assert.equal(h.calls.length, 0);
  h.render({ autoSelectPropertyId: null }); // closing resets one-time initialization
  h.render({ autoSelectPropertyId: 7 });
  assert.equal(h.calls.at(-1).id, 2);
  h.clear();
  h.render({ autoSelectPropertyId: 7 }, { properties: [{ ...property }], isLoading: false });
  assert.equal(h.calls.length, 1);
});

test('no eligible lease stays empty and never selects a different property', () => {
  const h = harness();
  h.render({ autoSelectPropertyId: 9 }, { properties: [property], isLoading: false });
  assert.equal(h.calls.length, 0);
});

test('property entry points pass context; drawer waits for context hydration and resets context on close', () => {
  for (const file of ['PaymentsTab.jsx', 'PropertyHeader.jsx', 'PropertyQuickActionsPanel.jsx']) {
    const code = readFileSync(new URL(`../landlord/property/${file}`, import.meta.url), 'utf8');
    assert.match(code, /openPaymentAddDrawer\(\{ property: property \|\| \{ id: propertyId \} \}\)/);
  }
  const drawer = readFileSync(new URL('../../components/drawers/RecordPaymentDrawer.jsx', import.meta.url), 'utf8');
  assert.match(drawer, /autoSelectPropertyId=\{drawer\.isOpenPaymentAdd && selectedProperty/);
});
