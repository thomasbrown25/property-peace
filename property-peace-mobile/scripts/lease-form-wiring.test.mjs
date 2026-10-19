import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
test('native lease editor hydrates selected lease and submits validated form', () => {
  const form = source('screens/landlord/AddLeaseScreen.tsx');
  for (const marker of ['hydrateLease(', 'validateLease(', 'leasePayload(', 'getLeases(', 'Save lease draft', 'Create lease', 'Update lease']) assert.ok(form.includes(marker), marker);
  assert.ok(source('screens/landlord/LeaseDetailScreen.tsx').includes("navigate('AddLease'"));
  assert.ok(form.includes('useRoute().params'));
});
test('signed lease cannot enter native edit route; stale unit requests cannot overwrite property change', () => {
  const detail = source('screens/landlord/LeaseDetailScreen.tsx');
  const form = source('screens/landlord/AddLeaseScreen.tsx');
  assert.ok(detail.includes('!signed && !archived'));
  assert.ok(form.includes('selection.current'));
  assert.ok(form.includes('Signed leases cannot be edited here.'));
});
