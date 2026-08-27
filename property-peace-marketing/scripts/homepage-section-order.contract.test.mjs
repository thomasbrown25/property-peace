import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

function markerIndex(text) {
  const index = homepage.indexOf(text);
  assert.notEqual(index, -1, `homepage should render “${text}”`);
  return index;
}

test('homepage omits the three retired landlord workflow sections', () => {
  for (const heading of [
    'How rent records and data are handled',
    'Built for the rental jobs small landlords search for every day',
    'Stay hands-on without holding',
  ]) {
    assert.doesNotMatch(homepage, new RegExp(heading), `homepage should not render “${heading}”`);
  }
});

test('homepage renders the final signup CTA immediately before FAQ', () => {
  const ctaIndex = markerIndex('Get started today for Free');
  const faqIndex = markerIndex('Questions landlords ask before getting started.');

  assert.ok(ctaIndex < faqIndex, 'signup CTA should render before FAQ');

  const sectionStarts = [...homepage.matchAll(/<section\b/g)].map((match) => match.index);
  const ctaSection = sectionStarts.findLastIndex((index) => index < ctaIndex);
  const faqSection = sectionStarts.findLastIndex((index) => index < faqIndex);

  assert.equal(faqSection, ctaSection + 1, 'FAQ should be the next rendered section after the signup CTA');
});
