export type ConversationFilter = 'inbox' | 'unread' | 'archived';

export type MessagesAudience = 'tenant' | 'landlord' | 'admin' | 'unsupported';

export interface MessagingScopeGeneration {
  scope: string;
  generation: number;
}

export function advanceMessagingScopeGeneration(previous: MessagingScopeGeneration | undefined, scope: string): MessagingScopeGeneration {
  if (previous?.scope === scope) return previous;
  return { scope, generation: (previous?.generation ?? 0) + 1 };
}

export function isMessagingOperationCurrent(captured: MessagingScopeGeneration, current: MessagingScopeGeneration): boolean {
  return captured.scope === current.scope && captured.generation === current.generation;
}

export function getMessagesAudience(user: any): MessagesAudience {
  const activeRole = user?.currentOrganizationRole ?? user?.CurrentOrganizationRole;
  const roleValue = activeRole ? [activeRole] : user?.roles ?? user?.Roles ?? user?.role ?? user?.Role ?? [];
  const roles = (Array.isArray(roleValue) ? roleValue : [roleValue]).map(String).map((role) => role.toLowerCase());
  if (roles.length !== 1) return 'unsupported';
  if (roles[0] === 'tenant') return 'tenant';
  if (['landlord', 'owner', 'manager'].includes(roles[0])) return 'landlord';
  if (roles[0] === 'admin') return 'admin';
  return 'unsupported';
}

export function buildMessagingScopeKey(user: any, audience: MessagesAudience, conversationId?: string | number): string {
  const userId = user?.id ?? user?.Id ?? 'anonymous';
  const organizationId = user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? 'none';
  const base = `${String(userId)}:${String(organizationId)}:${audience}`;
  return conversationId === undefined ? base : `${base}:${String(conversationId)}`;
}

export function canAccessMessages(audience: MessagesAudience): boolean {
  return audience !== 'unsupported';
}

export function getConversationInboxPath(audience: MessagesAudience, includeArchived = false): string {
  if (!canAccessMessages(audience)) throw new Error('Unsupported messaging audience.');
  const base = audience === 'tenant'
    ? '/api/Conversation/tenant/my-conversations'
    : audience === 'admin' ? '/api/Conversation/admin/conversations' : '/api/Conversation';
  return `${base}?includeArchived=${includeArchived}`;
}

export function getMessageCapabilities(audience: MessagesAudience) {
  const staff = audience === 'landlord' || audience === 'admin';
  return {
    createGroup: staff, manageGroup: staff, quickReplies: staff,
    followUps: staff, archive: staff, pin: staff,
  };
}

export interface ConversationSummary {
  id: string | number;
  title?: string;
  tenantName?: string;
  propertyName?: string;
  unitName?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  updatedAt?: string;
  unreadCount?: number;
  isArchived?: boolean;
  isPinned?: boolean;
  isGroupChat?: boolean;
  organizationId?: string | number;
  participants?: ConversationParticipant[];
  [key: string]: unknown;
}

