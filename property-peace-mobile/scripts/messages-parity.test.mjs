import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  filterConversations,
  formatConversationTime,
  getConversationPresentation,
  getActiveGroupMembers,
  getGroupMemberSummary,
  getDeliveryPresentation,
  getTimelineEntryPresentation,
  mergeTimelinePages,
  normalizeTimelinePage,
  selectReadThroughSequence,
  validateGroupDraft,
} from '../src/features/messages/messagesModel.ts';

const entry = {
  id: 8,
  conversationId: 3,
  sequence: 12,
  kind: 'OutboundSms',
  occurredAtUtc: '2026-08-08T12:00:00Z',
  actorUserId: 4,
  summary: 'Repair person will arrive at 2.',
  metadataVersion: 1,
  metadata: { channel: 'sms', direction: 'outbound', status: 'sent', privateToken: 'never render' },
  context: { kind: 'maintenance', id: 19, label: 'Leaking sink' },
  visibility: 'Participants',
  deliveries: [{ channel: 'sms', status: 'delivered', maskedDestination: '***1234', deliveredAtUtc: '2026-08-08T12:01:00Z' }],
};

test('normalizes the M7 cursor contract and fails closed for malformed timeline data', () => {
  assert.deepEqual(normalizeTimelinePage({ items: [entry], nextCursor: 12 }), { items: [entry], nextCursor: 12 });
  assert.equal(normalizeTimelinePage({ items: [{ ...entry, sequence: '12' }], nextCursor: null }), null);
  assert.equal(normalizeTimelinePage({ items: [{ ...entry, summary: '<script>alert(1)</script>' }], nextCursor: null }), null);
  assert.equal(normalizeTimelinePage({ data: [entry] }), null);
});

test('presents allowlisted timeline and delivery evidence without leaking metadata', () => {
  assert.deepEqual(getTimelineEntryPresentation(entry), {
    id: 8,
    sequence: 12,
    occurredAt: '2026-08-08T12:00:00Z',
    summary: 'Repair person will arrive at 2.',
    kind: 'outboundSms',
    kindLabel: 'SMS',
    channelLabel: 'SMS',
    direction: 'outbound',
    context: { kind: 'maintenance', id: 19, label: 'Leaking sink' },
    isStaffOnly: false,
    visibilityLabel: 'Shared with participants',
    deliveries: [{ label: 'Delivered', tone: 'success', detail: 'SMS · ***1234' }],
  });
  assert.equal(JSON.stringify(getTimelineEntryPresentation(entry)).includes('privateToken'), false);
  assert.deepEqual(getDeliveryPresentation({ channel: 'carrier-pigeon', status: 'provider-secret', maskedDestination: 'raw@example.com' }), {
    label: 'Delivery update unavailable', tone: 'default', detail: null,
  });
});

test('merges realtime and cursor pages in immutable sequence order and selects visible read-through', () => {
  const older = { ...entry, id: 7, sequence: 11 };
  const newer = { ...entry, id: 9, sequence: 13 };
  assert.deepEqual(mergeTimelinePages([entry, newer], [older, entry]).map((item) => item.sequence), [11, 12, 13]);
  assert.equal(selectReadThroughSequence([older, entry, newer]), 13);
  assert.equal(selectReadThroughSequence([]), null);
});

test('filters inbox, unread and archived conversations and searches useful visible fields', () => {
  const conversations = [
    { id: 1, title: 'Maple House', tenantName: 'Ada Lovelace', lastMessagePreview: 'Sink update', lastMessageAt: '2026-08-08T12:00:00Z', unreadCount: 2, isPinned: false },
    { id: 2, title: 'Oak Flats', propertyName: 'Oak', lastMessagePreview: 'Thanks', lastMessageAt: '2026-08-07T12:00:00Z', unreadCount: 0, isPinned: true },
    { id: 3, title: 'Elm', lastMessagePreview: 'Archived note', lastMessageAt: '2026-08-06T12:00:00Z', unreadCount: 1, isArchived: true },
    { id: 4, title: 'Empty draft', unreadCount: 4 },
  ];
  assert.deepEqual(filterConversations(conversations, 'inbox', '').map((item) => item.id), [2, 1]);
  assert.deepEqual(filterConversations(conversations, 'unread', '').map((item) => item.id), [1]);
  assert.deepEqual(filterConversations(conversations, 'archived', '').map((item) => item.id), [3]);
  assert.deepEqual(filterConversations(conversations, 'inbox', 'ada').map((item) => item.id), [1]);
});

