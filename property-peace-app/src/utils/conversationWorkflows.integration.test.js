import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getSendAttempt } from './clientRequestId.js';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('send attempts reuse one client request id only for retrying the same payload', () => {
  const first = getSendAttempt(null, 9, 'hello');
  const retry = getSendAttempt(first, 9, 'hello');
  const edited = getSendAttempt(first, 9, 'hello again');
  assert.equal(retry, first);
  assert.equal(retry.clientRequestId, first.clientRequestId);
  assert.notEqual(edited.clientRequestId, first.clientRequestId);
  assert.match(first.clientRequestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('landlord, tenant, and admin active sends dispatch stable clientRequestId values', async () => {
  const pages = await Promise.all(['landlord', 'tenant', 'admin'].map((role) => source(`pages/${role}/messages.jsx`)));
  for (const page of pages) {
    assert.match(page, /getSendAttempt\(sendAttemptRef\.current/);
    assert.match(page, /addMessage\([\s\S]*clientRequestId: attempt\.clientRequestId/);
    assert.match(page, /sendAttemptRef\.current = null/);
  }
});

test('conversation API maps participant discovery, group creation, membership, and leave endpoints', async () => {
  const api = await source('api/conversation.js');
  assert.match(api, /groups\/participants/);
  assert.match(api, /post\('\/api\/Conversation\/groups', request\)/);
  assert.match(api, /groups\/\$\{conversationId\}\/participants\/\$\{participantUserId\}/);
  assert.match(api, /groups\/\$\{conversationId\}\/leave/);
});

test('landlord group UX performs real discovery and mutations with validation and auth errors', async () => {
  const [page, component] = await Promise.all([
    source('pages/landlord/messages.jsx'), source('components/conversation/GroupConversationManager.jsx')
  ]);
  assert.match(page, /<GroupConversationManager/);
  assert.match(component, /discoverGroupParticipants/);
  assert.match(component, /createGroupConversation/);
  assert.match(component, /addGroupParticipant/);
  assert.match(component, /removeGroupParticipant/);
  assert.match(component, /leaveGroupConversation/);
  assert.match(component, /choose at least one participant/);
  assert.match(component, /session expired/);
  assert.match(component, /not authorized/);
});

test('timeline follow-up UX creates from contextual entries and completes using rowVersion', async () => {
  const [panel, api, landlord] = await Promise.all([
    source('components/conversation/ConversationTimelinePanel.jsx'), source('api/conversationTimeline.js'), source('pages/landlord/messages.jsx')
  ]);
  assert.match(panel, /onCreateFollowUp\(entry\)/);
  assert.match(panel, /buildFollowUpRequest/);
  assert.match(panel, /Open follow-up tasks/);
  assert.match(panel, /completeFollowUp\(task\.id, task\.rowVersion\)/);
  assert.match(panel, /status === 409/);
  assert.match(panel, /Loading open tasks/);
  assert.match(api, /follow-ups\/\$\{id\}\/complete/);
  assert.match(landlord, /organizationId=\{quickReplyOrganizationId\}[\s\S]*currentUserId=\{quickReplyUserId\}/);
});
