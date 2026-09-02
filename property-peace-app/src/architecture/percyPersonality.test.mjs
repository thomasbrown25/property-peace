import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(srcRoot, '..', '..');

const readRepoFile = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

test('Percy model prompt defines a warm smart voice with restrained context-safe humor', async () => {
  const source = await readRepoFile('property-peace-api/Services/AICopilotService/AICopilotService.Chat.cs');

  assert.match(source, /warm and capable property-management assistant/i);
  assert.match(source, /trusted colleague/i);
  assert.match(source, /light, situational humor/i);
  assert.match(source, /never force a joke/i);
  assert.match(source, /emergenc(?:y|ies).*eviction.*financial hardship.*legal matters.*conflict.*safety.*sensitive tenant situations/is);
  assert.match(source, /never pretend to be human/i);
  assert.match(source, /acknowledge.*answer.*evidence.*next useful step/is);
});

test('Percy progress copy sounds conversational instead of exposing response mechanics', async () => {
  const aiCenter = await readRepoFile('property-peace-app/src/pages/landlord/ai-center.jsx');
  const controller = await readRepoFile('property-peace-api/Controllers/AICopilotController.cs');

  assert.doesNotMatch(aiCenter, /Waiting for Percy's full response/i);
  assert.doesNotMatch(controller, /Understanding your request|Checking Property Peace data|checking your Property Peace data/i);
  assert.match(aiCenter, /Let me take a look/);
  assert.match(controller, /Let me take a look/);
  assert.match(aiCenter, /I'm pulling that together for you/i);
});
