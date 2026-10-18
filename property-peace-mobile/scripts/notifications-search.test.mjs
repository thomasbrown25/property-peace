import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('notifications header opens the existing menu and orders search before messages', async () => {
  const screen = await source('../src/screens/landlord/NotificationsScreen.tsx');
  const headerStart = screen.indexOf('<View style={styles.headerRow}>');
  const header = screen.slice(headerStart, screen.indexOf('      </View>', headerStart));
  assert.match(screen, /onPress=\{moreDrawer\.show\}/);
  assert.ok(header.indexOf('menu-outline') < header.indexOf('Notifications</Text>'));
  assert.ok(header.indexOf('Notifications</Text>') < header.indexOf('search-outline'));
  assert.ok(header.indexOf('search-outline') < header.indexOf('chatbubble-ellipses-outline'));
  assert.doesNotMatch(screen, /PageBackButton/);
  assert.match(screen, /navigation\.navigate\('Messages'\)/);
});

test('search uses the web global endpoint and opens matching native detail screens', async () => {
  const [api, modal, screen] = await Promise.all([
    source('../src/api/searchAPI.ts'),
    source('../src/components/GlobalSearchModal.tsx'),
    source('../src/screens/landlord/NotificationsScreen.tsx'),
  ]);
  assert.match(api, /api\/search\/global\?query=\$\{encodeURIComponent\(query\.trim\(\)\)\}/);
  assert.match(modal, /globalSearch\(term\)/);
  for (const [type, route, detail] of [['property', 'Properties', 'PropertyDetail'], ['tenant', 'Tenants', 'TenantDetail'], ['lease', 'Leases', 'LeaseDetail']]) {
    assert.match(screen, new RegExp(`type === '${type}'[\\s\\S]*?navigate\\('${route}', \\{ screen: '${detail}'`));
  }
});
