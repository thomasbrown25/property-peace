import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/screens/landlord/ShortStayOwnerScreen.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const helpers = require('../src/features/properties/shortStayOwner.ts');
const modes = require('../src/features/properties/rentalMode.ts');
const photoHelpers = require('../src/features/properties/shortStayPhotos.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function harness(overrides = {}) {
  const calls = { putListing: [], putTimeZone: [], putGuidebookDraft: [], deleteGuidebookDraft: [], getCalendar: [], getInventoryReport: [], deleteBlock: [], deleteRate: [], putRateRange: [], connectAirbnb: [], refreshAirbnb: [], disconnectAirbnb: [], alerts: [] };
  const api = {
    getTimeZone: async () => ({ timeZoneId: 'UTC' }), getListing: async () => null, getPhotos: async () => [], getGuidebookDraft: async () => null,
    putGuidebookDraft: async (...args) => { calls.putGuidebookDraft.push(args); return { unitId: 2, ...args[1] }; },
    deleteGuidebookDraft: async (...args) => { calls.deleteGuidebookDraft.push(args); return true; },
    putListing: async (...args) => { calls.putListing.push(args); const form = args[1]; return { ...draft, lodgingTaxRatePercent: form.lodgingTaxRatePercent === '' ? null : Number(form.lodgingTaxRatePercent), taxPolicyAttestedAtUtc: form.attestLodgingTaxResponsibility ? '2026-10-21T12:00:00Z' : null, taxPolicyAttestedByUserId: form.attestLodgingTaxResponsibility ? 42 : null }; },
    putTimeZone: async (...args) => { calls.putTimeZone.push(args); },
    getCalendar: async (...args) => { calls.getCalendar.push(args); return { timeZoneId: 'UTC', blocks: [], nights: [], startDate: args[1], endDate: args[2] }; },
    getInventoryReport: async (...args) => { calls.getInventoryReport.push(args); return { ...inventory, start: args[1], end: args[2] }; },
    deleteBlock: async (...args) => { calls.deleteBlock.push(args); },
    deleteRate: async (...args) => { calls.deleteRate.push(args); },
    getAirbnb: async () => ({ enabled: false, health: 'disabled', timeZoneId: 'UTC' }),
    connectAirbnb: async (...args) => { calls.connectAirbnb.push(args); return { enabled: true, health: 'never_synced', timeZoneId: 'UTC' }; },
    refreshAirbnb: async (...args) => { calls.refreshAirbnb.push(args); return { enabled: true, health: 'never_synced', timeZoneId: 'UTC' }; },
    disconnectAirbnb: async (...args) => { calls.disconnectAirbnb.push(args); return { enabled: false, health: 'disabled', timeZoneId: 'UTC' }; },
    addBlock: async () => {}, putRate: async () => {}, putRateRange: async (...args) => { calls.putRateRange.push(args); }, ...overrides.api,
  };
  const property = { getUnits: async () => [{ id: '2', rentalMode: 'ShortTerm' }], ...overrides.property };
  let slots = [], index = 0, pending = [], tree;
  let route = { propertyId: '1', unitId: '2', unitName: 'Unit' };
  const componentSlots = new Map();
  const invoke = (type, props) => {
    const previousSlots = slots, previousIndex = index;
    slots = componentSlots.get(type) ?? [];
    componentSlots.set(type, slots);
    index = 0;
    const result = type(props);
    slots = previousSlots; index = previousIndex;
    return result;
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const state = slots, slot = index++; if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial; return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }]; },
    useRef(initial) { const state = slots, slot = index++; return state[slot] ??= { current: initial }; },
    useCallback(fn, deps) { const state = slots, slot = index++; if (!state[slot] || deps.some((dep, i) => dep !== state[slot].deps[i])) state[slot] = { fn, deps }; return state[slot].fn; },
    useEffect(fn, deps) { const state = slots, slot = index++; if (!state[slot] || deps.some((dep, i) => dep !== state[slot].deps[i])) { state[slot]?.cleanup?.(); state[slot] = { deps }; pending.push(() => { state[slot].cleanup = fn(); }); } },
  };
  const stubs = {
    react: { __esModule: true, default: react, ...react },
    'react-native': Object.fromEntries(['ActivityIndicator', 'Alert', 'AppState', 'Image', 'ScrollView', 'StyleSheet', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name])),
    'expo-image-picker': { UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' } },
    '@react-navigation/native': { useNavigation: () => ({ setOptions() {}, addListener: () => () => {} }), useRoute: () => ({ params: route }) },
    '../../api/shortStayAPI': { __esModule: true, default: api },
    '../../api/propertyAPI': { __esModule: true, default: property },
    '../../features/properties/rentalMode': modes,
    '../../features/properties/shortStayOwner': helpers,
    '../../features/properties/shortStayPhotos': photoHelpers,
    './ShortStayCollectionSection': { __esModule: true, default: () => null },
    '../../theme/AppTheme': { useAppTheme: () => ({ colors: { background: '#fff', text: '#000', muted: '#aaa', accent: '#00f' } }) },
  };
  stubs['react-native'].StyleSheet = { create: x => x };
  stubs['react-native'].Alert = { alert: (...args) => { calls.alerts.push(args); } };
  stubs['react-native'].AppState = { addEventListener: () => ({ remove() {} }) };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: id => { if (!(id in stubs)) throw Error(`Missing mock: ${id}`); return stubs[id]; } });
  const Screen = exports.default;
  function render() { index = 0; tree = Screen(); nodes(); const effects = pending; pending = []; for (const effect of effects) effect(); return tree; }
  function nodes(node) { if (arguments.length === 0) node = tree; if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (!node || typeof node !== 'object') return []; if (typeof node.type === 'function') return nodes(invoke(node.type, node.props)); return [node, ...nodes(node.props.children)]; }
  function button(label) { return nodes().find(n => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === label); }
  function field(label) { return nodes().find(n => n.type === 'TextInput' && n.props.accessibilityLabel === label); }
  return { render, button, field, nodes, calls, api, property, setRoute: value => { route = value; } };
}
const draft = { nightlyBasePrice: 120, minimumNights: 2, capacity: 3, cleaningFee: 0, checkInTime: null, checkOutTime: null, houseRules: 'original', amenities: null, cancellationPolicy: null };
const calendar = { timeZoneId: 'UTC', blocks: [{ id: 7, startDate: '2026-12-01', endDate: '2026-12-02', reason: 'Owner use', source: 'OwnerBlock' }], nights: [{ date: '2026-12-01', effectiveRate: 120, overrideRate: 130 }], startDate: '2026-12-01', endDate: '2026-12-03' };
const inventory = { unitId: 2, timeZoneId: 'UTC', snapshotAtUtc: '2026-12-01T01:00:00Z', totalNights: 2, ownerBlockedNights: 1, airbnbBlockedNights: 1, overlapNights: 1, blockedNights: 1, unblockedNights: 1, pricedUnblockedNights: 1, unpricedUnblockedNights: 0, airbnbSyncStatus: 'stale', airbnbSyncStaleWarning: true, bookingMetricsAvailable: false, revenueMetricsAvailable: false, occupancyMetricsAvailable: false };
const text = h => h.nodes().filter(n => n.type === 'Text').map(n => n.props.children).flat(Infinity).filter(x => typeof x === 'string' || typeof x === 'number').join(' ');
test('pricing fields hydrate existing draft and survive unrelated save with tax attestation', async () => {
  const existing = { ...draft, weekendNightlyRate: 175.25, weeklyDiscountPercent: 12.5, monthlyDiscountPercent: 20, lodgingTaxRatePercent: 8.25, taxPolicyAttestedAtUtc: '2026-10-20T12:00:00Z', taxPolicyAttestedByUserId: 9 };
  const h = harness({ api: { getListing: async () => existing } }); h.render(); await tick(); h.render();
  assert.equal(h.field('Weekend nightly rate (optional)').props.value, '175.25');
  assert.equal(h.field('Weekly discount (%)').props.value, '12.5');
  assert.equal(h.field('Monthly discount (%)').props.value, '20');
  assert.match(text(h), /Friday and Saturday/);
  assert.match(text(h), /monthly.*28.*weekly/i);
  assert.match(text(h), /booking.*disabled/i);
  h.field('House rules').props.onChangeText('No pets'); h.render();
  h.button('Save listing draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putListing[0][1].weekendNightlyRate, '175.25');
  assert.equal(h.calls.putListing[0][1].monthlyDiscountPercent, '20');
  assert.equal(h.calls.putListing[0][1].lodgingTaxRatePercent, '8.25');
  h.field('Weekly discount (%)').props.onChangeText('100'); h.render();
  assert.equal(h.button('Save listing draft').props.disabled, true);
});
test('calendar identifies server-selected weekend price without making it a removable override', async () => {
  const h = harness({ api: { getCalendar: async () => ({ ...calendar, nights: [{ date: '2026-12-04', baseRate: 120, effectiveRate: 175, overrideRate: null, priceSource: 'Weekend' }] }) } });
  h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-04'); h.render();
  h.field('View until (exclusive)').props.onChangeText('2026-12-05'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  assert.match(text(h), /2026-12-04.*175.*weekend/i);
  assert.equal(h.button('Reset rate'), undefined);
});
test('range override validates end-exclusive dates and refreshes loaded calendar and inventory', async () => {
  const h = harness(); h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render(); h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  h.field('Range start').props.onChangeText('2026-12-01'); h.render();
  h.field('Range end (exclusive)').props.onChangeText('2026-12-01'); h.render();
  h.field('Range nightly rate').props.onChangeText('155.50'); h.render();
  assert.equal(h.button('Save range rate override').props.disabled, true);
  h.field('Range end (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Save range rate override').props.onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.putRateRange, [['2', '2026-12-01', '2026-12-03', '155.50']]);
  assert.equal(h.calls.getCalendar.length, 2);
  assert.equal(h.calls.getInventoryReport.length, 2);
  assert.equal(h.field('Range nightly rate').props.value, '');
});
test('inventory snapshot loads for the selected local range and labels counts without booking metrics', async () => {
  const h = harness(); h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render();
  h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.getInventoryReport, [['2', '2026-12-01', '2026-12-03']]);
  assert.match(text(h), /Unblocked nights \(not booked\).*1/);
  assert.match(text(h), /Owner blocked nights.*1/);
  assert.match(text(h), /Airbnb blocked nights.*1/);
  assert.match(text(h), /Overlap nights.*1/);
  assert.match(text(h), /Priced unblocked nights.*1/);
  assert.match(text(h), /Airbnb availability may be stale/i);
  assert.doesNotMatch(text(h), /occupancy|revenue|guest booking/i);
});
test('inventory load failure never renders false zero; retry replaces error, changing range discards old response', async () => {
  const waiting = deferred(); let reads = 0;
  const h = harness({ api: { getInventoryReport: (...args) => { h.calls.getInventoryReport.push(args); return ++reads === 1 ? waiting.promise : reads === 2 ? Promise.reject(Error('offline')) : Promise.resolve({ ...inventory, start: args[1], end: args[2], unblockedNights: 2, airbnbSyncStaleWarning: false }); } } });
  h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render(); h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  h.field('View until (exclusive)').props.onChangeText('2026-12-04'); h.render();
  waiting.resolve({ ...inventory, start: '2026-12-01', end: '2026-12-03' }); await tick(); h.render();
  assert.doesNotMatch(text(h), /Unblocked nights \(not booked\)/);
  h.button('Load availability').props.onPress(); await tick(); h.render();
  assert.match(text(h), /Inventory snapshot unavailable/);
  assert.doesNotMatch(text(h), /Unblocked nights \(not booked\)/);
  h.button('Retry inventory snapshot').props.onPress(); await tick(); h.render();
  assert.match(text(h), /Unblocked nights \(not booked\).*2/);
});
test('inventory refreshes after block, rate and feed changes; stale route does not request report', async () => {
  const h = harness(); h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render(); h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  h.field('Block start').props.onChangeText('2026-12-01'); h.render(); h.field('Block end (exclusive)').props.onChangeText('2026-12-02'); h.render();
  h.button('Add owner block').props.onPress(); await tick(); h.render();
  h.field('Rate date').props.onChangeText('2026-12-01'); h.render(); h.field('Override rate').props.onChangeText('150'); h.render();
  h.button('Save rate override').props.onPress(); await tick(); h.render();
  h.field('Airbnb iCal URL').props.onChangeText('https://www.airbnb.com/calendar/ical/example.ics'); h.render();
  h.button('Connect Airbnb calendar').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.getInventoryReport.length, 4);
  const denied = harness({ property: { getUnits: async () => [{ id: '2', rentalMode: 'LongTerm' }] } });
  denied.render(); await tick(); denied.render();
  assert.equal(denied.calls.getInventoryReport.length, 0);
});
test('guidebook loads scoped values, saves only three plain text fields, and labels owner-only status', async () => {
  const h = harness({ api: { getGuidebookDraft: async id => { assert.equal(id, '2'); return { unitId: 2, houseRules: 'Quiet hours', arrivalOverview: 'Check-in at 3', localNotes: null }; } } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  assert.match(JSON.stringify(h.nodes()), /private owner draft.*not published to guests/i);
  assert.equal(h.field('Guidebook house rules').props.value, 'Quiet hours');
  assert.equal(h.field('Arrival overview').props.value, 'Check-in at 3');
  assert.equal(h.field('Local notes').props.value, '');
  h.field('Local notes').props.onChangeText('Nearby park'); h.render();
  h.button('Save guidebook draft').props.onPress(); await tick(); h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.putGuidebookDraft)), [['2', { houseRules: 'Quiet hours', arrivalOverview: 'Check-in at 3', localNotes: 'Nearby park' }]]);
});
test('failed guidebook load cannot save blanks; retry restores server text', async () => {
  let attempts = 0;
  const h = harness({ api: { getGuidebookDraft: async () => { if (!attempts++) throw Error('offline'); return { houseRules: 'Existing', arrivalOverview: null, localNotes: null }; } } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules'), undefined);
  assert.equal(h.button('Save guidebook draft'), undefined);
  assert.ok(h.button('Retry guidebook draft'));
  h.button('Retry guidebook draft').props.onPress(); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules').props.value, 'Existing');
});
test('guidebook enforces 2000 chars, reports failed save without discarding edits, retries', async () => {
  let attempts = 0;
  const h = harness({ api: { putGuidebookDraft: async (...args) => { h.calls.putGuidebookDraft.push(args); if (!attempts++) throw Error('offline'); return { unitId: 2, ...args[1] }; } } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  h.field('Guidebook house rules').props.onChangeText('x'.repeat(2001)); h.render();
  assert.equal(h.button('Save guidebook draft').props.disabled, true);
  assert.equal(h.field('Guidebook house rules').props.maxLength, 2000);
  h.field('Guidebook house rules').props.onChangeText('Email me at host@example.com'); h.render();
  assert.equal(h.button('Save guidebook draft').props.disabled, true);
  h.field('Guidebook house rules').props.onChangeText('Valid'); h.render();
  h.button('Save guidebook draft').props.onPress(); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules').props.value, 'Valid');
  assert.match(JSON.stringify(h.nodes()), /Could not save guidebook draft/);
  h.button('Save guidebook draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putGuidebookDraft.length, 2);
});
test('guidebook save rechecks unit mode before write', async () => {
  let mode = 'ShortTerm';
  const h = harness({ property: { getUnits: async () => [{ id: '2', rentalMode: mode }] } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  mode = 'LongTerm';
  h.button('Save guidebook draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putGuidebookDraft.length, 0);
});
test('discard only appears for an existing draft; blank save never deletes', async () => {
  const h = harness(); h.render(); await tick(); h.render(); await tick(); h.render();
  assert.equal(h.button('Discard guidebook draft'), undefined);
  h.button('Save guidebook draft').props.onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.deleteGuidebookDraft, []);
  assert.ok(h.button('Discard guidebook draft'));
  const waiting = deferred();
  const loading = harness({ api: { getGuidebookDraft: () => waiting.promise } });
  loading.render(); await tick(); loading.render();
  assert.equal(loading.button('Discard guidebook draft'), undefined);
  waiting.resolve({ houseRules: 'Existing' }); await tick(); loading.render();
  assert.ok(loading.button('Discard guidebook draft'));
});
test('discard warns permanently, cancel preserves edits; failure retains edits and retry clears on success', async () => {
  let failures = 1;
  const h = harness({ api: { getGuidebookDraft: async () => ({ houseRules: 'Saved', arrivalOverview: null, localNotes: null }), deleteGuidebookDraft: async (...args) => { h.calls.deleteGuidebookDraft.push(args); if (failures--) throw Error('offline'); return true; } } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  h.field('Arrival overview').props.onChangeText('Unsaved edit'); h.render();
  h.button('Discard guidebook draft').props.onPress();
  const alert = h.calls.alerts.at(-1);
  assert.match(`${alert[0]} ${alert[1]}`, /permanent/i);
  assert.equal(alert[2][0].style, 'cancel');
  assert.equal(alert[2][1].style, 'destructive');
  assert.deepEqual(h.calls.deleteGuidebookDraft, []);
  alert[2][0].onPress?.(); await tick(); h.render();
  assert.equal(h.field('Arrival overview').props.value, 'Unsaved edit');
  alert[2][1].onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.deleteGuidebookDraft, [['2']]);
  assert.equal(h.field('Arrival overview').props.value, 'Unsaved edit');
  assert.match(text(h), /Could not discard guidebook draft/);
  h.button('Discard guidebook draft').props.onPress(); h.calls.alerts.at(-1)[2][1].onPress(); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules').props.value, '');
  assert.equal(h.field('Arrival overview').props.value, '');
  assert.equal(h.button('Discard guidebook draft'), undefined);
  assert.match(text(h), /discarded/i);
});
test('discard rechecks unit mode; stale confirmation and late delete cannot overwrite another route', async () => {
  let mode = 'ShortTerm'; const waiting = deferred();
  const h = harness({ property: { getUnits: async () => [{ id: '2', rentalMode: mode }, { id: '3', rentalMode: 'ShortTerm' }] }, api: {
    getGuidebookDraft: async id => ({ houseRules: id === '2' ? 'Old' : 'New' }),
    deleteGuidebookDraft: async (...args) => { h.calls.deleteGuidebookDraft.push(args); return waiting.promise; },
  } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  h.button('Discard guidebook draft').props.onPress(); mode = 'LongTerm';
  h.calls.alerts.at(-1)[2][1].onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.deleteGuidebookDraft, []);
  mode = 'ShortTerm';
  h.button('Discard guidebook draft').props.onPress(); const staleConfirm = h.calls.alerts.at(-1)[2][1].onPress;
  h.setRoute({ propertyId: '9', unitId: '3', unitName: 'Other' }); h.render(); await tick(); h.render(); await tick(); h.render();
  staleConfirm(); await tick(); h.render();
  assert.deepEqual(h.calls.deleteGuidebookDraft, []);
  assert.equal(h.field('Guidebook house rules').props.value, 'New');
  h.button('Discard guidebook draft').props.onPress(); h.calls.alerts.at(-1)[2][1].onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.deleteGuidebookDraft, [['3']]);
  h.setRoute({ propertyId: '1', unitId: '2', unitName: 'Unit' }); h.render(); await tick(); h.render(); await tick(); h.render();
  waiting.resolve(true); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules').props.value, 'Old');
});
test('late guidebook GET cannot replace a new organization or unit editor', async () => {
  const waiting = deferred(); let reads = 0;
  const h = harness({ api: { getGuidebookDraft: async () => ++reads === 1 ? waiting.promise : { houseRules: 'Current org' } } });
  h.render(); await tick(); h.render();
  h.setRoute({ propertyId: '9', unitId: '2', unitName: 'New org' }); h.render(); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules').props.value, 'Current org');
  waiting.resolve({ houseRules: 'Old org' }); await tick(); h.render();
  assert.equal(h.field('Guidebook house rules').props.value, 'Current org');
});
test('new draft requires a save before photo gallery requests; existing draft exposes gallery', async () => {
  let reads = 0;
  const fresh = harness({ api: { getPhotos: async () => { reads++; return []; } } });
  fresh.render(); await tick(); fresh.render(); fresh.nodes();
  assert.equal(reads, 0);
  assert.ok(fresh.nodes().some(n => n.type === 'Text' && n.props.children.includes('Save the listing draft before adding photos.')));
  const existing = harness({ api: { getListing: async () => draft, getPhotos: async () => { reads++; return []; } } });
  existing.render(); await tick(); existing.render();
  assert.ok(existing.nodes().some(n => n.type === 'Text' && n.props.children.includes('Listing photos')));
});
test('tax control starts blank, requires explicit checkbox, and displays saved attestation', async () => {
  const h = harness(); h.render(); await tick(); h.render();
  assert.equal(h.field('Lodging tax rate (%)').props.value, '');
  assert.match(text(h), /Saved lodging tax rate: not configured/);
  assert.match(text(h), /does not calculate your tax obligations or remit lodging tax/);
  h.field('Base nightly rate').props.onChangeText('120'); h.render();
  h.button('Save listing draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putListing[0][1].lodgingTaxRatePercent, '');
  assert.equal(h.calls.putListing[0][1].attestLodgingTaxResponsibility, false);
  h.field('Lodging tax rate (%)').props.onChangeText('0'); h.render();
  assert.equal(h.button('Save listing draft').props.disabled, true);
  const checkbox = h.nodes().find(n => n.props.accessibilityRole === 'checkbox');
  assert.equal(checkbox.props.accessibilityState.checked, false);
  checkbox.props.onPress(); h.render();
  assert.equal(h.button('Save listing draft').props.disabled, false);
  h.button('Save listing draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putListing[1][1].lodgingTaxRatePercent, '0');
  assert.equal(h.calls.putListing[1][1].attestLodgingTaxResponsibility, true);
  assert.match(text(h), /Saved lodging tax rate:\s+0\s*%.*responsibility attested\s+2026-10-21T12:00:00Z\s+by user\s+42/);
});
test('existing attested tax is preserved on unrelated listing save', async () => {
  const existing = { ...draft, lodgingTaxRatePercent: 8.25, taxPolicyAttestedAtUtc: '2026-10-20T12:00:00Z', taxPolicyAttestedByUserId: 9 };
  const h = harness({ api: { getListing: async () => existing } }); h.render(); await tick(); h.render();
  assert.equal(h.field('Lodging tax rate (%)').props.value, '8.25');
  assert.equal(h.nodes().find(n => n.props.accessibilityRole === 'checkbox').props.accessibilityState.checked, true);
  h.field('House rules').props.onChangeText('No pets'); h.render();
  h.button('Save listing draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putListing[0][1].lodgingTaxRatePercent, '8.25');
  assert.equal(h.calls.putListing[0][1].attestLodgingTaxResponsibility, true);
  assert.match(text(h), /Saved lodging tax rate:\s+8.25\s*%/);
  h.field('Lodging tax rate (%)').props.onChangeText(''); h.render();
  assert.equal(h.button('Save listing draft').props.disabled, true);
});
test('clearing a persisted lodging tax rate requires confirmation before the server removes attestation', async () => {
  const existing = { ...draft, lodgingTaxRatePercent: 8.25, taxPolicyAttestedAtUtc: '2026-10-20T12:00:00Z', taxPolicyAttestedByUserId: 9 };
  const h = harness({ api: { getListing: async () => existing } }); h.render(); await tick(); h.render();
  h.field('Lodging tax rate (%)').props.onChangeText(''); h.render();
  h.nodes().find(n => n.props.accessibilityRole === 'checkbox').props.onPress(); h.render();
  h.button('Save listing draft').props.onPress(); await tick();
  assert.equal(h.calls.putListing.length, 0);
  assert.match(h.calls.alerts[0][1], /clear.*lodging tax rate.*attestation/i);
  const buttons = h.calls.alerts[0][2];
  buttons[0].onPress?.(); await tick();
  assert.equal(h.calls.putListing.length, 0);
  h.button('Save listing draft').props.onPress();
  h.calls.alerts[1][2][1].onPress(); await tick();
  assert.equal(h.calls.putListing.length, 1);
  assert.equal(h.calls.putListing[0][1].lodgingTaxRatePercent, '');
});
test('failed draft load hides editable form and save; retry resolves with server draft', async () => {
  let attempts = 0;
  const h = harness({ api: { getListing: async () => { if (!attempts++) throw Error('offline draft'); return draft; } } });
  h.render(); await tick(); h.render();
  assert.equal(h.button('Save listing draft'), undefined);
  assert.equal(h.field('Base nightly rate'), undefined);
  assert.ok(h.button('Retry loading draft'));
  h.button('Retry loading draft').props.onPress(); await tick(); h.render();
  assert.equal(h.field('Base nightly rate').props.value, '120');
  assert.equal(h.field('House rules').props.value, 'original');
  assert.equal(h.button('Save listing draft').props.disabled, false);
});
test('pending listing load never exposes default draft, even with saved zone', async () => {
  const waiting = deferred(); const h = harness({ api: { getListing: () => waiting.promise } });
  h.render(); await tick(); h.render();
  assert.equal(h.button('Save listing draft'), undefined);
  waiting.resolve(null); await tick(); h.render();
  assert.ok(h.field('Base nightly rate'));
  assert.equal(h.button('Save listing draft').props.disabled, true);
});
test('range edits hide stale block/rate actions and discard in-flight older responses', async () => {
  const waiting = deferred(); let request = 0;
  const h = harness({ api: { getCalendar: async () => ++request === 1 ? waiting.promise : calendar } });
  h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render();
  h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick();
  h.field('View from').props.onChangeText('2026-12-02'); h.render();
  waiting.resolve(calendar); await tick(); h.render();
  assert.equal(h.button('Remove block'), undefined);
  assert.equal(h.button('Reset rate'), undefined);
  h.button('Load availability').props.onPress(); await tick(); h.render();
  assert.ok(h.button('Remove block'));
  h.field('View until (exclusive)').props.onChangeText('2026-12-04'); h.render();
  assert.equal(h.button('Remove block'), undefined);
  assert.equal(h.button('Reset rate'), undefined);
  assert.equal(h.calls.deleteBlock.length, 0);
});
test('saving a new base rate refreshes visible nights', async () => {
  const h = harness({ api: { getListing: async () => draft, getCalendar: async (...args) => { h.calls.getCalendar.push(args); return calendar; } } });
  h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render();
  h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  h.field('Base nightly rate').props.onChangeText('150'); h.render();
  h.button('Save listing draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putListing.length, 1);
  assert.equal(h.calls.getCalendar.length, 2);
});
test('stale long-term route cannot write property-wide timezone', async () => {
  let currentMode = 'ShortTerm';
  const h = harness({ property: { getUnits: async () => [{ id: '2', rentalMode: currentMode }] }, api: { getListing: async () => draft } });
  h.render(); await tick(); h.render();
  currentMode = 'LongTerm';
  h.button('Save time zone').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.putTimeZone.length, 0);
  assert.ok(h.nodes().some(n => n.type === 'Text' && n.props.accessibilityRole === 'alert'));
});
test('converted unit is rejected before setup loads or any property-wide write is offered', async () => {
  let zoneReads = 0;
  const h = harness({ property: { getUnits: async () => [{ id: '2', rentalMode: 'LongTerm' }] }, api: { getTimeZone: async () => { zoneReads++; return { timeZoneId: 'UTC' }; } } });
  h.render(); await tick(); h.render();
  assert.equal(zoneReads, 0);
  assert.equal(h.button('Save time zone'), undefined);
  assert.ok(h.button('Try again'));
});
test('API OwnerBlock dates are labeled manual and removable; imported Airbnb dates are read-only', async () => {
  const h = harness({ api: { getCalendar: async () => ({ ...calendar, blocks: [
    { id: -9, startDate: '2026-12-01', endDate: '2026-12-02', source: 'Airbnb', reason: null },
    calendar.blocks[0],
  ] }) } });
  h.render(); await tick(); h.render();
  h.field('View from').props.onChangeText('2026-12-01'); h.render();
  h.field('View until (exclusive)').props.onChangeText('2026-12-03'); h.render();
  h.button('Load availability').props.onPress(); await tick(); h.render();
  assert.equal(h.nodes().filter(n => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === 'Remove block').length, 1);
  const rows = h.nodes().filter(n => n.type === 'View' && n.props.style?.flexDirection === 'row');
  const imported = rows.find(row => JSON.stringify(row.props.children).includes('Airbnb · read-only'));
  const manual = rows.find(row => JSON.stringify(row.props.children).includes('Manual block'));
  assert.ok(imported);
  assert.ok(manual);
  assert.match(JSON.stringify(manual.props.children), /Owner use/);
  assert.doesNotMatch(JSON.stringify(imported.props.children), /Remove block/);
  assert.match(JSON.stringify(manual.props.children), /Remove block/);
  h.button('Remove block').props.onPress();
  h.calls.alerts.at(-1)[2][1].onPress(); await tick();
  assert.deepEqual(h.calls.deleteBlock, [['2', 7]]);
});
test('connection secret is cleared on success, refresh is queued, disconnect confirms and clears calendar', async () => {
  const h = harness(); h.render(); await tick(); h.render(); await tick(); h.render();
  assert.ok(h.field('Airbnb iCal URL'));
  h.field('Airbnb iCal URL').props.onChangeText('https://www.airbnb.com/calendar/ical/secret.ics'); h.render();
  h.button('Connect Airbnb calendar').props.onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.connectAirbnb, [['2', 'https://www.airbnb.com/calendar/ical/secret.ics']]);
  assert.equal(h.field('Airbnb iCal URL').props.value, '');
  assert.ok(h.button('Queue Airbnb refresh'));
  h.button('Queue Airbnb refresh').props.onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.refreshAirbnb, [['2']]);
  h.button('Disconnect Airbnb calendar').props.onPress();
  assert.equal(h.calls.alerts.at(-1)[1].includes('clears imported dates'), true);
  assert.equal(h.calls.disconnectAirbnb.length, 0);
  h.calls.alerts.at(-1)[2][1].onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.disconnectAirbnb, [['2']]);
});
test('stale status displays timezone-aware sync history and warning; replacement is supported', async () => {
  const h = harness({ api: { getAirbnb: async () => ({ enabled: true, health: 'stale', timeZoneId: 'America/New_York', lastAttemptAtUtc: '2026-12-01T02:30:00Z', lastSuccessAtUtc: '2026-11-28T02:30:00Z', nextAttemptAtUtc: null }) } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  assert.ok(h.button('Replace Airbnb calendar'));
  assert.ok(h.button('Reload Airbnb status'));
  assert.ok(h.nodes().some(n => n.type === 'Text' && /Nov 30, 2026.*9:30 PM/.test(JSON.stringify(n.props.children))));
  assert.ok(h.nodes().some(n => n.type === 'Text' && n.props.accessibilityRole === 'alert' && JSON.stringify(n.props.children).includes('stale')));
});

test('failed connect never shows URL or backend error and stale route prevents connect', async () => {
  let mode = 'ShortTerm';
  const h = harness({ property: { getUnits: async () => [{ id: '2', rentalMode: mode }] }, api: { connectAirbnb: async () => { throw Error('https://www.airbnb.com/calendar/ical/secret.ics'); } } });
  h.render(); await tick(); h.render(); await tick(); h.render();
  assert.ok(h.field('Airbnb iCal URL'));
  h.field('Airbnb iCal URL').props.onChangeText('https://www.airbnb.com/calendar/ical/secret.ics'); h.render();
  h.button('Connect Airbnb calendar').props.onPress(); await tick(); h.render();
  assert.equal(h.nodes().some(n => n.type === 'Text' && JSON.stringify(n.props.children).includes('secret.ics')), false);
  mode = 'LongTerm';
  h.button('Connect Airbnb calendar').props.onPress(); await tick(); h.render();
  assert.ok(h.nodes().some(n => n.type === 'Text' && n.props.accessibilityRole === 'alert'));
});
