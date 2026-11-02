import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildDocumentRows, filterDocumentRows, paginateDocumentRows } from './leaseDocumentTable.mjs';

const source = fs.readFileSync(new URL('./LeaseDetailView.jsx', import.meta.url), 'utf8');
const tab = source.split('{activeTab === 3 && (')[1]?.split('{activeTab === 4 && (')[0];

test('normalizes API fields, avoids claiming generated agreement visibility, and retains file action', () => {
  const rows = buildDocumentRows([{ Id: 4, FileName: 'Form.pdf', DocumentType: 40, IsPrivate: false, UploadedAt: '2026-01-02', BlobUrl: '/form' }], true);
  assert.equal(rows[0].type, 'Move-In Checklist');
  assert.equal(rows[0].tenantVisible, true);
  assert.equal(rows[0].uploadedAt, '2026-01-02');
  assert.equal(rows[0].url, '/form');
  assert.equal(rows[1].tenantVisible, null);
  assert.equal(rows[1].source, 'agreement');
  assert.equal(buildDocumentRows([{ name: 'Private', isPrivate: true }], false)[0].tenantVisible, false);
});

test('filter and search before pagination, clamp stale page and preserve original data', () => {
  const rows = [
    { name: 'Lease.pdf', type: 'Agreement', tenantVisible: true },
    { name: 'Report', type: 'Form', tenantVisible: false },
    { name: 'Lease 2', type: 'Agreement', tenantVisible: null }
  ];
  assert.deepEqual(filterDocumentRows(rows, { type: 'Agreement', search: ' lease ' }), [rows[0], rows[2]]);
  assert.deepEqual(filterDocumentRows(rows, { visibility: 'private' }), [rows[1]]);
  assert.deepEqual(filterDocumentRows(rows, { visibility: 'visible' }), [rows[0]]);
  assert.deepEqual(paginateDocumentRows(rows, 9, 2), { page: 1, count: 3, rows: [rows[2]] });
  assert.deepEqual(paginateDocumentRows([], 5, 2), { page: 0, count: 0, rows: [] });
  assert.equal(rows.length, 3);
});

test('documents tab wires a single upload button, agreement action, search/filter and table pagination', () => {
  assert.ok(tab);
  assert.match(source, /buildDocumentRows\(leaseDocuments, hasLeaseAgreementDocument\)/);
  assert.match(source, /filterDocumentRows\(docs, \{ search: documentSearch, type: documentTypeFilter, visibility: documentVisibilityFilter \}\)/);
  assert.match(source, /paginateDocumentRows\(filteredDocuments, documentPage, documentRowsPerPage\)/);
  assert.equal((tab.match(/onClick=\{onUploadDocument\}/g) || []).length, 1);
  assert.match(tab, /Create agreement/);
  assert.match(tab, /Search documents/);
  assert.match(tab, /Tenant visible/);
  assert.match(tab, /Uploaded date/);
  assert.match(tab, /<TablePagination/);
  assert.match(tab, /page=\{documentPagination\.page\}/);
  assert.match(tab, /rowsPerPageOptions=\{\[10, 20, 50, 100\]\}/);
  assert.doesNotMatch(tab, /title="Forms"|title="Other"|Upload agreement|Upload form/);
});
