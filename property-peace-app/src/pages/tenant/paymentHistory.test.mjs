import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { paginateRows } from '../../components/table/paginateRows.mjs';
import { filterPaymentHistory } from './paymentHistory.mjs';

const payments = [
  { id: 'first', paymentDate: '2026-11-20T00:00:00', status: 'Completed', amount: 1234.5, method: 'Online payment' },
  { id: 'second', paymentDate: '2026-11-20T23:59:59', status: 'Failed', amount: 250, referenceNumber: 'RCPT-257' },
  { id: 'previous', paymentDate: '2026-11-19T23:59:59', status: 'Completed', paymentMethod: 'Check' },
  { id: 'undated', status: 'Completed' }
];

const ids = (rows) => rows.map(({ id }) => id);

test('payment history searches displayed status, amount, method, and reference without regard to case', () => {
  assert.deepEqual(ids(filterPaymentHistory(payments, { search: '  PAID  ' })), ['first', 'previous', 'undated']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { search: '$1,234.50' })), ['first']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { search: '1234.50' })), ['first']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { search: 'check' })), ['previous']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { search: 'rcpt-257' })), ['second']);
});

test('the payment date range includes both full boundary days and combines with search', () => {
  assert.deepEqual(ids(filterPaymentHistory(payments, { fromDate: '2026-11-19', toDate: '2026-11-20' })), ['first', 'second', 'previous']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { fromDate: '2026-11-20', toDate: '2026-11-20' })), ['first', 'second']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { fromDate: '2026-11-20', toDate: '2026-11-20', search: 'failed' })), ['second']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { fromDate: '2026-11-20', toDate: '2026-11-19' })), []);
});

test('either date range boundary can be used on its own', () => {
  assert.deepEqual(ids(filterPaymentHistory(payments, { fromDate: '2026-11-20' })), ['first', 'second']);
  assert.deepEqual(ids(filterPaymentHistory(payments, { toDate: '2026-11-19' })), ['previous']);
});

test('pagination runs after filtering and returns the remaining matches on the next page', () => {
  const history = Array.from({ length: 25 }, (_, id) => ({ id, status: id % 2 === 0 ? 'Completed' : 'Failed' }));
  const matches = filterPaymentHistory(history, { search: 'paid' });
  assert.deepEqual(ids(paginateRows(matches, 0, 10).rows), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  assert.deepEqual(ids(paginateRows(matches, 1, 10).rows), [20, 22, 24]);
});

test('both payment history layouts show the same page with a default of 10 rows', () => {
  const page = readFileSync(new URL('./payments.jsx', import.meta.url), 'utf8');
  assert.match(page, /<TextField\s+name="search"\s+type="search"[\s\S]*?onChange=\{handleHistoryFilterChange\}/);
  for (const boundary of ['fromDate', 'toDate']) {
    assert.match(page, new RegExp(`<TextField\\s+name="${boundary}"\\s+type="date"[\\s\\S]*?onChange=\\{handleHistoryFilterChange\\}`));
  }
  assert.match(page, /const handleHistoryFilterChange = \(event\) => \{[\s\S]*?setHistoryPage\(0\)/);
  assert.match(page, /\[historyPageSize, setHistoryPageSize\] = useState\(10\)/);
  assert.match(page, /paginateRows\(filteredPayments, historyPage, historyPageSize\)/);
  assert.equal((page.match(/visiblePayments\.map\(/g) || []).length, 2);
  assert.match(page, /<PortalListPagination\b[\s\S]*?itemLabel="payments"/);
});
