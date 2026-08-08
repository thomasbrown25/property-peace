import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';
import { ConversationSummary, TimelinePage } from '../features/messages/messagesModel';

export interface UnreadState {
  conversationId: number;
  lastReadSequence: number;
  latestVisibleSequence: number;
  unreadCount: number;
}

export interface QuickReply {
  id: number;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  contextKind?: string | null;
}

export interface FollowUpTask {
  id: number;
  organizationId: number;
  conversationId: number;
  timelineEntryId: number;
  context: { kind: string; id: number; label: string };
  assigneeUserId: number;
  title: string;
  dueAtUtc: string;
  status: string;
  rowVersion: string;
}

export interface GroupParticipantCandidate {
  userId: number;
  displayName: string;
  isStaff: boolean;
}

export interface GroupConversation {
  id: number;
  organizationId: number;
  title: string;
  participantUserIds: number[];
}

export interface CreateGroupRequest {
  organizationId: number;
  title: string;
  participantUserIds: number[];
}

class ConversationAPI {
  async getConversations(includeArchived = false): Promise<ConversationSummary[]> {
    const response = await apiClient.get<ApiResponse<ConversationSummary[]>>(`/api/Conversation?includeArchived=${includeArchived}`);
    return response.data;
  }

  async getConversation(conversationId: string): Promise<ConversationSummary> {
    const response = await apiClient.get<ApiResponse<ConversationSummary>>(`/api/Conversation/${conversationId}`);
    return response.data;
  }

  async createConversation(data: Partial<ConversationSummary>): Promise<ConversationSummary> {
    const response = await apiClient.post<ApiResponse<ConversationSummary>>('/api/Conversation', data);
    return response.data;
  }

  async updateConversation(conversationId: string, data: Partial<ConversationSummary>): Promise<ConversationSummary> {
    const response = await apiClient.put<ApiResponse<ConversationSummary>>(`/api/Conversation/${conversationId}`, data);
    return response.data;
  }

  async archiveConversation(conversationId: string, archive: boolean): Promise<void> {
    await apiClient.post(`/api/Conversation/${conversationId}/archive`, archive);
  }

  async pinConversation(conversationId: string, pin: boolean): Promise<void> {
    await apiClient.post(`/api/Conversation/${conversationId}/pin`, pin);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/api/Conversation/${conversationId}`);
  }

  async getTimeline(conversationId: string, afterSequence?: number, take = 50): Promise<TimelinePage> {
    const cursor = afterSequence === undefined ? '' : `&afterSequence=${afterSequence}`;
    const response = await apiClient.get<ApiResponse<TimelinePage>>(`/api/Conversation/${conversationId}/timeline?take=${take}${cursor}`);
    return response.data;
  }

  async searchTimeline(conversationId: string, query = '', channel = ''): Promise<TimelinePage> {
    const params = new URLSearchParams({ conversationId, take: '50' });
    if (query.trim()) params.set('query', query.trim());
    if (channel) params.set('channel', channel);
    const response = await apiClient.get<ApiResponse<{ items: TimelinePage['items'] }>>(`/api/Conversation/timeline/search?${params}`);
    return { items: response.data.items, nextCursor: null };
  }

  async getFollowUps(organizationId: string | number, conversationId: string): Promise<FollowUpTask[]> {
    const response = await apiClient.get<ApiResponse<FollowUpTask[]>>(`/api/Conversation/follow-ups?organizationId=${organizationId}&conversationId=${conversationId}`);
    return response.data;
  }

  async createFollowUp(request: Record<string, unknown>): Promise<FollowUpTask> {
    const response = await apiClient.post<ApiResponse<FollowUpTask>>('/api/Conversation/follow-ups', request);
    return response.data;
  }

  async completeFollowUp(id: number, rowVersion: string): Promise<FollowUpTask> {
    const response = await apiClient.post<ApiResponse<FollowUpTask>>(`/api/Conversation/follow-ups/${id}/complete`, { rowVersion });
    return response.data;
  }

  async getUnread(conversationId: string): Promise<UnreadState> {
    const response = await apiClient.get<ApiResponse<UnreadState>>(`/api/Conversation/${conversationId}/unread`);
    return response.data;
  }

  async markTimelineRead(conversationId: string, throughSequence: number | null): Promise<UnreadState> {
    const response = await apiClient.post<ApiResponse<UnreadState>>(`/api/Conversation/${conversationId}/read`, { throughSequence });
    return response.data;
  }

  async getQuickReplies(organizationId: string | number, contextKind?: string): Promise<QuickReply[]> {
    const context = contextKind ? `&contextKind=${encodeURIComponent(contextKind)}` : '';
    const response = await apiClient.get<ApiResponse<QuickReply[]>>(`/api/Conversation/quick-replies?organizationId=${organizationId}${context}`);
    return response.data;
  }

  async discoverGroupParticipants(organizationId: string | number): Promise<GroupParticipantCandidate[]> {
    const response = await apiClient.get<ApiResponse<GroupParticipantCandidate[]>>(
      `/api/Conversation/groups/participants?organizationId=${encodeURIComponent(String(organizationId))}`,
    );
    return response.data;
  }

  async createGroup(request: CreateGroupRequest): Promise<GroupConversation> {
    const response = await apiClient.post<ApiResponse<GroupConversation>>('/api/Conversation/groups', request);
    return response.data;
  }

  async addGroupParticipant(conversationId: string | number, participantUserId: string | number): Promise<void> {
    await apiClient.post(`/api/Conversation/groups/${conversationId}/participants/${participantUserId}`);
  }

  async removeGroupParticipant(conversationId: string | number, participantUserId: string | number): Promise<void> {
    await apiClient.delete(`/api/Conversation/groups/${conversationId}/participants/${participantUserId}`);
  }

  async leaveGroup(conversationId: string | number): Promise<void> {
    await apiClient.post(`/api/Conversation/groups/${conversationId}/leave`);
  }
}

export default new ConversationAPI();
