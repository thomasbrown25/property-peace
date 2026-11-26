import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./TenantsContent.jsx', import.meta.url), 'utf8');

test('tenant table has no selection controls or bulk invite action', () => {
  assert.doesNotMatch(source, /<Checkbox\b|selectedTenantIds|toggleSelectAll|toggleTenantSelection|handleBulkInvite/);
  assert.match(source, /gridTemplateColumns: 'minmax\(210px, 1\.45fr\)/);
});

test('tenant row shows the assigned home and dates or No lease, with assignment in the actions menu', () => {
  const row = source.split('function TenantRow(')[1].split('export default function TenantsContent')[0];
  assert.doesNotMatch(row, /Tenant record #|>Unassigned</);
  assert.match(row, /event\.target !== event\.currentTarget/);
  assert.match(row, /hasLease\(tenant\) \? \([\s\S]*?\{propertyDisplay[\s\S]*?leaseStart[\s\S]*?leaseEnd[\s\S]*?>No lease<\/Typography>/);
  assert.doesNotMatch(row, /Add to lease|Lease assigned/);
  assert.match(source, /setAddToLeaseTenant\(actionMenuTenant\);[\s\S]*?<span>Add to lease<\/span>/);
});
