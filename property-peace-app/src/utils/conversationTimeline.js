const TIMELINE_KINDS = new Set([
  'message', 'system', 'statusChanged', 'payment', 'maintenance', 'inAppMessage',
  'inboundSms', 'outboundSms', 'email', 'reminder', 'screening', 'lease', 'percyFollowUp'
]);

const CONTEXT_KINDS = new Set(['property', 'unit', 'listing', 'lead', 'rentalapplication', 'lease', 'payment', 'maintenance']);
const CHANNELS = new Set(['inApp', 'sms', 'email']);
const DELIVERY_STATUSES = new Set(['pending', 'leased', 'submitted', 'delivered', 'failed', 'deadLettered', 'suppressed']);
const SEARCH_STATUSES = new Set([...DELIVERY_STATUSES, 'queued', 'sent']);
const DIRECTIONS = new Set(['inbound', 'outbound']);
const MAX_SUMMARY_LENGTH = 4000;

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const isSafeText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/<\s*script\b/i.test(value);
const isIsoDate = (value) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

function normalizeKind(value) {
  if (typeof value !== 'string') return null;
  return TIMELINE_KINDS.has(value) ? value : null;
}

function normalizeContext(context) {
  if (context == null) return null;
  if (!context || typeof context !== 'object' || Array.isArray(context)) return undefined;
  if (!CONTEXT_KINDS.has(context.kind) || !isPositiveInteger(context.id) || !isSafeText(context.label, 160)) return undefined;
  return { kind: context.kind, id: context.id, label: context.label.trim() };
}

function isValidDelivery(delivery) {
  return delivery && typeof delivery === 'object' && !Array.isArray(delivery)
    && typeof delivery.channel === 'string' && typeof delivery.status === 'string'
    && (delivery.maskedDestination == null || (typeof delivery.maskedDestination === 'string' && delivery.maskedDestination.length <= 120));
}

function isTimelineItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const context = normalizeContext(item.context);
  return isPositiveInteger(item.id)
    && isPositiveInteger(item.conversationId)
    && isPositiveInteger(item.sequence)
    && normalizeKind(item.kind) !== null
    && isIsoDate(item.occurredAtUtc)
    && (item.actorUserId == null || isPositiveInteger(item.actorUserId))
    && isSafeText(item.summary, MAX_SUMMARY_LENGTH)
    && isPositiveInteger(item.metadataVersion)
    && item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
    && context !== undefined
    && (item.visibility === 'participants' || item.visibility === 'staffOnly')
    && Array.isArray(item.deliveries) && item.deliveries.every(isValidDelivery);
}

export function normalizeTimelinePage(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) return null;
  if (payload.nextCursor !== null && payload.nextCursor !== undefined && !isPositiveInteger(payload.nextCursor)) return null;
  if (!payload.items.every(isTimelineItem)) return null;
  const items = [...payload.items].sort((left, right) => left.sequence - right.sequence);
  if (items.some((item, index) => index > 0 && item.sequence === items[index - 1].sequence)) return null;
  return { items, nextCursor: payload.nextCursor ?? null };
}

const KIND_LABELS = {
  message: 'Message', system: 'Activity', statusChanged: 'Status', payment: 'Payment', maintenance: 'Maintenance',
  inAppMessage: 'In-app', inboundSms: 'SMS', outboundSms: 'SMS', email: 'Email', reminder: 'Reminder',
  screening: 'Screening', lease: 'Lease', percyFollowUp: 'Follow-up'
};
const CHANNEL_LABELS = { inApp: 'In-app', sms: 'SMS', email: 'Email' };
const STATUS_PRESENTATION = {
  pending: ['Queued', 'info'], leased: ['Processing', 'info'], submitted: ['Submitted', 'info'],
  delivered: ['Delivered', 'success'], failed: ['Delivery failed', 'error'],
  deadLettered: ['Delivery stopped', 'error'], suppressed: ['Suppressed', 'warning']
};

