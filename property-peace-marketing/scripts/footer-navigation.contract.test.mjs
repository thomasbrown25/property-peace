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


test('footer copyright and creator labels render in solid white', () => {
  const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

  for (const label of [
    '© 2026 Property Peace. All rights reserved.',
    'Created by Brownstone Hub LLC',
  ]) {
    const labelIndex = homepage.indexOf(label);
    assert.notEqual(labelIndex, -1, `footer should render “${label}”`);

    const paragraphStart = homepage.lastIndexOf('<p', labelIndex);
    const paragraphEnd = homepage.indexOf('</p>', labelIndex);
    assert.notEqual(paragraphStart, -1, `“${label}” should render in a paragraph`);
    assert.notEqual(paragraphEnd, -1, `“${label}” paragraph should close`);

    const paragraph = homepage.slice(paragraphStart, paragraphEnd);
    assert.match(paragraph, /class="[^"]*\btext-white\b[^"]*"/, `“${label}” should use solid white text`);
  }
});
