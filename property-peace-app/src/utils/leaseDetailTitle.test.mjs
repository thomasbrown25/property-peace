import test from 'node:test';
import assert from 'node:assert/strict';
import { leaseDetailTitle } from './leaseDetailTitle.mjs';

test('unnamed lease uses property and lease id', () => {
  assert.equal(leaseDetailTitle({ id: 42 }, 'Maple House', '7'), 'Maple House #42');
  assert.equal(leaseDetailTitle({ Name: '  ' }, 'Maple House', '7'), 'Maple House #7');
});

test('explicit lease name replaces the property-id heading', () => {
  assert.equal(leaseDetailTitle({ name: '  2026 Renewal  ', id: 42 }, 'Maple House', 42), '2026 Renewal');
  assert.equal(leaseDetailTitle({ Name: 'Spring agreement', Id: 42 }, 'Maple House', 42), 'Spring agreement');
});
