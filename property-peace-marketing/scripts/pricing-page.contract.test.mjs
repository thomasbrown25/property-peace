import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pricingPage = path.join(projectRoot, 'out', 'pricing', 'index.html');

test('pricing ends after its FAQ without the generic final CTA section', () => {
  const html = fs.readFileSync(pricingPage, 'utf8');

  assert.match(html, /<h1[^>]*>Free<\/h1>/);
  assert.match(html, /No credit card required\./);
  assert.match(html, /Unlimited units/);
  assert.match(html, /LeaseShield protection/);
  assert.match(html, /Percy Pilot workflows \(limited availability\)/);
  assert.match(html, /Online rent payments \(approval required\)/);
  assert.match(html, /FAQ/);
  assert.doesNotMatch(html, /Toggle annual billing|Billed \$|Everything in Free|Up to 5 units|included with Premium/);
  assert.doesNotMatch(html, /Get started today for Free/);
});
