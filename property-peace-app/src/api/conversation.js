import axiosServices from '../utils/axios';

export const getConversations = async (includeArchived = false) => {
  const response = await axiosServices.get(`/api/Conversation?includeArchived=${includeArchived}`);
  return response.data;
};

export const getConversation = async (conversationId) => {
  const response = await axiosServices.get(`/api/Conversation/${conversationId}`);
  return response.data;
};

export const addConversation = async (data) => {
  const response = await axiosServices.post('/api/Conversation', data);
  return response.data;
};

export const updateConversation = async (conversationId, data) => {
  const response = await axiosServices.put(`/api/Conversation/${conversationId}`, data);
  return response.data;
};

export const deleteConversation = async (conversationId) => {
  const response = await axiosServices.delete(`/api/Conversation/${conversationId}`);
  return response.data;
};

export const archiveConversation = async (conversationId, archive = true) => {
  const response = await axiosServices.post(`/api/Conversation/${conversationId}/archive`, archive);
  return response.data;
};

export const pinConversation = async (conversationId, pin = true) => {
  const response = await axiosServices.post(`/api/Conversation/${conversationId}/pin`, pin);
  return response.data;
};

export const getConversationSummary = async (conversationId) => {
  const response = await axiosServices.get(`/api/Conversation/${conversationId}/summary`);
  return response.data;
};

export const getUrgentConversations = async () => {
  const response = await axiosServices.get('/api/Conversation/urgent');
  return response.data;
};

export const analyzeConversation = async (conversationId) => {
  const response = await axiosServices.post(`/api/Conversation/${conversationId}/analyze`);
  return response.data;
};

export const clearUrgentItems = async (conversationId, urgentItemId = null, messageId = null) => {
  const payload = {
    urgentItemId: urgentItemId || null,
    messageId: messageId || null
  };
  console.log('clearUrgentItems API call:', { conversationId, payload });
  const response = await axiosServices.post(`/api/Conversation/${conversationId}/clear-urgent`, payload);
  console.log('clearUrgentItems API response:', response.data);
  return response.data;
};

export const getSuppressedMessageIds = async () => {
  const response = await axiosServices.get('/api/Conversation/suppressed-messages');
  return response.data;
};

export const getAllUrgentMessageDetails = async () => {
  const response = await axiosServices.get('/api/Conversation/urgent-messages/all');
  return response.data;
};

const unwrap = (response) => response.data?.data;

export const discoverGroupParticipants = async (organizationId) =>
  unwrap(await axiosServices.get('/api/Conversation/groups/participants', { params: { organizationId } })) || [];

export const createGroupConversation = async (request) =>
  unwrap(await axiosServices.post('/api/Conversation/groups', request));

export const addGroupParticipant = async (conversationId, participantUserId) =>
  unwrap(await axiosServices.post(`/api/Conversation/groups/${conversationId}/participants/${participantUserId}`));

export const removeGroupParticipant = async (conversationId, participantUserId) =>
  unwrap(await axiosServices.delete(`/api/Conversation/groups/${conversationId}/participants/${participantUserId}`));

export const leaveGroupConversation = async (conversationId) =>
  unwrap(await axiosServices.post(`/api/Conversation/groups/${conversationId}/leave`));