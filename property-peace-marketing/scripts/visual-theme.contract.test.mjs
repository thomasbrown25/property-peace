import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function readExportedPage(relativePath) {
  return fs.readFileSync(path.join(projectRoot, 'out', relativePath, 'index.html'), 'utf8');
}

const decorativeGrid = /background-image:linear-gradient\(rgba\(255,255,255,.8\) 1px/g;
const startFreeGradient = /background:linear-gradient\(135deg, #22c55e, #16a34a\)/g;

test('new marketing surfaces do not render decorative background grids', () => {
  for (const relativePath of ['about', 'how-it-works', '']) {
    const html = readExportedPage(relativePath);
    assert.equal(html.match(decorativeGrid)?.length ?? 0, 0, `${relativePath || 'home'} should not render a decorative grid`);
  }
});

test('new page actions use the same green gradient as Start free', () => {
  for (const relativePath of ['about', 'how-it-works']) {
    const html = readExportedPage(relativePath);
    assert.ok((html.match(startFreeGradient)?.length ?? 0) >= 2, `${relativePath} should use the Start free gradient for its primary action`);
  }
});
