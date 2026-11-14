import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const overrides = readFileSync(new URL('../themes/overrides/index.js', import.meta.url), 'utf8');

test('theme override factory passes the current theme to TableContainer', () => {
  assert.match(overrides, /TableContainer\(theme\)/);
});
