import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'pages/landlord/messages.jsx'), 'utf8');
const controller = fs.readFileSync(path.resolve(root, '../../property-peace-api/Controllers/MessageController.cs'), 'utf8');
const row = page.split('const renderConversationItem =')[1]?.split('const snapshotActionButtonSx')[0] ?? '';

test('chat rows are compact with small avatars and keyboard-accessible hover actions', () => {
  assert.match(row, /width: 30, height: 30/);
  assert.match(row, /aria-label=\{`Actions for \$\{tenantName\}`\}/);
  assert.match(row, /focus-within/);
  assert.match(row, /stopPropagation\(\)/);
});

test('both chat lists give the avatar unread badge enough vertical clearance', () => {
  const styles = fs.readFileSync(path.join(root, 'themes/chatStyles.js'), 'utf8');
  assert.match(styles, /chatConversationRowButtonSx = \{\s*py: 1\.25,/);
  for (const role of ['landlord', 'tenant']) {
    const chat = fs.readFileSync(path.join(root, `pages/${role}/messages.jsx`), 'utf8');
    assert.match(chat, /<ListItemButton\b[\s\S]*?sx=\{chatConversationRowButtonSx\}\s*>\s*<ListItemAvatar\b[^>]*>\s*<Badge badgeContent=\{hasUnread/);
  }
});

test('row menu targets its own conversation and offers mark unread and archive without a white outline', () => {
  assert.match(page, /rowActionConversation/);
  assert.match(page, /Mark as unread/);
  assert.match(page, /handleRowMarkUnread/);
  assert.match(page, /handleRowArchive/);
  assert.match(page, /archiveConversation\(conversationId, true\)/);
  assert.match(page, /conversation\/\$\{conversationId\}\/unread/);
  assert.match(page, /outline: 'none'/);
});

test('mark unread endpoint is scoped to the current participant and marks only that reader unread', () => {
  assert.match(controller, /HttpPost\("conversation\/\{conversationId\}\/unread"\)/);
  assert.match(controller, /IsConversationInActiveOrganizationAsync\(conversationId/);
  assert.match(controller, /message\.SenderId != userId/);
  assert.match(controller, /receipt\.UserId == userId/);
  assert.match(controller, /watermark\.UserId == userId/);
});
