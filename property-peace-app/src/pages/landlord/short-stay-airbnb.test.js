import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAirbnbCalendar, airbnbBlockIsManual, formatAirbnbInstant } from './short-stay-airbnb.js';

const pending = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise((yes) => setImmediate(yes));

test('API uses authenticated client, exact URL body, encoded route and no-store without echoing secret', async () => {
  const source = (await readFile(new URL('../../api/shortStay.js', import.meta.url), 'utf8')).replace("import axios from 'utils/axios';", 'const axios = globalThis.__airbnbAxios;');
  const calls = [];
  globalThis.__airbnbAxios = Object.fromEntries(['get', 'post', 'put', 'delete'].map((method) => [method, async (...args) => {
    calls.push([method, ...args]); return { data: { success: true, data: { enabled: true, health: 'never_synced' } } };
  }]));
  try {
    const { shortStayAPI } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const url = 'https://www.airbnb.com/calendar/ical/123.ics?s=secret';
    await shortStayAPI.getAirbnbCalendar('12/3');
    await shortStayAPI.connectAirbnbCalendar('12/3', url);
    await shortStayAPI.refreshAirbnbCalendar('12/3');
    await shortStayAPI.disconnectAirbnbCalendar('12/3');
    assert.deepEqual(calls.map((call) => [call[0], call[1]]), [
      ['get', '/api/short-stay/units/12%2F3/airbnb-calendar'],
      ['put', '/api/short-stay/units/12%2F3/airbnb-calendar'],
      ['post', '/api/short-stay/units/12%2F3/airbnb-calendar/refresh'],
      ['delete', '/api/short-stay/units/12%2F3/airbnb-calendar']
    ]);
    assert.deepEqual(calls[1][2], { url });
    for (const call of calls) assert.equal(call.at(-1).headers['Cache-Control'], 'no-store');
  } finally { delete globalThis.__airbnbAxios; }
});

test('stale status response and old route result cannot replace newer status; errors never display token', async () => {
  const first = pending();
  let calls = 0;
  const updates = [];
  const controller = createAirbnbCalendar({ unitId: '2', api: { getAirbnbCalendar: () => ++calls === 1 ? first.promise : Promise.resolve({ unitId: 2, health: 'healthy' }) }, update: (value) => updates.push(value) });
  const old = controller.load();
  await tick();
  await controller.load();
  first.resolve({ unitId: 2, health: 'stale' });
  await old;
  assert.equal(updates.filter((v) => v.status?.health).at(-1).status.health, 'healthy');
  controller.invalidate();
  const oldRoute = pending();
  const obsolete = createAirbnbCalendar({ unitId: '3', api: { getAirbnbCalendar: () => oldRoute.promise }, update: (v) => updates.push(v) });
  const abandoned = obsolete.load();
  obsolete.invalidate();
  oldRoute.resolve({ unitId: 3, health: 'retrying' });
  await abandoned;
  assert.equal(updates.filter((v) => v.status?.health).at(-1).status.health, 'healthy');
  const mismatch = createAirbnbCalendar({ unitId: '4', api: { getAirbnbCalendar: async () => ({ unitId: 9, enabled: true }) }, update: (v) => updates.push(v) });
  await mismatch.load();
  assert.equal(updates.filter((v) => v.status?.health).at(-1).status.health, 'healthy');
  const errors = [];
  const fail = createAirbnbCalendar({ unitId: '2', api: { getAirbnbCalendar: async () => { throw new Error('https://www.airbnb.com/calendar/ical/123.ics?s=secret'); } }, update: (v) => errors.push(v) });
  await fail.load();
  assert.doesNotMatch(JSON.stringify(errors), /secret|ical\/123/);
});

test('status mutation supersedes pending load and refresh queues without pretending sync succeeded', async () => {
  const first = pending();
  const updates = [];
  const controller = createAirbnbCalendar({ unitId: '2', api: {
    getAirbnbCalendar: () => first.promise,
    connectAirbnbCalendar: async () => ({ unitId: 2, enabled: true, health: 'never_synced' }),
    refreshAirbnbCalendar: async () => ({ unitId: 2, enabled: true, health: 'never_synced' })
  }, update: (v) => updates.push(v) });
  const old = controller.load();
  await controller.connect('https://www.airbnb.com/calendar/ical/123.ics?s=secret');
  first.resolve({ unitId: 2, enabled: false, health: 'disabled' });
  await old;
  assert.equal(updates.filter((v) => 'status' in v).at(-1).status.enabled, true);
  await controller.refresh();
  assert.match(updates.filter((v) => v.notice).at(-1).notice, /queued/i);
});

test('property-local attempted and success instants; imported blocks never receive remove control', async () => {
  assert.match(formatAirbnbInstant('2026-01-01T01:00:00Z', 'America/Los_Angeles'), /Dec 31, 2025/);
  assert.equal(formatAirbnbInstant(null, 'America/Los_Angeles'), 'Never');
  assert.equal(airbnbBlockIsManual({ id: -2, source: 'Airbnb' }), false);
  assert.equal(airbnbBlockIsManual({ id: 2, source: 'OwnerBlock' }), true);
  assert.equal(airbnbBlockIsManual({ id: 2, source: 'Airbnb' }), false);
  const page = await readFile(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
  assert.match(page, /airbnbBlockIsManual\(block\)/);
  assert.match(page, /Disconnect.*imported dates|imported dates.*Disconnect/i);
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\.log/);
});
