import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pricingPage = path.join(projectRoot, 'out', 'pricing', 'index.html');

test('pricing ends after its FAQ without the generic final CTA section', () => {
  const html = fs.readFileSync(pricingPage, 'utf8');

  assert.match(html, /Simple, transparent pricing for landlords/);
  assert.match(html, /Questions landlords ask before getting started\./);
  assert.doesNotMatch(html, /Get started today for Free/);
});
