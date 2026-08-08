import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimelineSearchParams,
  buildFollowUpRequest,
  getDeliveryPresentation,
  getTimelineEntryPresentation,
  mergeTimelinePages,
  normalizeQuickReplies,
  normalizeFollowUps,
  resolveQuickReplyScope,
  normalizeTimelinePage,
  selectReadThroughSequence
} from './conversationTimeline.js';

const message = {
  id: 8,
  conversationId: 3,
  sequence: 12,
  kind: 'outboundSms',
  occurredAtUtc: '2026-08-08T12:00:00Z',
  actorUserId: 4,
  summary: 'Repair person will arrive at 2.',
  metadataVersion: 1,
  metadata: { channel: 'sms', direction: 'outbound', status: 'sent', privateToken: 'never render' },
  context: { kind: 'maintenance', id: 19, label: 'Leaking sink' },
  visibility: 'participants',
  deliveries: [{ channel: 'sms', status: 'delivered', maskedDestination: '***1234', deliveredAtUtc: '2026-08-08T12:01:00Z' }]
};

test('normalizes only complete timeline contracts and fails closed for malformed data', () => {
  assert.deepEqual(normalizeTimelinePage({ items: [message], nextCursor: 12 }), { items: [message], nextCursor: 12 });
  assert.equal(normalizeTimelinePage({ items: [{ ...message, sequence: '12' }], nextCursor: null }), null);
  assert.equal(normalizeTimelinePage({ items: [{ ...message, summary: '<script>' }], nextCursor: null }), null);
  assert.equal(normalizeTimelinePage({ items: [message], nextCursor: '12' }), null);
  assert.equal(normalizeTimelinePage({ data: [message] }), null);
});

test('projects allowlisted context, channel and delivery evidence without leaking metadata', () => {
  assert.deepEqual(getTimelineEntryPresentation(message), {
    id: 8,
    sequence: 12,
    occurredAt: '2026-08-08T12:00:00Z',
    summary: 'Repair person will arrive at 2.',
    kind: 'outboundSms',
    kindLabel: 'SMS',
    channelLabel: 'SMS',
    direction: 'outbound',
    context: { kind: 'maintenance', id: 19, label: 'Leaking sink' },
    visibilityLabel: 'Shared with participants',
    deliveries: [{ label: 'Delivered', tone: 'success', detail: 'SMS · ***1234' }]
  });
  assert.equal(JSON.stringify(getTimelineEntryPresentation(message)).includes('privateToken'), false);
  assert.deepEqual(getDeliveryPresentation({ channel: 'inApp', status: 'pending', maskedDestination: null }), {
    label: 'Queued', tone: 'info', detail: 'In-app'
  });
  assert.deepEqual(getDeliveryPresentation({ channel: 'carrier-pigeon', status: 'provider-secret', maskedDestination: 'raw@example.com' }), {
    label: 'Delivery update unavailable', tone: 'default', detail: null
  });
});

test('merges cursor pages in immutable sequence order and de-duplicates replayed entries', () => {
  const older = { ...message, id: 7, sequence: 11 };
  const newer = { ...message, id: 9, sequence: 13 };
  assert.deepEqual(mergeTimelinePages([message, newer], [older, message]).map((item) => item.sequence), [11, 12, 13]);
  assert.deepEqual(mergeTimelinePages([message], [{ ...message, id: 99 }]).map((item) => item.id), [8]);
  assert.deepEqual(mergeTimelinePages(null, [message]), [message]);
});

test('builds bounded allowlisted search parameters and rejects ambiguous context', () => {
  assert.equal(buildTimelineSearchParams({ query: '  sink  ', conversationId: 3, contextKind: 'maintenance', contextId: 19, kinds: ['outboundSms', 'email'], channel: 'sms', status: 'delivered', take: 25 }),
    'query=sink&conversationId=3&contextKind=maintenance&contextId=19&kinds=outboundSms&kinds=email&channel=sms&status=delivered&skip=0&take=25');
  assert.equal(buildTimelineSearchParams({ contextKind: 'maintenance', take: 500 }), null);
  assert.equal(buildTimelineSearchParams({ query: 'x'.repeat(201) }), null);
  assert.equal(buildTimelineSearchParams({ kinds: ['message', 'secretKind'] }), null);
});

