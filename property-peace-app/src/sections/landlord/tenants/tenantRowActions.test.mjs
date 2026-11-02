import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./TenantsContent.jsx', import.meta.url), 'utf8');

test('tenant table has no selection controls or bulk invite action', () => {
  assert.doesNotMatch(source, /<Checkbox\b|selectedTenantIds|toggleSelectAll|toggleTenantSelection|handleBulkInvite/);
  assert.match(source, /gridTemplateColumns: 'minmax\(210px, 1\.45fr\)/);
});

test('tenant row omits record number and offers direct add-to-lease for an unassigned tenant', () => {
  const row = source.split('function TenantRow(')[1].split('export default function TenantsContent')[0];
  assert.doesNotMatch(row, /Tenant record #|>Unassigned</);
  assert.match(row, /event\.target !== event\.currentTarget/);
  assert.match(row, /hasLease\(tenant\) \? \([\s\S]*?Lease assigned[\s\S]*?\) : \([\s\S]*?<Button/);
  assert.match(row, /<Button[\s\S]*?onClick=\{\(event\) => \{[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onAddToLease\(tenant\);[\s\S]*?\}\}[\s\S]*?>\s*Add to lease\s*<\/Button>/);
  assert.match(source, /onAddToLease=\{\(item\) => \{[\s\S]*?setAddToLeaseTenant\(item\);[\s\S]*?setAddToLeaseDrawerOpen\(true\);/);
});
