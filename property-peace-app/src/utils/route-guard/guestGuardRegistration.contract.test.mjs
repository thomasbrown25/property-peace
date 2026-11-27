import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./GuestGuard.jsx', import.meta.url), 'utf8');

test('GuestGuard preserves only an explicitly in-progress public registration completion route', () => {
  assert.match(source, /location\.state\?\.registrationCompleting/);
  assert.match(source, /pathname === '\/register'/);
  assert.match(source, /step === 'creating' \|\| step === 'complete'/);
});
