import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'pages/landlord/messages.jsx'), 'utf8');
const apiRoot = path.resolve(root, '../../property-peace-api');
const dto = fs.readFileSync(path.join(apiRoot, 'Dtos/Tenant/LoadTenantDto.cs'), 'utf8');
const mapper = fs.readFileSync(path.join(apiRoot, 'AutoMapperProfile.cs'), 'utf8');

test('landlord and tenant chat send buttons use the branded icon and a transparent background', () => {
  const styles = fs.readFileSync(path.join(root, 'themes/chatStyles.js'), 'utf8');
  const sendStyle = styles.split('export const chatSendButtonSx = {')[1]?.split('\n};')[0] ?? '';
  assert.match(sendStyle, /bgcolor: 'transparent'/);
  assert.match(sendStyle, /'&:hover': \{ bgcolor: 'transparent'/);
  assert.match(sendStyle, /'&\.Mui-disabled': \{ bgcolor: 'transparent'/);

  for (const [file, expectedCount] of [['landlord/messages', 2], ['tenant/messages', 1], ['tenant/TenantNewChat', 1]]) {
    const source = fs.readFileSync(path.join(root, `pages/${file}.jsx`), 'utf8');
    const buttons = [...source.matchAll(/<IconButton\b(?:(?!<\/IconButton>)[\s\S])*?<\/IconButton>/g)]
      .filter(([button]) => /aria-label="Send (?:first )?message"/.test(button));
    assert.equal(buttons.length, expectedCount, file);
    for (const [button] of buttons) {
      assert.match(button, /sx=\{(?:\{ \.\.\.)?chatSendButtonSx\b/);
      assert.match(button, /<AppIcon name="send"/);
    }
  }
});

test('new Chat opens a recipient dropdown with the specified prompt and scrollable four-row preview', () => {
  assert.match(page, /Enter tenant name, email or lease/);
  assert.match(page, /id="tenant-recipient-options"[\s\S]*?maxHeight: 280[\s\S]*?overflowY: 'auto'[\s\S]*?scrollbarWidth: 'none'/);
  assert.match(page, /profileImageUrl \|\| tenant\.ProfileImageUrl/);
  assert.match(page, /No active lease/);
  assert.match(page, /You’re starting a new conversation/);
  assert.match(page, /Type your first message below\./);
});

test('tenant selection checks unarchived direct conversations and new sends never revive archived threads', () => {
  assert.match(page, /includeArchived=false/);
  assert.match(page, /!conv\.isArchived && !conv\.isGroupChat/);
  assert.match(page, /handleSelectConversation\(existing\)/);
  assert.match(page, /ForceNewConversation: true/);
  assert.match(page, /if \(!tenant \|\| !content \|\| startingConversation\) return/);
  assert.match(page, /setConversationDraft\(conversationId, content\)/);
});

test('recipient lease subtitle is based on a genuinely current lease, not a historical first lease', () => {
  assert.match(dto, /ActiveLeaseId/);
  assert.match(mapper, /dest\.ActiveLeaseId[\s\S]*?!tl\.Lease\.IsDeleted && tl\.Lease\.IsActive/);
  assert.match(mapper, /tl\.Lease\.EndDate == null \|\| tl\.Lease\.EndDate >= DateTime\.UtcNow/);
  assert.match(page, /tenant\.activeLeaseId\s*\? \[propertyName, formatUnitLabel\(tenant\.unitName\)\]/);
});
