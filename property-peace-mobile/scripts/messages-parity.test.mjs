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
  getMessageCapabilities,
  getMessagesAudience,
  getConversationInboxPath,
  canAccessMessages,
  buildMessagingScopeKey,
  advanceMessagingScopeGeneration,
  filterTimelineForAudience,
  isMessagingOperationCurrent,
  loadConversationCore,
  mergeTimelinePages,
  normalizeTimelinePage,
  selectReadThroughSequence,
  validateGroupDraft,
} from '../src/features/messages/messagesModel.ts';
import { ConversationSubscriptionRegistry } from '../src/services/conversationSubscriptionRegistry.ts';

test('selects the participant-safe inbox endpoint from the active organization role', () => {
  assert.equal(getMessagesAudience({ currentOrganizationRole: 'Tenant', roles: ['Landlord'] }), 'tenant');
  assert.equal(getConversationInboxPath('tenant', true), '/api/Conversation/tenant/my-conversations?includeArchived=true');
  assert.equal(getConversationInboxPath('landlord', true), '/api/Conversation?includeArchived=true');
  assert.equal(getConversationInboxPath('admin', true), '/api/Conversation/admin/conversations?includeArchived=true');
  assert.equal(getMessagesAudience({ CurrentOrganizationRole: 'Admin' }), 'admin');
  assert.equal(getMessagesAudience({ currentOrganizationRole: 'Landlord' }), 'landlord');
  assert.equal(getMessagesAudience({ currentOrganizationRole: 'Owner' }), 'landlord');
  assert.equal(getMessagesAudience({ currentOrganizationRole: 'Manager' }), 'landlord');
  assert.equal(getMessagesAudience({ currentOrganizationRole: 'Vendor', roles: ['Landlord'] }), 'unsupported');
  assert.equal(canAccessMessages('unsupported'), false);
  assert.equal(canAccessMessages('tenant'), true);
  assert.equal(canAccessMessages('landlord'), true);
  assert.equal(canAccessMessages('admin'), true);
  assert.throws(() => getConversationInboxPath('unsupported', false), /unsupported/i);
});

test('messaging data scopes are bound to active user, organization, audience, and thread', () => {
  const tenant = { id: 7, currentOrganizationId: 12 };
  assert.equal(buildMessagingScopeKey(tenant, 'tenant'), '7:12:tenant');
  assert.equal(buildMessagingScopeKey(tenant, 'tenant', '44'), '7:12:tenant:44');
  assert.notEqual(buildMessagingScopeKey(tenant, 'tenant'), buildMessagingScopeKey({ ...tenant, currentOrganizationId: 13 }, 'tenant'));
  assert.notEqual(buildMessagingScopeKey(tenant, 'tenant'), buildMessagingScopeKey(tenant, 'landlord'));
});

test('monotonic messaging generations reject stale completions across A to B to A transitions', () => {
  const a1 = advanceMessagingScopeGeneration(undefined, 'user:org-a:tenant');
  const b = advanceMessagingScopeGeneration(a1, 'user:org-b:tenant');
  const a2 = advanceMessagingScopeGeneration(b, 'user:org-a:tenant');
  assert.equal(a1.scope, a2.scope);
  assert.ok(a2.generation > a1.generation);
  assert.equal(isMessagingOperationCurrent(a1, a2), false);
  assert.equal(isMessagingOperationCurrent(a2, a2), true);
});

test('tenant thread uses its selected inbox summary and never calls the landlord-only summary route', async () => {
  const selected = { id: 7, title: 'Home team' };
  let summaryCalls = 0;
  const result = await loadConversationCore({
    audience: 'tenant', selectedConversation: selected,
    loadConversation: async () => { summaryCalls += 1; throw new Error('landlord-only route called'); },
    loadTimeline: async () => ({ items: [entry], nextCursor: null }),
  });
  assert.equal(summaryCalls, 0);
  assert.equal(result.conversation, selected);
  assert.deepEqual(result.timeline, { items: [entry], nextCursor: null });
});

