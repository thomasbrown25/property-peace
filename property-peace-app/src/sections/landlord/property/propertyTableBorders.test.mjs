import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const file of ['PropertyRecordsTabs.jsx', 'PropertyFinanceTable.jsx']) {
  test(`${file} keeps a divider on every body row, including the final or only row`, async () => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    // Repeat the parent class so this outranks the theme's last-of-type rule regardless of CSS insertion order.
    assert.match(source, /<TableBody sx=\{\{ '&& \.MuiTableRow-root > \.MuiTableCell-body': \{ borderBottom: '1px solid', borderColor: 'divider' \} \}\}>/);
  });
}

test('leases and tenants both use the bordered property records table', async () => {
  const source = await readFile(new URL('PropertyRecordsTabs.jsx', import.meta.url), 'utf8');
  for (const label of ['Leases', 'Tenants']) {
    assert.ok(source.includes(`<RecordsTable label="${label}"`));
  }
});