export function getDeliveryPresentation(delivery) {
  if (!isValidDelivery(delivery) || !CHANNELS.has(delivery.channel) || !DELIVERY_STATUSES.has(delivery.status)) {
    return { label: 'Delivery update unavailable', tone: 'default', detail: null };
  }
  const [label, tone] = STATUS_PRESENTATION[delivery.status];
  const destination = delivery.maskedDestination && /^[*xX•\d@.+()\-\s]+$/.test(delivery.maskedDestination)
    ? delivery.maskedDestination.trim() : null;
  return { label, tone, detail: [CHANNEL_LABELS[delivery.channel], destination].filter(Boolean).join(' · ') || null };
}

export function getTimelineEntryPresentation(item) {
  if (!isTimelineItem(item)) return null;
  const channel = CHANNELS.has(item.metadata.channel) ? item.metadata.channel : null;
  const inferredChannel = item.kind === 'email' ? 'email' : (item.kind === 'inboundSms' || item.kind === 'outboundSms' ? 'sms' : item.kind === 'inAppMessage' ? 'inApp' : null);
  const direction = DIRECTIONS.has(item.metadata.direction) ? item.metadata.direction
    : item.kind === 'inboundSms' ? 'inbound' : item.kind === 'outboundSms' ? 'outbound' : null;
  return {
    id: item.id,
    sequence: item.sequence,
    occurredAt: item.occurredAtUtc,
    summary: item.summary,
    kind: item.kind,
    kindLabel: KIND_LABELS[item.kind],
    channelLabel: CHANNEL_LABELS[channel || inferredChannel] || null,
    direction,
    context: normalizeContext(item.context),
    visibilityLabel: item.visibility === 'staffOnly' ? 'Staff only' : 'Shared with participants',
    deliveries: item.deliveries.map(getDeliveryPresentation)
  };
}

export function mergeTimelinePages(current, incoming) {
  const result = new Map();
  for (const item of [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (isTimelineItem(item) && !result.has(item.sequence)) result.set(item.sequence, item);
  }
  return [...result.values()].sort((left, right) => left.sequence - right.sequence);
}

export function buildTimelineSearchParams(filters = {}) {
  if (!filters || typeof filters !== 'object') return null;
  const query = typeof filters.query === 'string' ? filters.query.trim() : '';
  if (query.length > 200) return null;
  const conversationId = filters.conversationId;
  if (conversationId != null && !isPositiveInteger(conversationId)) return null;
  const contextKind = filters.contextKind;
  const contextId = filters.contextId;
  if ((contextKind == null) !== (contextId == null) || (contextKind != null && (!CONTEXT_KINDS.has(contextKind) || !isPositiveInteger(contextId)))) return null;
  const kinds = filters.kinds ?? [];
  if (!Array.isArray(kinds) || kinds.some((kind) => !TIMELINE_KINDS.has(kind))) return null;
  if (filters.channel != null && !CHANNELS.has(filters.channel)) return null;
  if (filters.status != null && !SEARCH_STATUSES.has(filters.status)) return null;
  const skip = filters.skip ?? 0;
  const take = filters.take ?? 50;
  if (!isNonNegativeInteger(skip) || !Number.isInteger(take) || take < 1 || take > 100) return null;
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (conversationId != null) params.set('conversationId', String(conversationId));
  if (contextKind != null) { params.set('contextKind', contextKind); params.set('contextId', String(contextId)); }
  kinds.forEach((kind) => params.append('kinds', kind));
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.status) params.set('status', filters.status);
  params.set('skip', String(skip));
  params.set('take', String(take));
  return params.toString();
}

export function selectReadThroughSequence(items) {
  if (!Array.isArray(items)) return null;
  const sequences = items.map((item) => item?.sequence).filter(isPositiveInteger);
  return sequences.length ? Math.max(...sequences) : null;
}

function toPositiveInteger(value) {
  const numeric = typeof value === 'string' && value.trim() ? Number(value) : value;
  return isPositiveInteger(numeric) ? numeric : null;
}