test('unsupported audiences cannot load conversation details', async () => {
  let summaryCalls = 0;
  let timelineCalls = 0;
  await assert.rejects(() => loadConversationCore({
    audience: 'unsupported',
    selectedConversation: { id: 7 },
    loadConversation: async () => { summaryCalls += 1; return { id: 7 }; },
    loadTimeline: async () => { timelineCalls += 1; return { items: [], nextCursor: null }; },
  }), /unsupported/i);
  assert.equal(summaryCalls, 0);
  assert.equal(timelineCalls, 0);
});

test('staff thread preserves its detail lookup and core timeline errors reject independently', async () => {
  let summaryCalls = 0;
  const staff = await loadConversationCore({
    audience: 'landlord', selectedConversation: { id: 7, title: 'stale' },
    loadConversation: async () => { summaryCalls += 1; return { id: 7, title: 'Fresh summary' }; },
    loadTimeline: async () => ({ items: [entry], nextCursor: null }),
  });
  assert.equal(summaryCalls, 1);
  assert.equal(staff.conversation.title, 'Fresh summary');
  await assert.rejects(() => loadConversationCore({
    audience: 'tenant', selectedConversation: { id: 7 },
    loadConversation: async () => { throw new Error('must not run'); },
    loadTimeline: async () => { throw new Error('timeline unavailable'); },
  }), /timeline unavailable/);
});

test('tenant capabilities hide every staff control while landlord and admin retain them', () => {
  assert.deepEqual(getMessageCapabilities('tenant'), {
    createGroup: false, manageGroup: false, quickReplies: false, followUps: false, archive: false, pin: false,
  });
  for (const audience of ['landlord', 'admin']) {
    assert.deepEqual(getMessageCapabilities(audience), {
      createGroup: true, manageGroup: true, quickReplies: true, followUps: true, archive: true, pin: true,
    });
  }
});

