import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('timeline API maps read, search, unread, watermark, quick reply and follow-up endpoints', async () => {
  const api = await source('api/conversationTimeline.js');
  for (const endpoint of [
    '/timeline`', 'timeline/search', '/unread`', '/read`', 'quick-replies', 'follow-ups'
  ]) assert.match(api, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(api, /normalizeTimelinePage/);
  assert.match(api, /buildTimelineSearchParams/);
});

test('landlord and tenant message workspaces expose the contextual communication timeline', async () => {
  const [landlord, tenant, panel, quickReplies] = await Promise.all([
    source('pages/landlord/messages.jsx'),
    source('pages/tenant/messages.jsx'),
    source('components/conversation/ConversationTimelinePanel.jsx'),
    source('components/conversation/ConversationQuickReplies.jsx')
  ]);
  assert.match(landlord, /<ConversationTimelinePanel[\s\S]*conversationId=\{selectedConversation\.id\}/);
  assert.match(tenant, /<ConversationTimelinePanel[\s\S]*conversationId=\{selectedConversation\.id\}/);
  assert.match(panel, /Communication activity/);
  assert.match(panel, /Search activity/);
  assert.match(panel, /Load more activity/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /markTimelineRead/);
  assert.match(landlord, /<ConversationQuickReplies/);
  assert.match(tenant, /<ConversationQuickReplies/);
  assert.doesNotMatch(landlord, /const QUICK_REPLIES/);
  assert.doesNotMatch(tenant, /const QUICK_REPLIES/);
  assert.match(quickReplies, /listQuickReplies/);
  assert.match(quickReplies, /organizationId/);
  assert.match(quickReplies, /contextKind/);
  assert.match(quickReplies, /userId/);
  assert.match(quickReplies, /Loading quick replies/);
  assert.match(quickReplies, /Quick replies unavailable/);
  assert.match(quickReplies, /Try again/);
});

test('landlord application details scope communication activity to the selected application', async () => {
  const [applications, panel] = await Promise.all([
    source('pages/landlord/applications.jsx'),
    source('components/conversation/ConversationTimelinePanel.jsx')
  ]);
  assert.match(applications, /<ConversationTimelinePanel[\s\S]*contextKind="rentalApplication"[\s\S]*contextId=\{selectedApplication/);
  assert.match(panel, /contextKind/);
  assert.match(panel, /contextId/);
});

test('timeline connector remains a one-pixel line instead of expanding across the entries', async () => {
  const panel = await source('components/conversation/ConversationTimelinePanel.jsx');
  assert.match(panel, /className="timeline-connector"[\s\S]*width: '1px'/);
  assert.doesNotMatch(panel, /className="timeline-connector"[\s\S]*width: 1,/);
});

test('landlord maintenance details consolidate activity into expanded maintenance history', async () => {
  const maintenance = await source('pages/landlord/maintenance.jsx');
  assert.match(maintenance, /<ConversationTimelinePanel[\s\S]*contextKind="maintenance"[\s\S]*title="Maintenance history"[\s\S]*defaultExpanded/);
  assert.doesNotMatch(maintenance, /Explicit maintenance actions/);
  assert.doesNotMatch(maintenance, /WORKFLOW HISTORY/);
});
