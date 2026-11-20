import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboard = readFileSync(new URL('./dashboard.jsx', import.meta.url), 'utf8');

test('the mobile greeting has a full-width column and the landlord text action is desktop-only', () => {
  const header = dashboard.split('{/* Header */}')[1].split('<Divider width="100%"')[0];
  assert.match(header, /gridTemplateColumns: \{ xs: 'minmax\(0, 1fr\)', md: 'minmax\(0, 1fr\) auto' \}/);
  assert.match(header, /<Typography[\s\S]*?gridColumn: 1, gridRow: 1[\s\S]*?\{greeting\}/);
  assert.match(header, /href=\{`sms:\$\{landlordContactNumber\}`\}[\s\S]*?display: \{ xs: 'none', md: 'inline-flex' \}[\s\S]*?Text your landlord/);
});
