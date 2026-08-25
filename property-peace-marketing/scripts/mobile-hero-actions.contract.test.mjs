import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

test('mobile hero renders only the two CTA buttons without a promotional card', () => {
  const mobileWrapper = homepage.match(/<div class="([^"]*\bsm:hidden\b[^"]*)">/);
  assert.ok(mobileWrapper?.index !== undefined, 'homepage should render a mobile-only CTA wrapper');

  const wrapperClasses = mobileWrapper[1];
  for (const cardClass of ['rounded-[2rem]', 'bg-[#061E35]', 'shadow-[0_26px_80px_rgba(6,30,53,0.36)]', 'ring-1']) {
    assert.ok(!wrapperClasses.includes(cardClass), `mobile CTA wrapper should not use ${cardClass}`);
  }

  const desktopActionsIndex = homepage.indexOf('<div class="hidden max-w-lg', mobileWrapper.index);
  assert.notEqual(desktopActionsIndex, -1, 'homepage should render the tablet and desktop CTA row');

  const mobileActions = homepage.slice(mobileWrapper.index, desktopActionsIndex);
  assert.doesNotMatch(mobileActions, /Property Peace makes life easier\./);
  assert.doesNotMatch(mobileActions, /From one unit to fifty/);
  assert.match(mobileActions, /href="https:\/\/app\.propertypeace\.io\/register"[^>]*>Get Started Free<\/a>/);
  assert.match(mobileActions, /href="\/demo\/?"[^>]*>Book Demo<\/a>/);
});
test('desktop hero keeps the content stack compact and vertically balanced', () => {
  const description = homepage.match(/<p class="([^"]*max-w-\[21\.5rem\][^"]*)"[^>]*>\s*Manage tenants and leases/);
  assert.ok(description, 'homepage should render the hero description');
  assert.match(description[1], /(?:^|\s)lg:max-w-\[36rem\](?:\s|$)/, 'desktop description should be wide enough to avoid an unnecessary fourth line');
  assert.match(description[1], /(?:^|\s)lg:mb-8(?:\s|$)/, 'desktop description should keep a compact 32px gap before the CTAs');

  const proofBlock = homepage.match(/<div data-hero-proof="true" class="([^"]*)">/);
  assert.ok(proofBlock, 'homepage should render the hero proof block');
  assert.match(proofBlock[1], /(?:^|\s)sm:mt-3(?:\s|$)/, 'tablet and desktop proof content should sit 12px below the CTAs');
});
test('mobile hero leaves breathing room before the rounded second section', () => {
  const mobileWrapper = homepage.match(/<div class="([^"]*\bsm:hidden\b[^"]*)">/);
  assert.ok(mobileWrapper, 'homepage should render a mobile-only CTA wrapper');
  assert.match(mobileWrapper[1], /(?:^|\s)pb-8(?:\s|$)/, 'mobile CTA wrapper should add 32px of bottom padding');

  const featureWheelSection = homepage.match(/<section[^>]*data-homepage-feature-wheel="true"[^>]*>/)?.[0];
  assert.ok(featureWheelSection, 'homepage should render the feature wheel as its second section');
  assert.match(featureWheelSection, /(?:^|\s)-mt-8(?:\s|$)/);
  assert.match(featureWheelSection, /rounded-t-\[2rem\]/);
  assert.match(featureWheelSection, /sm:-mt-10/);
  assert.match(featureWheelSection, /sm:rounded-t-\[2\.5rem\]/);
  assert.match(featureWheelSection, /lg:-mt-12/);
  assert.match(featureWheelSection, /lg:rounded-t-\[3rem\]/);
});