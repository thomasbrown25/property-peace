import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../pages/landlord/ai-center.jsx', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../../../shared/api/aiFollowUp.js', import.meta.url), 'utf8');

test('Percy conversation rows reveal a right-aligned delete control on hover and keyboard focus', () => {
  assert.match(pageSource, /&:hover \.conversation-delete, &:focus-within \.conversation-delete/);
  assert.match(pageSource, /className="conversation-delete"[\s\S]*?position: 'absolute'[\s\S]*?right: 6[\s\S]*?top: '50%'/);
  assert.match(pageSource, /aria-label=\{`Delete \$\{readField\(conversation, 'title', 'Title'\)/);
});

test('Percy delete control calls the hard-delete API and removes the deleted row from local state', () => {
  assert.match(apiSource, /async deleteConversation\(id\)[\s\S]*?client\.delete\(`\/api\/ai-copilot\/conversations\/\$\{id\}`\)/);
  assert.match(pageSource, /await aiFollowUpAPI\.deleteConversation\(id\)/);
  assert.match(pageSource, /setConversations\(remainingConversations\)/);
});
