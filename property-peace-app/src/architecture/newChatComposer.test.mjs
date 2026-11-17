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
