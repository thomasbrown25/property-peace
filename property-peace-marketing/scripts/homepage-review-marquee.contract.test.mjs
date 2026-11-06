import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');
const homeSource = fs.readFileSync(path.join(projectRoot, 'app/page.tsx'), 'utf8');
const reviewSource = fs.readFileSync(path.join(projectRoot, 'components/Sections/CustomerReviewMarquee.tsx'), 'utf8');
const smallLandlordTools = fs.readFileSync(path.join(projectRoot, 'app/small-landlord-tools/page.tsx'), 'utf8');

test('homepage goes from hero to feature wheel without customer reviews', () => {
  const heroIndex = homepage.indexOf('data-marketing-hero="home-image"');
  const wheelIndex = homepage.indexOf('data-homepage-feature-wheel="true"');
  assert.ok(heroIndex !== -1 && wheelIndex > heroIndex);
  assert.doesNotMatch(homeSource, /CustomerReviewMarquee/);
  assert.doesNotMatch(homepage, /data-homepage-review-marquee|data-review-card|Property Peace customer reviews|Mato P\.|Alexander C\.|Priya S\./);
});

test('marketing pages do not claim an unverified landlord count', () => {
  assert.doesNotMatch(homepage, /(?:500|2,000)\+\s*Landlords|thousands of (?:small )?landlords/i);
  assert.doesNotMatch(reviewSource, /(?:500|2,000)\+\s*Landlords/i);
  assert.doesNotMatch(smallLandlordTools, /thousands of (?:small )?landlords/i);
});
