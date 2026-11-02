import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scopePropertyRecords, filterPropertyRows } from './propertyRecords.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('scopes tenants and maintenance to the selected property, including case variants', () => {
  const rows = [{ id: 1, propertyId: 4 }, { Id: 2, PropertyId: 5 }, { id: 3, propertyId: '5' }];
  assert.deepEqual(scopePropertyRecords(rows, 5).map(row => row.id ?? row.Id), [2, 3]);
  assert.deepEqual(scopePropertyRecords(rows, null), []);
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
  for (const label of ['Overview', 'Leases', 'Tenants', 'Maintenances', 'Finances', 'Documents']) {
    assert.match(tabs, new RegExp(`label="${label}"`));
  }
  assert.match(tabs, /TablePagination/);
  const documents = await read('./DocumentsTab.jsx');
  const finances = await read('./ExpensesTab.jsx');
  assert.match(documents, /filteredDocuments\.slice\(/);
  assert.match(documents, /<TablePagination/);
  const income = await read('./IncomeTab.jsx');
  const table = await read('./PropertyFinanceTable.jsx');
  assert.match(finances, /categoryFilter/);
  assert.match(finances, /paginatedExpenses\.map\(/);
  assert.match(income, /combined \/>/);
  assert.match(table, /<TablePagination/);
  assert.match(tabs, /<IncomeTab/);
  assert.match(tabs, /getStatus=\{leaseStatus\} highlightStatus="Active"/);
  assert.match(tabs, /highlightStatus && getStatus\(row\) === highlightStatus/);
  assert.match(tabs, /bgcolor: alpha\(theme\.palette\.success\.main, 0\.1\)/);
  assert.match(tabs, /\/landlord\/leases\/\$\{/);
  assert.match(tabs, /\/landlord\/tenants\/\$\{/);
  const records = await read('./propertyRecords.mjs');
  assert.match(records, /\/landlord\/maintenance\/\$\{/);
});
