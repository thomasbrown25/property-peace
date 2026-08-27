import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

function indexOfMarker(marker) {
  const index = homepage.indexOf(marker);
  assert.notEqual(index, -1, `homepage should render ${marker}`);
  return index;
}

function readMarkedSection(marker) {
  const markerIndex = indexOfMarker(marker);
  const sectionStart = homepage.lastIndexOf('<section', markerIndex);
  assert.notEqual(sectionStart, -1, `${marker} should live in a section`);

  const tagPattern = /<\/?section\b[^>]*>/gi;
  tagPattern.lastIndex = sectionStart;
  let depth = 0;

  for (let match; (match = tagPattern.exec(homepage));) {
    if (match[0].startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) return homepage.slice(sectionStart, tagPattern.lastIndex);
  }

  assert.fail(`${marker} section should close`);
}

test('homepage places the feature wheel between the hero and customer reviews', () => {
  const heroIndex = indexOfMarker('data-marketing-hero="home-image"');
  const wheelIndex = indexOfMarker('data-homepage-feature-wheel="true"');
  const reviewsIndex = indexOfMarker('data-homepage-review-marquee="true"');

  assert.ok(heroIndex < wheelIndex, 'feature wheel should render after the hero');
  assert.ok(wheelIndex < reviewsIndex, 'customer reviews should follow the feature wheel');
});

test('feature wheel provides seven supported workflows and a mobile card layout', () => {
  const wheel = readMarkedSection('data-homepage-feature-wheel="true"');
  const cards = wheel.match(/data-feature-wheel-card="true"/g) ?? [];

  assert.equal(cards.length, 7);
  assert.match(wheel, /data-feature-wheel-mobile="true"/);
  assert.match(wheel, /images\/logos\/logo-dark-2\.png/);

  for (const feature of [
    'Portfolio dashboard',
    'Rent tracking',
    'Tenant and lease records',
    'Maintenance tracking',
    'Expense tracking',
    'Document storage',
    'Reports and exports',
  ]) {
    assert.match(wheel, new RegExp(feature));
  }

  assert.doesNotMatch(wheel, /tenant screening|online payments|rental website|listing syndication/i);
});
