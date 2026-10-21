import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyDateWindow, createShortStaySetupLoader } from './shortStaySetupLoader.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const harness = (api, propertyId = '1', unitId = '2') => {
  const state = {};
  const loader = createShortStaySetupLoader({ api, propertyId, unitId, update: (change) => Object.assign(state, change), now: () => new Date('2026-01-01T01:00:00Z') });
  return { state, loader };
};

test('property-local date rather than browser day, rollover, and fail-closed missing/invalid zone', () => {
  assert.deepEqual(propertyDateWindow('America/Los_Angeles', new Date('2026-01-01T01:00:00Z')), { start: '2025-12-31', end: '2026-01-30' });
  assert.deepEqual(propertyDateWindow('Pacific/Auckland', new Date('2026-01-01T23:30:00Z')), { start: '2026-01-02', end: '2026-02-01' });
  assert.throws(() => propertyDateWindow(''), /IANA/);
  assert.throws(() => propertyDateWindow('Not/A_Zone'), /IANA/);
});

test('mismatched unit URL never fetches zone, listing or calendar or exposes editor', async () => {
  let fetched = false;
  const { state, loader } = harness({ getUnits: async () => [{ id: 3 }], getTimeZone: async () => { fetched = true; } });
  await loader.load();
  assert.equal(fetched, false);
  assert.equal(state.timeZoneId, '');
  assert.equal(state.draft, null);
  assert.match(state.error, /does not belong/);
});

test('missing or invalid property zone never requests date-sensitive data', async () => {
  for (const timeZoneId of ['', 'Invalid/Zone']) {
    let listingRequested = false;
    const { state, loader } = harness({ getUnits: async () => [{ id: 2 }], getTimeZone: async () => ({ timeZoneId }), getListing: async () => { listingRequested = true; } });
    await loader.load();
    assert.equal(listingRequested, false);
    assert.equal(state.calendar, null);
    assert.equal(state.start, '');
    if (timeZoneId) assert.match(state.error, /IANA/);
  }
});

test('older setup completion and older calendar completion cannot overwrite newer refresh', async () => {
  const firstZone = deferred();
  const firstCalendar = deferred();
  let zoneCalls = 0, calendarCalls = 0;
  const { state, loader } = harness({
    getUnits: async () => [{ id: 2 }],
    getTimeZone: () => ++zoneCalls === 1 ? firstZone.promise : Promise.resolve({ timeZoneId: 'America/Los_Angeles' }),
    getListing: async () => ({ houseRules: 'new' }),
    getCalendar: () => ++calendarCalls === 2 ? firstCalendar.promise : Promise.resolve({ nights: ['new'] })
  });
  const old = loader.load();
  await tick();
  await loader.load();
  firstZone.resolve({ timeZoneId: 'Pacific/Auckland' });
  await old;
  assert.equal(state.timeZoneId, 'America/Los_Angeles');
  assert.equal(state.start, '2025-12-31');
  const stale = loader.calendar('2025-12-31', '2026-01-30');
  await tick();
  await loader.calendar('2026-01-01', '2026-01-31');
  firstCalendar.resolve({ nights: ['old'] });
  await stale;
  assert.deepEqual(state.calendar, { nights: ['new'] });
  assert.equal(state.calendarLoading, false);
  loader.invalidate();
});

test('route switch isolates late old-unit results from the new unit state', async () => {
  const oldZone = deferred();
  const old = harness({ getUnits: async () => [{ id: 2 }], getTimeZone: () => oldZone.promise }, '1', '2');
  const pending = old.loader.load();
  await tick();
  old.loader.invalidate();
  const next = harness({
    getUnits: async () => [{ id: 4 }], getTimeZone: async () => ({ timeZoneId: 'Pacific/Auckland' }),
    getListing: async () => ({ houseRules: 'new unit' }), getCalendar: async () => ({ nights: ['new unit'] })
  }, '3', '4');
  await next.loader.load();
  oldZone.reject(new Error('old unit error'));
  await pending;
  assert.equal(old.state.timeZoneId, '');
  assert.equal(next.state.timeZoneId, 'Pacific/Auckland');
  assert.equal(next.state.draft.houseRules, 'new unit');
  assert.deepEqual(next.state.calendar.nights, ['new unit']);
});

test('unmounted route ignores late result', async () => {
  const units = deferred();
  const { state, loader } = harness({ getUnits: () => units.promise, getTimeZone: () => { throw Error('should not fetch'); } });
  const pending = loader.load();
  loader.invalidate();
  units.resolve([{ id: 2 }]);
  await pending;
  assert.equal(state.loading, true);
  assert.equal(state.timeZoneId, '');
});
