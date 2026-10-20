import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');

function sections(name, nextName) {
  const start = source.indexOf(`const ${name}: MenuSection[] = [`);
  const end = source.indexOf(`const ${nextName}`, start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  return [...body.matchAll(/\{ title: '([^']+)', items: \[([\s\S]*?)\] \}/g)]
    .map(([, title, items]) => ({ title, labels: [...items.matchAll(/label: '([^']+)'/g)].map(([, label]) => label) }));
}

test('landlord side menu keeps every destination in a workflow section and order', () => {
  assert.deepEqual(sections('landlordMenu', 'tenantMenu'), [
    { title: 'Leasing', labels: ['Calendar', 'Leases'] },
    { title: 'Property Operations', labels: ['Maintenance', 'Percy', 'Checklists', 'Vendors'] },
    { title: 'People & Communication', labels: ['Team', 'Announcements'] },
    { title: 'Accounting', labels: ['Online Payments', 'Finances', 'Tax Center', 'Reports'] },
    { title: 'Account & Help', labels: ['Support'] },
  ]);
});

test('tenant side menu has workflow groups and sign out stays under the final account group', () => {
  assert.deepEqual(sections('tenantMenu', 'webAppUrl'), [
    { title: 'Home & Leasing', labels: ['Dashboard', 'My Lease', 'Applications'] },
    { title: 'Payments & Documents', labels: ['Payments', 'Documents'] },
    { title: 'Account', labels: [] },
  ]);
  assert.match(source, /menu\.map\(\(section\) => \([\s\S]*accessibilityRole="header"[^\n]*section\.title[\s\S]*section\.items\.map\(\(item\)/);
  assert.match(source, /section === menu\[menu\.length - 1\][\s\S]*accessibilityLabel="Sign out"/);
});