test('builds human conversation cards from API fields without placeholder IDs', () => {
  assert.deepEqual(getConversationPresentation({ id: 4, tenantName: 'Grace Hopper', propertyName: 'Navy Yard', unitName: '2B', lastMessagePreview: 'On my way', unreadCount: 3 }), {
    title: 'Grace Hopper',
    subtitle: 'Navy Yard · Unit 2B',
    preview: 'On my way',
    initials: 'GH',
    unreadCount: 3,
    isPinned: false,
  });
  assert.equal(formatConversationTime('bad-date', new Date('2026-08-08T13:00:00Z')), '');
  assert.equal(formatConversationTime('2026-08-08T12:55:00Z', new Date('2026-08-08T13:00:00Z')), '5m');
});

test('validates group drafts and deduplicates eligible participant IDs', () => {
  assert.equal(validateGroupDraft({ title: '  ', participantUserIds: [4] }).error, 'Enter a group title.');
  assert.equal(validateGroupDraft({ title: 'Lease team', participantUserIds: [] }).error, 'Select at least one participant.');
  assert.equal(validateGroupDraft({ title: 'x'.repeat(101), participantUserIds: [4] }).error, 'Group titles can be up to 100 characters.');
  assert.deepEqual(validateGroupDraft({ title: '  Lease team  ', participantUserIds: [4, 4, -1, 7] }), {
    title: 'Lease team', participantUserIds: [4, 7], error: null,
  });
});

test('presents group title and active member names in inbox and detail', () => {
  const group = {
    id: 12, title: 'Maple team', tenantName: 'Do not override the group title', isGroupChat: true,
    participants: [
      { userId: 2, userName: 'Ada Lovelace', isAdmin: true, isActive: true },
      { userId: 3, userName: 'Grace Hopper', isActive: true },
      { userId: 4, userName: 'Former Member', isActive: false },
    ],
  };
  assert.deepEqual(getActiveGroupMembers(group).map((member) => member.userId), [2, 3]);
  assert.equal(getGroupMemberSummary(group), '2 members · Ada Lovelace, Grace Hopper');
  assert.deepEqual(getConversationPresentation(group), {
    title: 'Maple team', subtitle: '2 members · Ada Lovelace, Grace Hopper', preview: 'No messages yet',
    initials: 'MT', unreadCount: 0, isPinned: false,
  });
});

test('mobile group workflow is wired to the real API routes and product controls', () => {
  const root = resolve(import.meta.dirname, '..');
  const api = readFileSync(resolve(root, 'src/api/conversationAPI.ts'), 'utf8');
  const list = readFileSync(resolve(root, 'src/screens/landlord/MessagesScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(root, 'src/screens/landlord/ConversationDetailScreen.tsx'), 'utf8');
  const dialog = readFileSync(resolve(root, 'src/components/messages/GroupConversationDialog.tsx'), 'utf8');
  for (const route of [
    '/api/Conversation/groups/participants', '/api/Conversation/groups',
    '/participants/${participantUserId}', '/leave',
  ]) assert.ok(api.includes(route), `missing mobile group route ${route}`);
  assert.match(list, /testID="new-group"/);
  assert.match(detail, /testID="manage-group"/);
  assert.match(dialog, /testID="group-title"/);
  assert.match(dialog, /testID=\{creating \? 'create-group'/);
  assert.match(dialog, /Leave group/);
  assert.match(dialog, /status === 401/);
  assert.match(dialog, /status === 403/);
});
