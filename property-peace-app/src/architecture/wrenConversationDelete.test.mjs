import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../pages/landlord/ai-center.jsx', import.meta.url), 'utf8');
const sidebarSource = fs.readFileSync(new URL('../layout/Dashboard/LandlordSidebar.jsx', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../../../shared/api/aiFollowUp.js', import.meta.url), 'utf8');

test('Wren page omits duplicate breadcrumbs and conversation navigation', () => {
  assert.doesNotMatch(pageSource, /PageBreadcrumbs/);
  assert.doesNotMatch(pageSource, />\s*Conversations\s*</);
  assert.doesNotMatch(pageSource, /conversation-delete/);
  assert.match(sidebarSource, /displayedConversations\.map/);
  assert.match(sidebarSource, /\/landlord\/ai-center\?conversationId=/);
});

test('Wren hard-delete API remains available without duplicating destructive controls in the page', () => {
  assert.match(apiSource, /async deleteConversation\(id\)[\s\S]*?client\.delete\(`\/api\/ai-copilot\/conversations\/\$\{id\}`\)/);
  assert.doesNotMatch(pageSource, /aiFollowUpAPI\.deleteConversation/);
});
