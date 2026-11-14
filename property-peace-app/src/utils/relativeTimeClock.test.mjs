import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import moment from 'moment';
import { RELATIVE_TIME_REFRESH_MS, subscribeToClock } from './relativeTimeClock.mjs';

// Isolate the real formatter from unrelated app-only alias imports in formatters.js.
const source = readFileSync(new URL('./formatters.js', import.meta.url), 'utf8');
const formatterBody = source.match(/export const formatRelativeTime = ([\s\S]*?)\nexport const formatCurrency/)[1].trim().replace(/;$/, '');
const formatRelativeTime = runInNewContext(`(${formatterBody})`, { moment, console, Date });

function clockFixture() {
  const host = new EventTarget();
  const page = new EventTarget();
  page.visibilityState = 'visible';
  let tick;
  let cleared;
  host.setInterval = (callback, delay) => {
    assert.equal(delay, RELATIVE_TIME_REFRESH_MS);
    tick = callback;
    return 42;
  };
  host.clearInterval = (id) => { cleared = id; };
  return { host, page, tick: () => tick(), cleared: () => cleared };
}

test('unchanged activity timestamps advance without a network response', () => {
  const clock = clockFixture();
  const createdAt = '2026-11-14T12:00:00Z';
  let now = Date.parse(createdAt);
  let label;
  const cleanup = subscribeToClock(() => { label = formatRelativeTime(createdAt, now); }, clock.host, clock.page);
  assert.equal(label, 'just now');
  now += 60000;
  clock.tick();
  assert.equal(label, '1 minute ago');
  now += 60000;
  clock.tick();
  assert.equal(label, '2 minutes ago');
  cleanup();
});

test('clock refreshes immediately on focus and when the tab becomes visible', () => {
  const clock = clockFixture();
  let refreshes = 0;
  const cleanup = subscribeToClock(() => refreshes++, clock.host, clock.page);
  assert.equal(refreshes, 1);
  clock.host.dispatchEvent(new Event('focus'));
  assert.equal(refreshes, 2);
  clock.page.visibilityState = 'hidden';
  clock.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(refreshes, 2);
  clock.page.visibilityState = 'visible';
  clock.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(refreshes, 3);
  cleanup();
});

test('unmount clears the timer and both browser event listeners', () => {
  const clock = clockFixture();
  let refreshes = 0;
  const cleanup = subscribeToClock(() => refreshes++, clock.host, clock.page);
  cleanup();
  assert.equal(clock.cleared(), 42);
  clock.host.dispatchEvent(new Event('focus'));
  clock.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(refreshes, 1);
});

test('relative labels cross hour and day boundaries', () => {
  const createdAt = '2026-11-14T12:00:00Z';
  const start = Date.parse(createdAt);
  assert.equal(formatRelativeTime(createdAt, start + 3600000), '1 hour ago');
  assert.equal(formatRelativeTime(createdAt, start + 86400000), '1 day ago');
  assert.equal(formatRelativeTime(createdAt, start + 2 * 86400000), '2 days ago');
});

test('UTC timestamps with no suffix and explicit offsets represent the same instant', () => {
  const now = Date.parse('2026-11-14T13:00:00Z');
  for (const timestamp of ['2026-11-14T12:00:00', '2026-11-14T12:00:00.0000000', '2026-11-14T12:00:00Z', '2026-11-14T07:00:00-05:00']) {
    assert.equal(formatRelativeTime(timestamp, now), '1 hour ago');
  }
});

test('both dashboard activity variants use the live clock', () => {
  for (const file of ['OwnerHomeSidebar.jsx', 'RecentActivity.jsx']) {
    const component = readFileSync(new URL(`../sections/landlord/dashboard/${file}`, import.meta.url), 'utf8');
    assert.match(component, /const now = useCurrentTime\(\)/);
    assert.match(component, /formatRelativeTime\((?:item|activity)\.createdAt, now\)/);
  }
  const hook = readFileSync(new URL('../hooks/useCurrentTime.js', import.meta.url), 'utf8');
  assert.match(hook, /useEffect\(\(\) => subscribeToClock\(/);
});
