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

test('Wren sidebar offers a fresh portfolio chat above Properties and keeps property shortcuts scoped', () => {
  assert.match(sidebarSource, /newChatPath = '\/landlord\/ai-center\?new=1'/);
  assert.match(sidebarSource, /<Box\s+component=\{Link\}\s+to=\{newChatPath\}\s+aria-label="Wren AI"/);
  assert.match(
    sidebarSource,
    /<ListItemButton\s+component=\{Link\}\s+to=\{newChatPath\}[^>]*\.\.\.propertyRowButtonSx[^>]*flex: '0 0 auto'[^>]*>[\s\S]*?<ListItemText primary="New chat"[\s\S]*?>\s*Properties\s*<\/Typography>/
  );
  assert.match(sidebarSource, /visibleGeneralConversationLimit = 4/);
  assert.match(sidebarSource, /getGeneralConversations\(conversations\)/);
  assert.match(sidebarSource, /generalConversations\.length > visibleGeneralConversationLimit/);
  assert.match(sidebarSource, /color: propertySubtitleColor,[\s\S]*?Show more/);
  assert.match(sidebarSource, /<AppIcon name="properties" size=\{19\} \/>\s*<ListItemText\s+primary=\{property\.name\}/);
  assert.match(sidebarSource, /\/landlord\/ai-center\?propertyId=\$\{encodeURIComponent\(property\.id\)\}&new=1/);
});

test('Wren hard-delete API remains available without duplicating destructive controls in the page', () => {
  assert.match(apiSource, /async deleteConversation\(id\)[\s\S]*?client\.delete\(`\/api\/ai-copilot\/conversations\/\$\{id\}`\)/);
  assert.doesNotMatch(pageSource, /aiFollowUpAPI\.deleteConversation/);
});
