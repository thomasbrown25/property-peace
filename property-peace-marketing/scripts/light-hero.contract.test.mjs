import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPage = (route) => fs.readFileSync(path.join(root, 'out', route, 'index.html'), 'utf8');
// The legacy "light" marker still identifies shared templates, not their actual surface.
// Assert the rendered semantic palette instead of treating that marker as a color.
const markedHeroTag = /<(?:section|div)[^>]*data-marketing-hero-theme="(?:light|dark)"[^>]*>/i;

function readMarkedHero(route) {
  const html = readPage(route);
  const openingMatch = html.match(markedHeroTag);
  assert.ok(openingMatch?.index !== undefined, `${route} should render a marked hero`);
  const tagPattern = /<\/?(?:section|div)\b[^>]*>/gi;
  tagPattern.lastIndex = openingMatch.index;
  let depth = 0;
  for (let tagMatch; (tagMatch = tagPattern.exec(html));) {
    const tag = tagMatch[0];
    if (tag.startsWith('</')) depth -= 1;
    else if (!tag.endsWith('/>')) depth += 1;
    if (depth === 0) return html.slice(openingMatch.index, tagPattern.lastIndex);
  }
  assert.fail(`${route} should close its marked hero`);
}

function assertForestHero(route) {
  const hero = readMarkedHero(route);
  assert.match(hero.match(markedHeroTag)[0], /\bbg-brand-forest\b/, `${route} should render a forest surface`);
  assert.doesNotMatch(hero.match(markedHeroTag)[0], /(?:bg|from)-\[#061e35\]/i, `${route} should not render a legacy navy surface`);
  assert.match(hero, /<h1[^>]*class="[^"]*\btext-(?:white|brand-mint)\b[^>]*>[^<\s]/, `${route} should render an explicit contrasting, nonempty heading`);
  assert.match(hero, /<p[^>]*class="[^"]*\btext-(?:brand-ivory|white\/(?:75|80|90))\b/, `${route} should render explicit readable hero copy`);
}

const nicheRoutes = [
  'free-landlord-software',
  'landlord-accounting-software',
  'property-management-software-for-small-landlords',
  'property-management-spreadsheet-alternative',
  'maintenance-request-software-for-landlords',
  'rent-collection-software-for-landlords',
];

test('shared SEO landing pages render forest heroes with contrasting headings and copy', () => {
  nicheRoutes.forEach(assertForestHero);
});

test('shared SEO landing pages render split heroes with framed proof artifacts', () => {
  for (const route of nicheRoutes) {
    const hero = readMarkedHero(route);
    assert.match(hero, /<div(?=[^>]*data-marketing-hero-layout="split")(?=[^>]*lg:grid-cols-)[^>]*>/, `${route} should render a responsive two-column composition`);
    assert.match(hero, /<div(?=[^>]*data-marketing-hero-proof="artifact")(?=[^>]*border-\[var\(--brand-border\)\])(?=[^>]*bg-brand-surface)[^>]*>/, `${route} should render proof in a framed light artifact`);
  }
});

test('shared SEO heroes render teal eyebrows on explicit light surfaces', () => {
  for (const route of nicheRoutes) {
    assert.match(readMarkedHero(route), /<p(?=[^>]*data-marketing-hero-eyebrow="true")(?=[^>]*text-brand-teal)(?=[^>]*bg-brand-surface)[^>]*>/, `${route} should keep the eyebrow readable independently of its forest surroundings`);
  }
});

const sharedFeatureRoutes = [
  'lease/ai-lease-creation', 'lease/e-sign-docusign', 'lease/online-condition-reports',
  'maintenance/in-app-messaging', 'rent/accounting', 'rent/custom-late-fees',
  'rent/expense-tracking', 'rent/rent-reporting',
];
const featureDetailRoutes = fs.readdirSync(path.join(root, 'out', 'features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__next') && entry.name !== 'maintenance-tracking')
  .map((entry) => `features/${entry.name}`);

test('shared feature pages render forest heroes with contrasting headings and copy', () => {
  assert.ok(featureDetailRoutes.length > 0, 'the export should include feature detail pages');
  [...sharedFeatureRoutes, ...featureDetailRoutes].forEach(assertForestHero);
});

test('Maintenance Tracking retains its framed-image forest hero', () => {
  assertForestHero('features/maintenance-tracking');
  assert.match(readMarkedHero('features/maintenance-tracking'), /maintenance-tracking-hero\.jpg/);
});

const standaloneRoutes = ['about', 'resources', 'resources/starter-pack', 'comparison/turbotenant', 'lease-shield/blog'];
test('standalone marketing pages render forest heroes with contrasting headings and copy', () => {
  standaloneRoutes.forEach(assertForestHero);
});

test('LeaseShield Blog preview renders explicit slate copy on a light artifact', () => {
  const hero = readMarkedHero('lease-shield/blog');
  assert.match(hero, /<div(?=[^>]*border-\[var\(--brand-border\)\])(?=[^>]*bg-brand-surface)(?=[^>]*p-6)[^>]*>/);
  assert.match(hero, /<p(?=[^>]*text-brand-slate)[^>]*>LeaseShield summarizes the applicable state rule/);
});

test('LeaseShield Blog preview headings render explicit forest ink', () => {
  const hero = readMarkedHero('lease-shield/blog');
  const expectations = [
    /<div(?=[^>]*text-brand-forest)[^>]*>[^<]*<svg[^>]*>.*?<\/svg> Sample source-backed answer<\/div>/,
    /<p(?=[^>]*text-brand-forest)[^>]*>“How long do I have to return a security deposit\?”<\/p>/,
    /<div(?=[^>]*text-brand-forest)[^>]*>[^<]*<svg[^>]*>.*?<\/svg> Example citations<\/div>/,
  ];
  expectations.forEach((expectation) => assert.match(hero, expectation));
});

function assertRenderedForestHeroPalette(route, hasQuietNavigation = true) {
  const hero = readMarkedHero(route);
  assertForestHero(route);
  assert.match(hero, /<a(?=[^>]*href="\/pricing\/?")(?=[^>]*border-\[var\(--brand-border\)\])(?=[^>]*bg-brand-surface)(?=[^>]*text-brand-forest)[^>]*>/, `${route} should render a light bordered secondary action with forest ink`);
  assert.match(hero, /<a(?=[^>]*href="https:\/\/app\.propertypeace\.io\/register")(?=[^>]*(?:bg-brand-teal|from-brand-teal))(?=[^>]*text-white)[^>]*>/, `${route} should render a teal primary action with white text`);
  assert.match(hero, /text-brand-(?:mint|teal)/, `${route} should render semantic brand accents`);
  if (hasQuietNavigation) {
    assert.match(hero, /<a(?=[^>]*href="\/features\/[^\"]*")(?=[^>]*text-(?:brand-ivory|white\/75))[^>]*>/, `${route} should render readable quiet navigation`);
  }
}

const paletteRoutes = [
  ['lease/ai-lease-creation', true], ['features/ai-summaries', true],
  ['features/rent-collection', false], ['features/lease-shield', false],
];
test('representative marked heroes render contrasting semantic actions and navigation', () => {
  paletteRoutes.forEach(([route, hasQuietNavigation]) => assertRenderedForestHeroPalette(route, hasQuietNavigation));
});
