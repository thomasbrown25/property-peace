import axiosServices from '../utils/axios';

export const getMessages = async (conversationId, skip = 0, take = 50) => {
  const response = await axiosServices.get(`/api/Message/conversation/${conversationId}?skip=${skip}&take=${take}`);
  return response.data;
};

export const getMessage = async (messageId) => {
  const response = await axiosServices.get(`/api/Message/${messageId}`);
  return response.data;
};

export const addMessage = async (data) => {
  const response = await axiosServices.post('/api/Message', data);
  return response.data;
};

export const updateMessage = async (messageId, content) => {
  const response = await axiosServices.put(`/api/Message/${messageId}`, content);
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await axiosServices.delete(`/api/Message/${messageId}`);
  return response.data;
};

export const markMessageAsRead = async (messageId) => {
  const response = await axiosServices.post(`/api/Message/${messageId}/read`);
  return response.data;
};

export const markConversationAsRead = async (conversationId) => {
  const response = await axiosServices.post(`/api/Message/conversation/${conversationId}/read`);
  return response.data;
};

