import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('./bookings.jsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../../../../property-peace-api/Controllers/ShortStayBookingsController.cs', import.meta.url), 'utf8');

test('bookings GET does not send an unsupported cache-control request header', () => {
  const get = page.match(/axios\.get\('\/api\/short-stay\/bookings',[\s\S]*?\)\.then/)?.[0];
  assert.ok(get, 'bookings list request must exist');
  assert.doesNotMatch(get, /['"]Cache-Control['"]\s*:/i);
  assert.match(get, /signal:\s*controller\.signal/);
  assert.match(controller, /Response\.Headers\.CacheControl\s*=\s*"no-store, no-cache"/);
});
