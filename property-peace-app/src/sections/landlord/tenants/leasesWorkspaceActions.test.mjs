import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leases = readFileSync(new URL('../../../pages/landlord/leases.jsx', import.meta.url), 'utf8');
const tenants = readFileSync(new URL('./TenantsContent.jsx', import.meta.url), 'utf8');

test('all three leases workspace header creation actions use navy primary', () => {
  const header = leases.split('const headerActions =')[1].split(/return \(\r?\n    <Fade/)[0];
  for (const label of ['Add tenant', 'New agreement', 'Create lease']) {
    const action = header.split(label)[0].split('<Button').at(-1);
    assert.match(action, /variant="contained"/);
    assert.match(action, /color="primary"/);
  }
});

test('tenant footer uses the leases table page-size and previous-next controls', () => {
  assert.match(tenants, /paginateTenants\(filteredTenants, page, itemsPerPage\)/);
  assert.match(tenants, /\[10, 20, 50, 100\]\.map/);
  assert.match(tenants, /Items per page/);
  assert.match(tenants, /Previous<\/Button>/);
  assert.match(tenants, /Next<\/Button>/);
  assert.doesNotMatch(tenants, /<Pagination\b/);
});
