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

const readSource = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function assertLightHeroPalette(source, label, hasQuietNavigation = false) {
  ['#061E35', '#405A70', '#DCE6ED', '#16A34A'].forEach((token) => {
    assert.ok(source.includes(token), `${label} should use ${token} in its marked light hero`);
  });

  if (hasQuietNavigation) {
    assert.ok(source.includes('#637083'), `${label} should use #637083 for quiet navigation`);
  }
}

test('marked light hero sources use the shared palette', () => {
  const featureLandingSource = readSource('components/Marketing/FeatureLandingPage.tsx');
  const featureHeroStart = featureLandingSource.indexOf('data-marketing-hero-theme="light"');
  const featureHero = featureLandingSource.slice(featureHeroStart, featureLandingSource.indexOf('<div className="rounded-[2rem]"', featureHeroStart));

  const featureDetailSource = readSource('app/features/[slug]/page.tsx');
  const sharedHeroStart = featureDetailSource.indexOf('const renderHero');
  const sharedHero = featureDetailSource.slice(sharedHeroStart, featureDetailSource.indexOf('const renderMaintenanceTrackingHero', sharedHeroStart));
  const rentHeroStart = featureDetailSource.indexOf('const renderRentCollectionHero');
  const rentHero = featureDetailSource.slice(rentHeroStart, featureDetailSource.indexOf('return (', rentHeroStart));

  const leaseShieldSource = readSource('app/features/lease-shield/page.tsx');
  const leaseShieldHeroStart = leaseShieldSource.indexOf('data-marketing-hero-theme="light"');
  const leaseShieldHero = leaseShieldSource.slice(leaseShieldHeroStart, leaseShieldSource.indexOf('<FeatureHeroMock', leaseShieldHeroStart));

  [
    [featureHero, 'FeatureLandingPage', true],
    [sharedHero, 'shared feature detail hero', true],
    [rentHero, 'Rent Collection hero', true],
    [leaseShieldHero, 'LeaseShield hero'],
  ].forEach(([source, label, hasQuietNavigation]) => assertLightHeroPalette(source, label, hasQuietNavigation));
});
