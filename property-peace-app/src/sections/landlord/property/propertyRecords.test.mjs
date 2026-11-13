import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scopePropertyRecords, filterPropertyRows, maintenanceTableColumns } from './propertyRecords.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('scopes tenants and maintenance to the selected property, including case variants', () => {
  const rows = [{ id: 1, propertyId: 4 }, { Id: 2, PropertyId: 5 }, { id: 3, propertyId: '5' }];
  assert.deepEqual(scopePropertyRecords(rows, 5).map(row => row.id ?? row.Id), [2, 3]);
  assert.deepEqual(scopePropertyRecords(rows, null), []);
});

test('maintenance status column displays workflow names instead of raw tokens', () => {
  const status = maintenanceTableColumns({}).find(column => column.label === 'Status');
  for (const [value, label] of [
    ['inProgress', 'In progress'], ['InProgress', 'In progress'],
    ['awaitingApproval', 'Awaiting approval'], ['awaitingTenant', 'Awaiting tenant'],
    ['reported', 'Reported'], ['resolved', 'Resolved'], ['cancelled', 'Cancelled']
  ]) {
    assert.equal(status.value({ status: value }), label);
    assert.equal(status.value({ Status: value }), label);
  }
  assert.equal(status.value({}), '—');
  assert.equal(status.value({ status: '' }), '—');
});

test('search and status filter are applied before pagination', () => {
  const rows = [{ name: 'Alpha', status: 'Active' }, { name: 'Beta', status: 'Draft' }, { name: 'Alpine', status: 'Draft' }];
  assert.deepEqual(filterPropertyRows(rows, 'al', 'draft', row => [row.name], row => row.status), [rows[2]]);
});

test('property tabs replace current cards and expose searchable paginated detail tables', async () => {
  const page = await read('../../../pages/landlord/property.jsx');
  const overview = await read('./PropertyOverview.jsx');
  const tabs = await read('./PropertyRecordsTabs.jsx');
  assert.match(page, /<PropertyRecordsTabs/);
  assert.doesNotMatch(overview, /<PropertyCurrentTenant|<PropertyActiveLease/);
  for (const label of ['Overview', 'Leases', 'Tenants', 'Maintenance', 'Payments']) {
    assert.match(tabs, new RegExp(`label="${label}"`));
  }
  for (const label of ['Expenses', 'Documents']) {
    assert.match(tabs, new RegExp(`\\{ id: '[a-z]+', label: '${label}' \\}`));
  }
  assert.match(tabs, /TablePagination/);
  const documents = await read('./DocumentsTab.jsx');
  const finances = await read('./ExpensesTab.jsx');
  assert.match(documents, /filteredDocuments\.slice\(/);
  assert.match(documents, /<TablePagination/);
  const income = await read('./PaymentsTab.jsx');
  const table = await read('./PropertyFinanceTable.jsx');
  assert.match(finances, /categoryFilter/);
  assert.match(finances, /paginatedExpenses\.map\(/);
  assert.match(income, /mode="payments"/);
  assert.match(table, /<TablePagination/);
  assert.match(tabs, /<PaymentsTab/);
  const leaseTable = tabs.match(/<RecordsTable label="Leases"[^\n]*/)?.[0];
  assert.ok(leaseTable, 'Leases keep the shared records table');
  assert.match(leaseTable, /getStatus=\{leaseStatus\}/);
  assert.doesNotMatch(leaseTable, /highlightStatus=/, 'Lease status does not tint the whole row');
  assert.match(tabs, /\/landlord\/leases\/\$\{/);
  assert.match(tabs, /\/landlord\/tenants\/\$\{/);
  const records = await read('./propertyRecords.mjs');
  assert.match(records, /\/landlord\/maintenance\/\$\{/);
});
