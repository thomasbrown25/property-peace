import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const records = readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');
const occupancy = readFileSync(new URL('./PropertyOccupancyTab.jsx', import.meta.url), 'utf8');

test('all five property record tables center their loading indicator in the table footprint', () => {
  for (const tab of ['leases', 'tenants', 'maintenances', 'listings', 'applications']) {
    assert.match(records, new RegExp(`active === '${tab}' && <(?:RecordsTable|PropertyLeasingRecords)`));
  }
  assert.match(records, /loading \? <Box[^>]*minHeight: \{ xs: 260, sm: 360 \}[^>]*display: 'grid', placeItems: 'center'[^>]*>\s*<CircularProgress aria-label=\{`Loading \$\{label\.toLowerCase\(\)\}`\} \/>/);
});

test('property occupancy timeline centers its loading indicator in the timeline footprint', () => {
  assert.match(occupancy, /loading && <Box[^>]*display: 'grid', placeItems: 'center'[^>]*>\s*<CircularProgress aria-label="Loading occupancy" \/>/);
});
