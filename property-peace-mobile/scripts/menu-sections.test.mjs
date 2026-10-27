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
    { title: 'Leasing', labels: ['Calendar', 'Leases', 'New lease'] },
    { title: 'Property Operations', labels: ['Maintenance', 'Percy', 'Checklists', 'Vendors'] },
    { title: 'People & Communication', labels: ['Team', 'Announcements'] },
    { title: 'Accounting', labels: ['Online Payments', 'Finances', 'Tax Center', 'Reports'] },
    { title: 'Account & Help', labels: ['Settings', 'Support'] },
  ]);
});

test('tenant side menu has workflow groups and sign out stays under the final account group', () => {
  assert.deepEqual(sections('tenantMenu', 'webAppUrl'), [
    { title: 'Your home', labels: ['Leases', 'Documents', 'Payments', 'Maintenance', 'Messages'] },
    { title: 'Account', labels: ['Settings'] },
  ]);
  assert.match(source, /menu\.map\(\(section\) => \([\s\S]*accessibilityRole="header"[^\n]*section\.title[\s\S]*section\.items\.map\(\(item\)/);
  assert.match(source, /section === menu\[menu\.length - 1\][\s\S]*accessibilityLabel="Sign out"/);
});

test('side menu sign out uses the same icon and copy columns as navigation rows', () => {
  const signOut = source.slice(source.indexOf('accessibilityLabel="Sign out"'));
  assert.match(signOut, /<View style=\{\[styles\.actionIcon,[^\n]*\}><Ionicons name="log-out-outline"/);
  assert.match(signOut, /<View style=\{styles\.actionCopy\}>[\s\S]*<Text style=\{\[styles\.actionLabel/);
});

test('main Settings list has a confirmed Sign out at its bottom', async () => {
  const settings = await readFile(new URL('../src/screens/landlord/SettingsScreen.tsx', import.meta.url), 'utf8');
  assert.match(settings, /\{!category && visibleCategories\.map\([\s\S]*?\)\)\}[\s\S]*?\{!category && <TouchableOpacity[^>]*onPress=\{handleLogout\}[^>]*accessibilityLabel="Sign out"/);
  assert.match(settings, /indexContent: \{ flexGrow: 1 \}/);
  assert.match(settings, /indexSignOutButton: \{ marginTop: 'auto'/);
  assert.match(settings, /Alert\.alert\('Sign out', 'Are you sure you want to sign out\?',/);
});
