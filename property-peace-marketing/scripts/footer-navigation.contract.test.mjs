import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function loadFooterNavigation() {
  try {
    return await import('../lib/footer-navigation.mjs');
  } catch {
    return null;
  }
}

test('footer navigation exposes the key product, resource, and company journeys', async () => {
  const navigationModule = await loadFooterNavigation();

  assert.ok(navigationModule, 'footer navigation model should be available');

  const groups = navigationModule.footerNavigation;
  const destinations = new Set(groups.flatMap((group) => group.links.map((link) => link.href)));

  assert.deepEqual(
    groups.map((group) => group.title),
    ['Product', 'Solutions', 'Resources', 'Company', 'Account'],
  );

  for (const href of [
    '/features/rental-applications',
    '/features/lease-management',
    '/rent-collection-software-for-landlords',
    '/maintenance-request-software-for-landlords',
    '/property-management-app',
    '/comparison/turbotenant',
    '/resources/starter-pack',
    '/about',
    '/how-it-works',
    '/contact-us',
    '/demo',
  ]) {
    assert.ok(destinations.has(href), `footer should link to ${href}`);
  }
});

test('generated sitemap publishes the new trust and product-explanation pages', () => {
  execFileSync(process.execPath, ['scripts/generate-sitemap.mjs'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  const sitemap = fs.readFileSync(path.join(projectRoot, 'public', 'sitemap.xml'), 'utf8');

  assert.match(sitemap, /<loc>https:\/\/propertypeace\.io\/about\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/propertypeace\.io\/how-it-works\/<\/loc>/);
});
