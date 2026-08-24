import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPage = (route) => fs.readFileSync(path.join(root, 'out', route, 'index.html'), 'utf8');

test('homepage initially renders transparent navigation', () => {
  const html = readPage('');
  assert.match(html, /data-navigation-surface="transparent"/);
  assert.match(html, /data-navigation-height="88"/);
});

test('homepage image hero reaches behind the navigation', () => {
  const html = readPage('');
  assert.match(html, /data-marketing-hero="home-image"/);
  assert.match(html, /hero-smart-home-entry\.jpg/);
});

test('secondary routes initially render white navigation', () => {
  for (const route of ['about', 'features', 'resources', 'pricing']) {
    assert.match(readPage(route), /data-navigation-surface="white"/, route);
  }
});