export function resolveQuickReplyScope({ userId, organizationId, conversation } = {}) {
  const normalizedUserId = toPositiveInteger(userId);
  const normalizedOrganizationId = toPositiveInteger(organizationId);
  if (!normalizedUserId || !normalizedOrganizationId || !conversation || typeof conversation !== 'object') return null;

  const explicitContext = conversation.contextKind ?? conversation.ContextKind;
  let contextKind = explicitContext == null ? null : String(explicitContext).trim().toLowerCase();
  if (!contextKind) {
    if (conversation.maintenanceId || conversation.MaintenanceId || conversation.maintenanceRequestId || conversation.MaintenanceRequestId) contextKind = 'maintenance';
    else if (conversation.listingId || conversation.ListingId) contextKind = 'listing';
    else if (conversation.rentalApplicationId || conversation.RentalApplicationId || conversation.applicationId || conversation.ApplicationId) contextKind = 'rentalapplication';
    else if (conversation.propertyId || conversation.PropertyId) contextKind = 'property';
    else if (conversation.leaseId || conversation.LeaseId) contextKind = 'lease';
  }
  if (contextKind && !CONTEXT_KINDS.has(contextKind)) return null;
  return { userId: normalizedUserId, organizationId: normalizedOrganizationId, contextKind: contextKind || null };
}

export function normalizeQuickReplies(payload, { organizationId, contextKind = null } = {}) {
  const normalizedOrganizationId = toPositiveInteger(organizationId);
  if (!normalizedOrganizationId || !Array.isArray(payload)) return [];
  const normalizedContext = contextKind == null ? null : String(contextKind).trim().toLowerCase();
  if (normalizedContext && !CONTEXT_KINDS.has(normalizedContext)) return [];

  const seen = new Set();
  return payload
    .filter((reply) => {
      if (!reply || typeof reply !== 'object' || Array.isArray(reply) || reply.isActive !== true) return false;
      const id = toPositiveInteger(reply.id);
      const replyOrganizationId = toPositiveInteger(reply.organizationId);
      const replyContext = reply.contextKind == null ? null : String(reply.contextKind).trim().toLowerCase();
      if (!id || seen.has(id) || replyOrganizationId !== normalizedOrganizationId) return false;
      if (replyContext && (!CONTEXT_KINDS.has(replyContext) || replyContext !== normalizedContext)) return false;
      if (!isSafeText(reply.title, 100) || !isSafeText(reply.body, 2000)) return false;
      if (!Number.isInteger(reply.sortOrder) || reply.sortOrder < -10000 || reply.sortOrder > 10000) return false;
      seen.add(id);
      return true;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
    .map((reply) => ({ id: toPositiveInteger(reply.id), title: reply.title.trim(), body: reply.body.trim() }));
}

export function normalizeFollowUps(payload, { organizationId, conversationId } = {}) {
  const organization = toPositiveInteger(organizationId);
  const conversation = toPositiveInteger(conversationId);
  if (!organization || !conversation || !Array.isArray(payload)) return [];
  return payload.filter((task) => task && typeof task === 'object'
    && toPositiveInteger(task.id)
    && toPositiveInteger(task.organizationId) === organization
    && toPositiveInteger(task.conversationId) === conversation
    && toPositiveInteger(task.timelineEntryId)
    && toPositiveInteger(task.assigneeUserId)
    && isSafeText(task.title, 200)
    && isIsoDate(task.dueAtUtc)
    && task.status === 'open'
    && typeof task.rowVersion === 'string' && task.rowVersion.length > 0)
    .sort((left, right) => Date.parse(left.dueAtUtc) - Date.parse(right.dueAtUtc));
}

export function buildFollowUpRequest({ organizationId, conversationId, entry, assigneeUserId, title, dueAtUtc, idempotencyKey } = {}) {
  const context = normalizeContext(entry?.context);
  let due = null;
  try { due = typeof dueAtUtc === 'string' ? new Date(dueAtUtc).toISOString() : null; } catch (_) { due = null; }
  const request = {
    organizationId: toPositiveInteger(organizationId),
    conversationId: toPositiveInteger(conversationId),
    timelineEntryId: toPositiveInteger(entry?.id),
    contextKind: context?.kind,
    contextId: context?.id,
    assigneeUserId: toPositiveInteger(assigneeUserId),
    title: typeof title === 'string' ? title.trim() : '',
    dueAtUtc: due,
    idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : ''
  };
  if (!request.organizationId || !request.conversationId || !request.timelineEntryId || !context
    || !request.assigneeUserId || !isSafeText(request.title, 200) || !request.dueAtUtc
    || !/^[0-9a-f-]{36}$/i.test(request.idempotencyKey)) return null;
  return request;
}

export const CONVERSATION_TIMELINE_KINDS = Object.freeze([...TIMELINE_KINDS]);
