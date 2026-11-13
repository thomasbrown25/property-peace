import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property hero does not cast a shadow onto the tabs below', async () => {
  const header = await read('./PropertyHeader.jsx');
  const heroStyles = header.slice(header.indexOf('  return (', header.indexOf('export default function')), header.indexOf('{hasImage &&'));
  assert.doesNotMatch(heroStyles, /boxShadow:|0 30px 70px/);
});

test('activity card uses the neutral card style without an orange accent border or glow', async () => {
  const story = await read('./PropertyStory.jsx');
  assert.doesNotMatch(story, /propertyAccentCardSx/);
  assert.match(story, /border=\{false\}/);
  assert.match(story, /border: 'none'/);
  assert.match(story, /'&:hover': \{ border: 'none', boxShadow: 'none' \}/);
  assert.match(story, /'& \.MuiCardHeader-root': \{ pb: 1 \}/);
});
