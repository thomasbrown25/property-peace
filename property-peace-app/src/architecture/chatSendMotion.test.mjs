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

const tenantChat = fs.readFileSync(path.join(root, 'pages/tenant/messages.jsx'), 'utf8');

test('tenant chat matches the compact landlord inbox and offers participant-scoped unread actions', () => {
  assert.match(tenantChat, /variant="h3"[^>]*>\s*Chat/);
  assert.match(tenantChat, /getChatStyles\(theme\)/);
  assert.match(tenantChat, /aria-pressed=\{unreadOnly\}/);
  assert.match(tenantChat, /aria-expanded=\{showMessageSearch\}/);
  assert.match(tenantChat, /width: 30, height: 30/);
  assert.match(tenantChat, /Mark as unread/);
  assert.match(tenantChat, /\/api\/Message\/conversation\/\$\{conversationId\}\/unread/);
  assert.doesNotMatch(tenantChat, /archiveConversation|\/archive`/);
});

test('tenant chat composes inline and sends the first message only to a selected landlord', () => {
  assert.match(tenantChat, /<TenantNewChat\b/);
  assert.match(tenantChat, /if \(!draftLandlord \|\| !content \|\| startingConversation\) return/);
  assert.match(tenantChat, /\/api\/Conversation\/tenant\/available-landlords/);
  assert.match(tenantChat, /\/api\/Conversation\/tenant\/start/);
  assert.match(tenantChat, /setNewConversationSentMessageId\(sent\.data\.id\)/);
  assert.match(tenantChat, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(tenantChat, /<Dialog\b/);
});
