import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(projectRoot, 'out', 'maintenance', 'ai-maintenance', 'index.html');

test('AI maintenance FAQ exposes accordion state to assistive technology', () => {
  const html = fs.readFileSync(pagePath, 'utf8');

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="ai-maintenance-faq-panel-0"/);
  assert.match(html, /id="ai-maintenance-faq-panel-0"/);
});
