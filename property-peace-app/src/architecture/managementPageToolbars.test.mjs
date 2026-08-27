import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

function expectBareFiltersBeforeTable(page, filterId, tableId, searchPlaceholder) {
  const filterMarker = `data-testid="${filterId}"`;
  const tableMarker = `data-testid="${tableId}"`;
  const filterStart = page.indexOf(filterMarker);
  const tableStart = page.indexOf(tableMarker);
  let searchStart = page.indexOf(`placeholder="${searchPlaceholder}"`);
  if (searchStart === -1) searchStart = page.indexOf(`searchPlaceholder="${searchPlaceholder}"`);

  assert.notEqual(filterStart, -1, `${filterId} marker is missing`);
  assert.notEqual(tableStart, -1, `${tableId} marker is missing`);
  assert.notEqual(searchStart, -1, `${filterId} search is missing`);
  assert.ok(filterStart < searchStart, `${filterId} must own its search input`);
  assert.ok(searchStart < tableStart, `${filterId} must sit outside and before ${tableId}`);

  const filterOpeningTag = page.slice(filterStart, page.indexOf('>', filterStart));
  assert.doesNotMatch(filterOpeningTag, /bgcolor|border|boxShadow/);
}

test('leases header actions swap with the active workspace tab', async () => {
  const [leases, header] = await Promise.all([
    source('../pages/landlord/leases.jsx'),
    source('../sections/landlord/leases/LeasesHeader.jsx')
  ]);

  assert.match(header, /function LeasesHeader\(\{ actions \}\)/);
  assert.match(header, /actions=\{actions\}/);
  assert.match(leases, /activeTab === 2[\s\S]*<TenantCsvImportButton[\s\S]*Add tenant/);
  assert.match(leases, /activeTab === 1[\s\S]*New agreement/);
  assert.match(leases, /Create lease/);
});

test('tenant controls are bare and tenant actions are no longer embedded above the table', async () => {
  const tenants = await source('../sections/landlord/tenants/TenantsContent.jsx');

  expectBareFiltersBeforeTable(
    tenants,
    'tenant-filters',
    'tenant-table',
    'Search tenants, contact details, or properties'
  );
  assert.doesNotMatch(tenants, /\{embedded && \([\s\S]{0,700}<TenantCsvImportButton/);
  assert.match(tenants, /placeholder="Search tenants, contact details, or properties"[\s\S]{0,400}bgcolor: 'background\.paper'/);
  assert.equal((tenants.match(/borderRadius: 1\.75, bgcolor: 'background\.paper'/g) || []).length, 6);
});

test('listing controls are bare and separate from the listings table component', async () => {
  const listings = await source('../pages/landlord/listings.jsx');

  expectBareFiltersBeforeTable(
    listings,
    'listing-filters',
    'listing-table',
    'Search listings, addresses, units, or listing numbers'
  );
});

test('application controls are bare and separate from the applications table component', async () => {
  const applications = await source('../pages/landlord/applications.jsx');

  expectBareFiltersBeforeTable(
    applications,
    'application-filters',
    'application-table',
    'Search applicants, email, property, or unit'
  );
  assert.doesNotMatch(applications, /\{hideHeader && scopedApplications\.length > 0 && \([\s\S]{0,500}New application/);
});

test('core management controls are bare and separate from their result surfaces', async () => {
  const pages = await Promise.all([
    source('../pages/landlord/maintenances.jsx'),
    source('../pages/landlord/properties.jsx'),
    source('../pages/landlord/vendors.jsx'),
    source('../pages/landlord/team.jsx'),
    source('../pages/landlord/announcements.jsx')
  ]);
  const expectations = [
    ['maintenance-filters', 'maintenance-table', 'Search requests, properties, vendors...'],
    ['property-filters', 'property-table', 'Search properties, addresses, or units'],
    ['vendor-filters', 'vendor-table', 'Search vendors, categories, contact details, or location'],
    ['team-filters', 'team-table', 'Search team members, emails, or roles'],
    ['announcement-filters', 'announcement-table', 'Search title, message, sender, or organization']
  ];

  expectations.forEach(([filterId, tableId, placeholder], index) => {
    expectBareFiltersBeforeTable(pages[index], filterId, tableId, placeholder);
  });

  assert.match(pages[0], /color="success"[\s\S]{0,300}New request/);
  assert.match(pages[1], /PropertyCsvImportButton[\s\S]{0,180}managementPageHeaderActionSx/);
});

test('finance tab controls are bare and separate from finance result surfaces', async () => {
  const tabs = await Promise.all([
    source('../sections/landlord/finances/ActivityTab.jsx'),
    source('../sections/landlord/finances/ExpensesTab.jsx'),
    source('../sections/landlord/finances/PaymentsTab.jsx'),
    source('../sections/landlord/finances/UpcomingTab.jsx')
  ]);
  const expectations = [
    ['finance-activity-filters', 'finance-activity-table', 'Search description, source, account, property, or reference'],
    ['finance-expense-filters', 'finance-expense-table', 'Search name, vendor, category, or property'],
    ['finance-payment-filters', 'finance-payment-table', 'Search tenant, reference, property, unit, or method'],
    ['finance-upcoming-filters', 'finance-upcoming-table', 'Search name, vendor, category, or property']
  ];

  expectations.forEach(([filterId, tableId, placeholder], index) => {
    expectBareFiltersBeforeTable(tabs[index], filterId, tableId, placeholder);
  });
});

test('tax center expense controls are bare and separate from the expense table', async () => {
  const taxCenter = await source('../pages/landlord/reports/tax.jsx');

  expectBareFiltersBeforeTable(
    taxCenter,
    'tax-expense-filters',
    'tax-expense-table',
    'Search description, vendor, category…'
  );
});
