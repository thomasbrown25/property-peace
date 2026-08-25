import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');
const heroStart = homepage.indexOf('data-marketing-hero="home-image"');
const heroEnd = homepage.indexOf('</section>', heroStart);

assert.notEqual(heroStart, -1, 'homepage should render the image hero');
assert.notEqual(heroEnd, -1, 'homepage hero should close');

const hero = homepage.slice(heroStart, heroEnd);

test('hero copy is centered on mobile and returns to a left anchor on desktop', () => {
  const copyContainer = hero.match(/<div(?=[^>]*class="w-full text-center[^\"]*")[^>]*>/i);
  const chip = hero.match(/<p\b[^>]*>#1 Property Management Software<\/p>/i);
  const title = hero.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
  const supportingCopy = hero.match(/<p\b[^>]*>Manage tenants and leases,[\s\S]*?<\/p>/i);

  assert.ok(copyContainer, 'hero should render its centered copy container');
  assert.ok(chip, 'hero should render its chip');
  assert.ok(title, 'hero should render its title');
  assert.ok(supportingCopy, 'hero should render its supporting copy');

  assert.match(copyContainer[0], /lg:text-left/);
  assert.match(chip[0], /lg:mx-0/);
  assert.match(title[0], /lg:mx-0/);
  assert.match(supportingCopy[0], /lg:mx-0/);
});
