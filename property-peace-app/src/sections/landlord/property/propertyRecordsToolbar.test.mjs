import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = fs.readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');

test('property record and finance toolbar JSX parses', () => {
  for (const file of ['PropertyRecordsTabs.jsx', 'PropertyFinanceTable.jsx']) {
    assert.doesNotThrow(() => parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] }));
  }
});

test('record search fills available width and add follows the status filter', () => {
  const toolbar = source.slice(source.indexOf('<Stack direction='), source.indexOf('{error &&'));
  assert.match(toolbar, /fullWidth sx=\{\{ flex: 1, minWidth: 0 \}\}/);
  assert.doesNotMatch(toolbar, /maxWidth/);
  assert.ok(toolbar.indexOf('</FormControl>') < toolbar.indexOf('onClick={onAdd}'));
  assert.match(toolbar, /flexShrink: 0/);
});

test('each record tab has a wired creation action using existing flows', () => {
  for (const kind of ['leases', 'tenants', 'maintenances', 'listings', 'applications']) {
    assert.ok(source.includes(`onAdd={() => addRecord('${kind}')}`));
  }
  assert.match(source, /dispatch\(setProperty\(property\)\)/);
  assert.match(source, /leases\/builder\?propertyId=/);
  for (const name of ['Tenant', 'Maintenance', 'Listing', 'Application']) {
    assert.ok(source.includes(`drawer.open${name}AddDrawer(`));
  }
  assert.match(source, /drawer.isOpenTenantAdd && <TenantAddDrawer/);
  assert.match(source, /drawer.isOpenApplicationAdd && <ApplicationAddDrawer/);
});
