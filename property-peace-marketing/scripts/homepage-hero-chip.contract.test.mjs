import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

test('homepage hero chip uses the approved emerald production treatment', () => {
  const heroStart = homepage.indexOf('data-marketing-hero="home-image"');
  const heroEnd = homepage.indexOf('</section>', heroStart);
  const hero = homepage.slice(heroStart, heroEnd);
  const chip = hero.match(/<p\b[^>]*>#1 Property Management Software<\/p>/i);

  assert.ok(chip, 'homepage hero should render its positioning chip');
  assert.match(chip[0], /border-emerald-300\/35/);
  assert.match(chip[0], /bg-emerald-300\/10/);
  assert.match(chip[0], /text-emerald-200/);
  assert.match(chip[0], /tracking-\[0\.12em\]/);
  assert.doesNotMatch(chip[0], /border-green-300\/60|bg-\[#061E35\]\/45|text-green-100|border-\[#4A928A\]/);
});