test('marks through the highest visible sequence only', () => {
  assert.equal(selectReadThroughSequence([message, { ...message, sequence: 18 }]), 18);
  assert.equal(selectReadThroughSequence([]), null);
  assert.equal(selectReadThroughSequence([{ ...message, sequence: -1 }]), null);
});

test('resolves quick reply scope from the authenticated organization and conversation context', () => {
  assert.deepEqual(resolveQuickReplyScope({
    userId: '7',
    organizationId: '12',
    conversation: { contextKind: 'Maintenance', propertyId: 44 }
  }), { userId: 7, organizationId: 12, contextKind: 'maintenance' });
  assert.deepEqual(resolveQuickReplyScope({
    userId: 7,
    organizationId: 12,
    conversation: { propertyId: 44 }
  }), { userId: 7, organizationId: 12, contextKind: 'property' });
  assert.equal(resolveQuickReplyScope({ userId: 7, organizationId: null, conversation: {} }), null);
  assert.equal(resolveQuickReplyScope({ userId: 7, organizationId: 12, conversation: { contextKind: 'private' } }), null);
});

test('quick replies fail closed to active, bounded records from the requested organization and context', () => {
  const payload = [
    { id: 1, organizationId: 12, title: ' Update ', body: ' I will follow up. ', sortOrder: 2, isActive: true, contextKind: null },
    { id: 2, organizationId: 12, title: 'Repair', body: 'Please send a photo.', sortOrder: 1, isActive: true, contextKind: 'maintenance' },
    { id: 3, organizationId: 99, title: 'Other org', body: 'Never show', sortOrder: 0, isActive: true, contextKind: null },
    { id: 4, organizationId: 12, title: 'Inactive', body: 'Never show', sortOrder: 0, isActive: false, contextKind: null },
    { id: 5, organizationId: 12, title: 'Lease', body: 'Wrong context', sortOrder: 0, isActive: true, contextKind: 'lease' }
  ];
  assert.deepEqual(normalizeQuickReplies(payload, { organizationId: 12, contextKind: 'maintenance' }), [
    { id: 2, title: 'Repair', body: 'Please send a photo.' },
    { id: 1, title: 'Update', body: 'I will follow up.' }
  ]);
  assert.deepEqual(normalizeQuickReplies(null, { organizationId: 12, contextKind: 'maintenance' }), []);
});

test('builds contextual follow-up requests and rejects entries without context', () => {
  const request = buildFollowUpRequest({ organizationId: 12, conversationId: 3, entry: message,
    assigneeUserId: 7, title: ' Check repair ', dueAtUtc: '2026-08-10T12:00', idempotencyKey: '11111111-1111-4111-8111-111111111111' });
  assert.equal(request.title, 'Check repair');
  assert.equal(request.timelineEntryId, 8);
  assert.equal(request.contextKind, 'maintenance');
  assert.match(request.dueAtUtc, /Z$/);
  assert.equal(buildFollowUpRequest({ organizationId: 12, conversationId: 3, entry: { ...message, context: null },
    assigneeUserId: 7, title: 'Check', dueAtUtc: '2026-08-10T12:00', idempotencyKey: '11111111-1111-4111-8111-111111111111' }), null);
});

test('normalizes only open follow-ups in the active organization and conversation', () => {
  const task = { id: 1, organizationId: 12, conversationId: 3, timelineEntryId: 8, assigneeUserId: 7,
    title: 'Repair', dueAtUtc: '2026-08-10T12:00:00Z', status: 'open', rowVersion: 'AQID' };
  assert.deepEqual(normalizeFollowUps([{ ...task, id: 2, dueAtUtc: '2026-08-11T12:00:00Z' }, task,
    { ...task, id: 3, status: 'completed' }, { ...task, id: 4, organizationId: 99 }],
  { organizationId: 12, conversationId: 3 }).map((item) => item.id), [1, 2]);
});