export interface ConversationParticipant {
  userId: string | number;
  userName?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface GroupDraft {
  title: string;
  participantUserIds: number[];
}

export function validateGroupDraft(draft: GroupDraft): { title: string; participantUserIds: number[]; error: string | null } {
  const title = draft.title.trim();
  const participantUserIds = [...new Set(draft.participantUserIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!title) return { title, participantUserIds, error: 'Enter a group title.' };
  if (title.length > 100) return { title, participantUserIds, error: 'Group titles can be up to 100 characters.' };
  if (participantUserIds.length === 0) return { title, participantUserIds, error: 'Select at least one participant.' };
  return { title, participantUserIds, error: null };
}

export function getActiveGroupMembers(item: ConversationSummary): ConversationParticipant[] {
  return (item.participants ?? []).filter((participant) => participant.isActive !== false);
}

function participantName(participant: ConversationParticipant): string {
  return participant.userName || participant.displayName || `${participant.firstName ?? ''} ${participant.lastName ?? ''}`.trim() || 'Member';
}

export function getGroupMemberSummary(item: ConversationSummary): string {
  const names = getActiveGroupMembers(item).map(participantName);
  if (!names.length) return '';
  return `${names.length} member${names.length === 1 ? '' : 's'} · ${names.join(', ')}`;
}

export interface TimelineDelivery {
  channel: string;
  status: string;
  maskedDestination?: string | null;
  submittedAtUtc?: string | null;
  deliveredAtUtc?: string | null;
  failedAtUtc?: string | null;
}

export interface TimelineEntry {
  id: number;
  conversationId: number;
  sequence: number;
  kind: string;
  occurredAtUtc: string;
  actorUserId?: number | null;
  summary: string;
  metadataVersion: number;
  metadata: Record<string, string>;
  context?: { kind: string; id: number; label: string } | null;
  visibility: string;
  deliveries: TimelineDelivery[];
}

export interface TimelinePage { items: TimelineEntry[]; nextCursor: number | null }

export async function loadConversationCore(options: {
  audience: MessagesAudience;
  selectedConversation?: ConversationSummary | null;
  loadConversation: () => Promise<ConversationSummary>;
  loadTimeline: () => Promise<TimelinePage>;
}): Promise<{ conversation: ConversationSummary | null; timeline: TimelinePage }> {
  if (!canAccessMessages(options.audience)) throw new Error('Unsupported messaging audience.');
  if (options.audience !== 'tenant') {
    const [conversation, timeline] = await Promise.all([options.loadConversation(), options.loadTimeline()]);
    return { conversation, timeline };
  }
  const timeline = await options.loadTimeline();
  return { conversation: options.selectedConversation ?? null, timeline };
}

const KINDS: Record<string, string> = {
  message: 'Message', inboundSms: 'SMS', outboundSms: 'SMS', inboundEmail: 'Email', outboundEmail: 'Email',
  maintenance: 'Maintenance', payment: 'Payment', lease: 'Lease', reminder: 'Reminder', percyFollowUp: 'Follow-up', system: 'Update',
};
const CHANNELS: Record<string, string> = { sms: 'SMS', email: 'Email', inapp: 'In app', 'in-app': 'In app', push: 'Push' };
const DIRECTIONS = new Set(['inbound', 'outbound']);
const STATUSES: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'default' }> = {
  delivered: { label: 'Delivered', tone: 'success' }, read: { label: 'Read', tone: 'success' },
  sent: { label: 'Sent', tone: 'success' }, submitted: { label: 'Submitted', tone: 'default' },
  queued: { label: 'Queued', tone: 'default' }, pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'error' }, undelivered: { label: 'Undelivered', tone: 'error' },
};
const safeText = (value: unknown, max = 2000): value is string =>
  typeof value === 'string' && value.length <= max && !/[<>]/.test(value);
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TimelineEntry>;
  return Number.isInteger(item.id) && Number.isInteger(item.conversationId) && Number.isInteger(item.sequence) &&
    (item.sequence ?? 0) >= 0 && typeof item.kind === 'string' && validDate(item.occurredAtUtc) &&
    safeText(item.summary) && Number.isInteger(item.metadataVersion) && !!item.metadata &&
    typeof item.metadata === 'object' && !Array.isArray(item.metadata) && typeof item.visibility === 'string' &&
    Array.isArray(item.deliveries);
}

export function normalizeTimelinePage(payload: unknown): TimelinePage | null {
  if (!payload || typeof payload !== 'object') return null;
  const page = payload as Partial<TimelinePage>;
  if (!Array.isArray(page.items) || !page.items.every(isTimelineEntry)) return null;
  if (page.nextCursor !== null && page.nextCursor !== undefined && !Number.isInteger(page.nextCursor)) return null;
  if (!Object.prototype.hasOwnProperty.call(page, 'nextCursor')) return null;
  return { items: page.items, nextCursor: page.nextCursor ?? null };
}

export function filterTimelineForAudience(items: TimelineEntry[], audience: MessagesAudience): TimelineEntry[] {
  if (audience === 'unsupported') return [];
  if (audience !== 'tenant') return items;
  return items.filter((item) => item.visibility.toLowerCase() === 'participants');
}

