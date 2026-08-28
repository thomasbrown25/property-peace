import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const calendarSourceUrl = new URL('./calendar.jsx', import.meta.url);

async function getEventColorsBody() {
  const source = await readFile(calendarSourceUrl, 'utf8');
  const match = source.match(/function getEventColors\(event\) \{([\s\S]*?)\n\}/);

  assert.ok(match, 'calendar should define getEventColors');
  return match[1];
}

test('calendar event colors follow category rather than payment status', async () => {
  const body = await getEventColorsBody();

  assert.doesNotMatch(body, /event\.status/);
  assert.match(body, /CATEGORY_COLORS\[event\?\.category\]/);
});
