import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLeaseStatusPresentation } from './leaseStatusPresentation.js';

test('draft lease chip uses the short label and warning tone even if active is set', () => {
  assert.deepEqual(getLeaseStatusPresentation({ draft: true, active: true }), {
    label: 'Draft', color: 'warning', variant: 'filled'
  });
});

test('active lease chip uses the short label and success tone', () => {
  assert.deepEqual(getLeaseStatusPresentation({ active: true }), {
    label: 'Active', color: 'success', variant: 'filled'
  });
});

test('both mobile cards and desktop rows use the status presentation for their chips', () => {
  const source = readFileSync(new URL('../pages/landlord/leases.jsx', import.meta.url), 'utf8');
  assert.equal((source.match(/const leaseStatus = getLeaseStatusPresentation\(lease\)/g) || []).length, 2);
  assert.equal((source.match(/label=\{leaseStatus\.label\}/g) || []).length, 2);
  assert.equal((source.match(/color=\{leaseStatus\.color\}/g) || []).length, 2);
  assert.equal((source.match(/variant=\{leaseStatus\.variant\}/g) || []).length, 2);
});

test('other lease statuses keep their previous labels and neutral chips', () => {
  assert.deepEqual(getLeaseStatusPresentation({ ended: true }), {
    label: 'Ended lease', color: 'default', variant: 'outlined'
  });
  assert.deepEqual(getLeaseStatusPresentation({}), {
    label: 'Not started', color: 'default', variant: 'outlined'
  });
});
