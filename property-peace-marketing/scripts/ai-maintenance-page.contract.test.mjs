import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(projectRoot, 'out', 'maintenance', 'ai-maintenance', 'index.html');

function readPage() {
  return fs.readFileSync(pagePath, 'utf8');
}

test('AI maintenance renders a light split hero with an accessible triage preview', () => {
  const html = readPage();

  assert.match(html, /data-marketing-hero-theme="light"/);
  assert.match(html, /data-marketing-hero-layout="split"/);
  assert.match(html, /aria-label="Maintenance request triage preview"/);
  assert.match(html, /Emergency priority/);
  assert.match(html, /Landlord review needed/);
});

test('AI maintenance discloses pilot availability and offers registration', () => {
  const html = readPage();

  assert.match(html, /limited Percy Pilot/i);
  assert.match(html, /href="https:\/\/app\.propertypeace\.io\/register"/);
});
