import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateTenants } from './tenantPagination.mjs';

test('tenant rows page in the same 10-item default as leases', () => {
  const tenants = Array.from({ length: 23 }, (_, id) => ({ id }));
  const result = paginateTenants(tenants, 1, 10);
  assert.deepEqual(result.rows.map(({ id }) => id), [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual({ page: result.page, pageCount: result.pageCount, start: result.start, end: result.end },
    { page: 1, pageCount: 3, start: 11, end: 20 });
});

test('changing page size or shrinking filtered results keeps the visible page in range', () => {
  const tenants = Array.from({ length: 23 }, (_, id) => ({ id }));
  const largerPage = paginateTenants(tenants, 2, 20);
  assert.equal(largerPage.page, 1);
  assert.deepEqual(largerPage.rows.map(({ id }) => id), [20, 21, 22]);
  const shrunk = paginateTenants(tenants.slice(0, 4), 2, 10);
  assert.deepEqual({ page: shrunk.page, pageCount: shrunk.pageCount, start: shrunk.start, end: shrunk.end },
    { page: 0, pageCount: 1, start: 1, end: 4 });
});

test('empty results have no phantom page or visible rows', () => {
  const result = paginateTenants([], 3, 10);
  assert.deepEqual({ page: result.page, pageCount: result.pageCount, start: result.start, end: result.end, rows: result.rows },
    { page: 0, pageCount: 0, start: 0, end: 0, rows: [] });
});