export function getDeliveryPresentation(delivery: Partial<TimelineDelivery>) {
  const channel = typeof delivery.channel === 'string' ? CHANNELS[delivery.channel.toLowerCase()] : undefined;
  const status = typeof delivery.status === 'string' ? STATUSES[delivery.status.toLowerCase()] : undefined;
  if (!channel || !status) return { label: 'Delivery update unavailable', tone: 'default' as const, detail: null };
  const destination = typeof delivery.maskedDestination === 'string' && /^[*•xX\d@.+_\- ]{2,80}$/.test(delivery.maskedDestination)
    ? delivery.maskedDestination : null;
  return { label: status.label, tone: status.tone, detail: destination ? `${channel} · ${destination}` : channel };
}

export function getTimelineEntryPresentation(item: TimelineEntry) {
  const kind = item.kind.length ? item.kind[0].toLowerCase() + item.kind.slice(1) : item.kind;
  const visibility = item.visibility.toLowerCase();
  const channel = typeof item.metadata.channel === 'string' ? CHANNELS[item.metadata.channel.toLowerCase()] : undefined;
  const direction = typeof item.metadata.direction === 'string' && DIRECTIONS.has(item.metadata.direction.toLowerCase())
    ? item.metadata.direction.toLowerCase() : null;
  return {
    id: item.id, sequence: item.sequence, occurredAt: item.occurredAtUtc, summary: item.summary,
    kind, kindLabel: KINDS[kind] ?? 'Activity', channelLabel: channel ?? null, direction,
    context: item.context && safeText(item.context.label, 160) && safeText(item.context.kind, 40) && Number.isInteger(item.context.id)
      ? { kind: item.context.kind, id: item.context.id, label: item.context.label } : null,
    isStaffOnly: visibility === 'staffonly',
    visibilityLabel: visibility === 'staffonly' ? 'Staff only' : 'Shared with participants',
    deliveries: item.deliveries.map(getDeliveryPresentation),
  };
}

export function mergeTimelinePages(current: TimelineEntry[] | null | undefined, incoming: TimelineEntry[] | null | undefined): TimelineEntry[] {
  const bySequence = new Map<number, TimelineEntry>();
  for (const item of [...(current ?? []), ...(incoming ?? [])]) if (!bySequence.has(item.sequence)) bySequence.set(item.sequence, item);
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}

export function selectReadThroughSequence(items: TimelineEntry[]): number | null {
  const sequences = items.map((item) => item.sequence).filter((value) => Number.isInteger(value) && value >= 0);
  return sequences.length ? Math.max(...sequences) : null;
}

export function filterConversations(items: ConversationSummary[], filter: ConversationFilter, query: string): ConversationSummary[] {
  const term = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const hasActivity = !!(item.lastMessagePreview || item.lastMessageAt);
    const inFilter = filter === 'archived' ? !!item.isArchived : !item.isArchived && hasActivity && (filter !== 'unread' || (item.unreadCount ?? 0) > 0);
    if (!inFilter) return false;
    if (!term) return true;
    return [item.title, item.tenantName, item.propertyName, item.unitName, item.lastMessagePreview, getGroupMemberSummary(item)]
      .some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(term));
  }).sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) ||
    (Date.parse(b.lastMessageAt ?? b.updatedAt ?? '') || 0) - (Date.parse(a.lastMessageAt ?? a.updatedAt ?? '') || 0));
}

export function getConversationPresentation(item: ConversationSummary) {
  const participantNames = getActiveGroupMembers(item).map(participantName);
  const title = (item.isGroupChat ? item.title : undefined) || item.tenantName || participantNames.join(', ') || item.title || 'Conversation';
  const unit = item.unitName ? (/^unit\b/i.test(item.unitName) ? item.unitName : `Unit ${item.unitName}`) : '';
  const subtitle = item.isGroupChat ? getGroupMemberSummary(item) : [item.propertyName, unit].filter(Boolean).join(' · ');
  const initials = title.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  return { title, subtitle, preview: item.lastMessagePreview || 'No messages yet', initials, unreadCount: Math.max(0, item.unreadCount ?? 0), isPinned: !!item.isPinned };
}

export function formatConversationTime(value?: string, now = new Date()): string {
  if (!value) return '';
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return '';
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - time.getTime()) / 60000));
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
  if (diffMinutes < 10080) return time.toLocaleDateString(undefined, { weekday: 'short' });
  return time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