test('role-aware behavior is wired into the inbox and detail screens without weakening participant APIs', () => {
  const root = resolve(import.meta.dirname, '..');
  const api = readFileSync(resolve(root, 'src/api/conversationAPI.ts'), 'utf8');
  const list = readFileSync(resolve(root, 'src/screens/landlord/MessagesScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(root, 'src/screens/landlord/ConversationDetailScreen.tsx'), 'utf8');
  const navigator = readFileSync(resolve(root, 'src/navigation/MainNavigator.tsx'), 'utf8');
  assert.match(api, /getConversationInboxPath\(audience, includeArchived\)/);
  assert.match(list, /getConversations\(audience, capabilities\.archive\)/);
  assert.match(list, /selectedConversation: item/);
  for (const capability of ['createGroup', 'pin']) assert.match(list, new RegExp(`capabilities\\.${capability}`));
  for (const capability of ['manageGroup', 'quickReplies', 'followUps', 'archive']) assert.match(detail, new RegExp(`capabilities\\.${capability}`));
  assert.match(detail, /loadConversationCore/);
  assert.match(detail, /canAccessMessages\(audience\)/);
  assert.match(detail, /Messages aren’t available for this role/);
  assert.match(list, /canAccessMessages\(audience\)/);
  assert.match(list, /Messages aren’t available for this role/);
  assert.match(list, /requestSequence/);
  assert.match(list, /loadedScope === dataScope/);
  assert.match(list, /unsubscribeFromConversation/);
  assert.match(list, /audience === 'tenant'.*setFilter\('inbox'\)/s);
  assert.match(list, /isMessagingOperationCurrent/);
  assert.match(detail, /requestSequence/);
  assert.match(detail, /loadedScope !== dataScope/);
  assert.match(detail, /coreLoadInFlight/);
  assert.match(detail, /isMessagingOperationCurrent/);
  const unsupportedStart = navigator.lastIndexOf("      </> : <>");
  const unsupportedEnd = navigator.indexOf("      </>}", unsupportedStart);
  assert.ok(unsupportedStart >= 0 && unsupportedEnd > unsupportedStart);
  const unsupportedTabs = navigator.slice(unsupportedStart, unsupportedEnd);
  assert.doesNotMatch(unsupportedTabs, /name="Messages"/);
  assert.match(detail, /clientRequestId: Crypto\.randomUUID\(\)/);
  assert.match(detail, /retrySend\.current\?\.content === content/);
  assert.match(detail, /markTimelineRead\(conversationId, through\)/);
  assert.match(detail, /subscribeToConversation/);
});

test('SignalR messaging connections are scoped to the selected active organization', () => {
  const root = resolve(import.meta.dirname, '..');
  const service = readFileSync(resolve(root, 'src/services/signalRService.ts'), 'utf8');
  const list = readFileSync(resolve(root, 'src/screens/landlord/MessagesScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(root, 'src/screens/landlord/ConversationDetailScreen.tsx'), 'utf8');

  assert.match(service, /async connect\(organizationId:/);
  assert.match(service, /headers:\s*\{\s*'X-Organization-Id': normalizedOrganizationId\s*\}/s);
  assert.match(service, /connectionOrganizationId !== normalizedOrganizationId/);
  assert.match(service, /await this\.disconnect\(\)/);
  assert.match(list, /signalRService\.connect\(organizationId\)/);
  assert.match(detail, /signalRService\.connect\(organizationId\)/);
});

test('conversation subscriptions are reference counted and isolated by active organization', async () => {
  const subscriptions = new ConversationSubscriptionRegistry();

  assert.equal(subscriptions.subscribe('12', 44), true);
  assert.equal(subscriptions.subscribe(12, '44'), false);
  assert.equal(subscriptions.subscribe(13, 44), true);
  assert.deepEqual(subscriptions.activeConversationIds('12'), [44]);
  assert.deepEqual(subscriptions.activeConversationIds(13), [44]);

  assert.equal(subscriptions.unsubscribe(12, 44), false);
  assert.deepEqual(subscriptions.activeConversationIds(12), [44]);
  assert.equal(subscriptions.unsubscribe('12', '44'), true);
  assert.deepEqual(subscriptions.activeConversationIds(12), []);
  assert.deepEqual(subscriptions.activeConversationIds(13), [44]);

  const restored = [];
  await subscriptions.restore(13, async (conversationId) => { restored.push(conversationId); });
  assert.deepEqual(restored, [44]);
});

test('SignalR reconnect restores active organization groups through the subscription service', () => {
  const root = resolve(import.meta.dirname, '..');
  const service = readFileSync(resolve(root, 'src/services/signalRService.ts'), 'utf8');
  const list = readFileSync(resolve(root, 'src/screens/landlord/MessagesScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(root, 'src/screens/landlord/ConversationDetailScreen.tsx'), 'utf8');

  assert.match(service, /onreconnected[\s\S]*restoreConversationSubscriptions\(connection, normalizedOrganizationId\)/);
  assert.match(service, /conversationSubscriptions\.restore\(organizationId/);
  assert.match(service, /subscribeToConversation\(organizationId:/);
  assert.match(service, /unsubscribeFromConversation\(organizationId:/);
  assert.match(list, /subscribeToConversation\(organizationId, id\)/);
  assert.match(list, /unsubscribeFromConversation\(organizationId, id\)/);
  assert.match(detail, /subscribeToConversation\(organizationId, Number\(conversationId\)\)/);
  assert.match(detail, /unsubscribeFromConversation\(organizationId, Number\(conversationId\)\)/);
});

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

test('tenant timeline filtering fails closed for staff-only and unsupported visibility', () => {
  const shared = { ...entry, id: 9, sequence: 13, visibility: 'Participants' };
  const staffOnly = { ...entry, id: 10, sequence: 14, visibility: 'StaffOnly' };
  const unknown = { ...entry, id: 11, sequence: 15, visibility: 'FutureInternalVisibility' };
  assert.deepEqual(filterTimelineForAudience([shared, staffOnly, unknown], 'tenant').map((item) => item.id), [9]);
  assert.deepEqual(filterTimelineForAudience([shared, staffOnly, unknown], 'landlord').map((item) => item.id), [9, 10, 11]);
  assert.deepEqual(filterTimelineForAudience([shared, staffOnly, unknown], 'admin').map((item) => item.id), [9, 10, 11]);
  assert.deepEqual(filterTimelineForAudience([shared], 'unsupported'), []);
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
