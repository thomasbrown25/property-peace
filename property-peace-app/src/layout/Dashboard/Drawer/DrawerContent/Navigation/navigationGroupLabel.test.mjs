import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./NavGroup.jsx', import.meta.url), 'utf8');

test('expanded drawer group labels use compact uppercase section styling', () => {
  assert.match(source, /textTransform: 'uppercase'/);
  assert.match(source, /letterSpacing: '0\.04em'/);
  assert.match(source, /fontSize: '0\.6875rem'/);
  assert.match(source, /fontWeight: 700/);
});
