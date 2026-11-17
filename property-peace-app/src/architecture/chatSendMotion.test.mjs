import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'pages/landlord/messages.jsx'), 'utf8');

test('only newly sent optimistic bubbles rise into the chat pane', () => {
  assert.match(page, /animation: message\._optimistic\s*\|\|\s*\(newConversationSentMessageId != null && String\(message\.id\) === String\(newConversationSentMessageId\)\)/);
  assert.match(page, /@keyframes outgoingMessageRise/);
  assert.match(page, /translateY\(28px\)/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/);
});

test('first message in a new conversation rises once after its thread loads', () => {
  assert.match(page, /setNewConversationSentMessageId\(sent\.data\.id\)/);
  assert.match(page, /String\(message\.id\) === String\(newConversationSentMessageId\)/);
  assert.match(page, /onAnimationEnd=\{\(\) => \{/);
  assert.match(page, /setNewConversationSentMessageId\(null\)/);
});
