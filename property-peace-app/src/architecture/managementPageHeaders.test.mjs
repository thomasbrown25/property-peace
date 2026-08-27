import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const managementPages = [
  '../sections/landlord/tenants/TenantsContent.jsx',
  '../sections/landlord/leases/LeasesHeader.jsx',
  '../pages/landlord/team.jsx',
  '../pages/landlord/announcements.jsx',
  '../pages/landlord/vendors.jsx',
  '../pages/landlord/applications.jsx',
  '../pages/landlord/listings.jsx',
  '../sections/landlord/finances/FinancesHeader.jsx'
];
const sharedHeaderSource = fs.readFileSync(new URL('../components/headers/ManagementPageHeader.jsx', import.meta.url), 'utf8');

test('shared management page header starts with title content instead of a decorative icon', () => {
  assert.doesNotMatch(sharedHeaderSource, /\{icon\}/);
  assert.doesNotMatch(sharedHeaderSource, /icon: PropTypes\.node/);
  assert.doesNotMatch(sharedHeaderSource, /width: 56,[\s\S]*height: 56/);
});

for (const relativePath of managementPages) {
  test(`${relativePath} uses the shared transparent management header`, () => {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

    assert.match(source, /import ManagementPageHeader from ['"]components\/headers\/ManagementPageHeader['"]/);
    assert.match(source, /<ManagementPageHeader/);
    assert.doesNotMatch(source, /linear-gradient\(120deg/);
    assert.doesNotMatch(source, /<ManagementPageHeader[\s\S]{0,300}\n\s+icon=/);
  });
}
