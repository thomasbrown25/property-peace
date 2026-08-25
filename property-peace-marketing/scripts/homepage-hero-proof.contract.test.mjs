import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

test('homepage hero renders its proof line and three chips beneath the CTA rows', () => {
  const heroStart = homepage.indexOf('data-marketing-hero="home-image"');
  const heroEnd = homepage.indexOf('</section>', heroStart);
  const hero = homepage.slice(heroStart, heroEnd);
  const proofIndex = hero.indexOf('data-hero-proof="true"');
  const chips = hero.match(/<li(?=[^>]*data-hero-proof-chip="true")[^>]*>/g) ?? [];

  assert.notEqual(proofIndex, -1, 'hero should render its proof block');
  assert.ok(proofIndex > hero.lastIndexOf('Book Demo'), 'proof block should follow both CTA variants');
  assert.match(hero, /Top landlord management software · No credit card required/);
  assert.equal(chips.length, 3);

  for (const chip of chips) {
    assert.match(chip, /rounded-full/);
    assert.match(chip, /border-white\/30/);
    assert.match(chip, /bg-white\/10/);
    assert.match(chip, /py-1\.5/);
  }

  for (const label of [
    'Track rent and maintenance',
    'Made for all portfolios',
    'Grow your rental business',
  ]) {
    assert.match(hero, new RegExp(`data-hero-proof-chip="true"[^>]*>${label}<`));
  }

  assert.match(hero, /data-hero-proof-chips="true"[^>]*flex-wrap[^>]*justify-center[^>]*lg:justify-start/);
});
