import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = await readFile(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');

test('property tabs parse and place Settings immediately after Documents in More', () => {
  assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  assert.match(source, /'documents', 'settings'\]/);
  assert.match(source, /\{ id: 'documents', label: 'Documents' \},\s*\{ id: 'settings', label: 'Settings' \}/);
  assert.match(source, /onTabChange\(section\.id\)/);
});

test('Settings renders property details and opens the selected property editor', () => {
  assert.match(source, /active === 'settings' && <Paper/);
  assert.match(source, /disabled=\{!read\(property, 'id'\)\}/);
  assert.match(source, /dispatch\(setProperty\(property\)\);\s*drawer\.openPropertyEditDrawer\(\);/);
  assert.match(source, />Edit property<\/Button>/);
});
