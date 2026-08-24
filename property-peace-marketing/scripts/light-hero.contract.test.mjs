import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPage = (route) => fs.readFileSync(path.join(root, 'out', route, 'index.html'), 'utf8');
const lightTag = /<(?:section|div)[^>]*data-marketing-hero-theme="light"[^>]*>/i;

function assertLightHero(route) {
  const html = readPage(route);
  const tag = html.match(lightTag)?.[0];
  assert.ok(tag, `${route} should render a marked light hero`);
  assert.match(tag, /bg-white|from-white/, `${route} should render a white hero surface`);
  assert.doesNotMatch(tag, /(?:bg|from)-\[#061e35\]/i, `${route} should not render a navy hero surface`);
}

const nicheRoutes = [
  'free-landlord-software',
  'landlord-accounting-software',
  'property-management-software-for-small-landlords',
  'property-management-spreadsheet-alternative',
  'maintenance-request-software-for-landlords',
  'rent-collection-software-for-landlords',
];

test('shared SEO landing pages render light heroes', () => {
  nicheRoutes.forEach(assertLightHero);
});

const sharedFeatureRoutes = [
  'lease/ai-lease-creation',
  'lease/e-sign-docusign',
  'lease/online-condition-reports',
  'maintenance/in-app-messaging',
  'rent/accounting',
  'rent/custom-late-fees',
  'rent/expense-tracking',
  'rent/rent-reporting',
];

const featureDetailRoutes = fs
  .readdirSync(path.join(root, 'out', 'features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__next') && entry.name !== 'maintenance-tracking')
  .map((entry) => `features/${entry.name}`);

test('shared feature pages render light heroes', () => {
  [...sharedFeatureRoutes, ...featureDetailRoutes].forEach(assertLightHero);
});

const standaloneRoutes = [
  'about',
  'resources',
  'resources/starter-pack',
  'comparison/turbotenant',
  'lease-shield/blog',
];

test('standalone marketing pages render light heroes', () => {
  standaloneRoutes.forEach(assertLightHero);
});

function readLightHero(route) {
  const html = readPage(route);
  const openingMatch = html.match(lightTag);
  assert.ok(openingMatch?.index !== undefined, `${route} should render a marked light hero`);

  const tagPattern = /<\/?(?:section|div)\b[^>]*>/gi;
  tagPattern.lastIndex = openingMatch.index;
  let depth = 0;

  for (let tagMatch; (tagMatch = tagPattern.exec(html));) {
    const tag = tagMatch[0];
    if (tag.startsWith('</')) {
      depth -= 1;
    } else if (!tag.endsWith('/>')) {
      depth += 1;
    }

    if (depth === 0) {
      return html.slice(openingMatch.index, tagPattern.lastIndex);
    }
  }

  assert.fail(`${route} should close its marked light hero`);
}

function assertRenderedLightHeroPalette(route, hasQuietNavigation = true) {
  const hero = readLightHero(route);
  assert.match(hero, /<h1[^>]*text-\[#061E35\]/, `${route} should render a navy heading`);
  assert.match(hero, /<p[^>]*text-\[#405A70\]/, `${route} should render muted body copy`);
  assert.match(hero, /<a(?=[^>]*href="\/pricing\/?")(?=[^>]*border-\[#DCE6ED\])(?=[^>]*text-\[#061E35\])[^>]*>/, `${route} should render a light bordered secondary action`);
  assert.match(hero, /text-\[#16A34A\]/, `${route} should render green accents`);

  if (hasQuietNavigation) {
    assert.match(hero, /text-\[#637083\]/, `${route} should render quiet navigation`);
  }
}

const paletteRoutes = [
  ['lease/ai-lease-creation', true],
  ['features/ai-summaries', true],
  ['features/rent-collection', true],
  ['features/lease-shield', false],
];

test('representative marked heroes render the shared palette', () => {
  paletteRoutes.forEach(([route, hasQuietNavigation]) => assertRenderedLightHeroPalette(route, hasQuietNavigation));
});
