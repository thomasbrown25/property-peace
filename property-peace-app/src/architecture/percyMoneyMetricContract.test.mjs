import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../../../property-peace-api/Services/AICopilotService/AICopilotService.Chat.cs', import.meta.url),
  'utf8'
);

test('Percy tells the model to return raw numeric strings for money metrics', () => {
  assert.match(source, /For money metrics, set money to true and return value as a raw numeric string/);
});
