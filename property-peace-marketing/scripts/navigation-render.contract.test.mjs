import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPage = (route) => fs.readFileSync(path.join(root, 'out', route, 'index.html'), 'utf8');

function readNavigation(route) {
  const html = readPage(route);
  const start = html.indexOf('<nav class="marketing-nav');
  assert.notEqual(start, -1, `${route || '/'} should render the marketing navigation`);
  const end = html.indexOf('</nav>', start);
  assert.notEqual(end, -1, `${route || '/'} should close the marketing navigation`);
  return html.slice(start, end + '</nav>'.length);
}

test('homepage initially renders transparent navigation', () => {
  const html = readPage('');
  assert.match(html, /data-navigation-surface="transparent"/);
  assert.match(html, /data-navigation-height="88"/);
});

test('homepage image hero reaches behind the navigation', () => {
  const html = readPage('');
  assert.match(html, /data-marketing-hero="home-image"/);
  assert.match(html, /hero-smart-home-entry\.jpg/);
});

test('secondary routes initially render white navigation', () => {
  for (const route of ['about', 'features', 'resources', 'pricing']) {
    assert.match(readPage(route), /data-navigation-surface="white"/, route);
  }
});

test('desktop Features renders an accessible disclosure and linked panel', () => {
  const navigation = readNavigation('features');

  assert.match(
    navigation,
    /<button(?=[^>]*id="desktop-features-trigger")(?=[^>]*aria-haspopup="true")(?=[^>]*aria-expanded="false")(?=[^>]*aria-controls="desktop-features-dropdown")[^>]*>/,
  );
  assert.match(
    navigation,
    /<div(?=[^>]*id="desktop-features-dropdown")(?=[^>]*data-navigation-features-panel="true")(?=[^>]*aria-hidden="true")[^>]*>/,
  );
});

test('white navigation renders accessible text and gradient CTA tokens', () => {
  const navigation = readNavigation('features');

  assert.match(navigation, /hover:text-\[#15803D\]/);
  assert.match(
    navigation,
    /<a(?=[^>]*href="https:\/\/app\.propertypeace\.io\/register")(?=[^>]*text-\[#061E35\])[^>]*>Start free<\/a>/,
  );
});

test('desktop CTA and Features panel use color and opacity transitions without movement', () => {
  const navigation = readNavigation('features');
  const cta = navigation.match(
    /<a(?=[^>]*href="https:\/\/app\.propertypeace\.io\/register")[^>]*>Start free<\/a>/,
  )?.[0];
  const panel = navigation.match(
    /<div(?=[^>]*id="desktop-features-dropdown")[^>]*>/,
  )?.[0];

  assert.ok(cta, 'desktop Start free CTA should render');
  assert.match(cta, /transition-\[color,border-color,box-shadow,opacity\]/);
  assert.match(cta, /duration-\[220ms\]/);
  assert.match(cta, /motion-reduce:transition-none/);
  assert.doesNotMatch(cta, /transition-all|translate|transform/);

  assert.ok(panel, 'desktop Features panel should render');
  assert.match(panel, /transition-opacity/);
  assert.match(panel, /duration-\[220ms\]/);
  assert.match(panel, /motion-reduce:transition-none/);
  assert.doesNotMatch(panel, /transition-all|transition-transform|translate|transform/);
});
