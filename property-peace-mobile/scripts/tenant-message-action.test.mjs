import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detail = readFileSync(new URL('../src/screens/landlord/TenantDetailScreen.tsx', import.meta.url), 'utf8');

test('tenant contact and access message action requires a linked portal account', () => {
  assert.match(detail, /Contact & access[\s\S]*testID="message-tenant"/);
  assert.match(detail, /const connected = Boolean\(tenant && validId\(read\(tenant, 'userId', 'UserId'\)\)\)/);
  assert.match(detail, /disabled=\{!connected \|\| openingMessage\}/);
  assert.match(detail, /accessibilityState=\{\{ disabled: !connected \|\| openingMessage \}\}/);
});

test('message action rechecks the tenant and opens their direct in-app conversation', () => {
  assert.match(detail, /const current = await TenantAPI\.getTenant\(tenantId\)/);
  assert.match(detail, /const userId = current && validId\(read\(current, 'userId', 'UserId'\)\)/);
  assert.match(detail, /if \(!current \|\| validId\(read\(current, 'id', 'Id'\)\) !== tenantId \|\| !userId\)/);
  assert.match(detail, /ConversationAPI\.createConversation\(\{[\s\S]*tenantId: Number\(tenantId\)[\s\S]*participantUserIds: \[Number\(userId\)\][\s\S]*isGroupChat: false/);
  assert.match(detail, /navigate\('Messages', \{ screen: 'ConversationDetail', params: \{ conversationId: String\(conversation\.id\)/);
});
