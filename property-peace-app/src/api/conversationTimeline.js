import axiosServices from 'utils/axios';
import { buildTimelineSearchParams, normalizeQuickReplies, normalizeTimelinePage } from 'utils/conversationTimeline';

const unwrap = (response) => response.data?.data;

export async function getConversationTimeline(conversationId, { afterSequence = null, take = 50 } = {}) {
  const params = new URLSearchParams({ take: String(take) });
  if (afterSequence != null) params.set('afterSequence', String(afterSequence));
  const payload = unwrap(await axiosServices.get(`/api/Conversation/${conversationId}/timeline`, { params }));
  return normalizeTimelinePage(payload);
}

export async function searchConversationTimeline(filters) {
  const query = buildTimelineSearchParams(filters);
  if (query == null) throw new TypeError('Invalid timeline search filters');
  const payload = unwrap(await axiosServices.get(`/api/Conversation/timeline/search?${query}`));
  return normalizeTimelinePage({ items: payload?.items, nextCursor: null });
}

export async function getTimelineUnread(conversationId) {
  const data = unwrap(await axiosServices.get(`/api/Conversation/${conversationId}/unread`));
  return data && Number.isSafeInteger(data.unreadCount) ? data : null;
}

export async function markTimelineRead(conversationId, throughSequence) {
  const response = await axiosServices.post(`/api/Conversation/${conversationId}/read`, { throughSequence });
  return unwrap(response);
}

export async function listQuickReplies(organizationId, contextKind = null) {
  const params = { organizationId, ...(contextKind ? { contextKind } : {}) };
  const payload = unwrap(await axiosServices.get('/api/Conversation/quick-replies', { params }));
  return normalizeQuickReplies(payload, { organizationId, contextKind });
}

export async function createQuickReply(request) {
  return unwrap(await axiosServices.post('/api/Conversation/quick-replies', request));
}

export async function updateQuickReply(id, request) {
  return unwrap(await axiosServices.put(`/api/Conversation/quick-replies/${id}`, request));
}

export async function deleteQuickReply(id) {
  return unwrap(await axiosServices.delete(`/api/Conversation/quick-replies/${id}`));
}

export async function listFollowUps(organizationId, conversationId = null) {
  return unwrap(await axiosServices.get('/api/Conversation/follow-ups', { params: { organizationId, conversationId } })) || [];
}

export async function createFollowUp(request) {
  return unwrap(await axiosServices.post('/api/Conversation/follow-ups', request));
}

export async function completeFollowUp(id, rowVersion) {
  return unwrap(await axiosServices.post(`/api/Conversation/follow-ups/${id}/complete`, { rowVersion }));
}
