import axios from 'utils/axios';

/**
 * Send broadcast email to all users or selected user IDs (admin only).
 * @param {{ subject: string, body: string, userIds?: number[] }} payload
 */
export const sendBroadcastEmail = async (payload) => {
  const response = await axios.post('/api/admin/broadcast-email', payload);
  return response.data;
};

/**
 * Use AI to improve the subject and body of the broadcast message (admin only).
 * @param {{ subject: string, body: string }} payload
 * @returns {{ success: boolean, subject?: string, body?: string, message?: string }}
 */
export const improveBroadcastMessage = async (payload) => {
  const response = await axios.post('/api/admin/broadcast-email/improve-message', payload);
  return response.data;
};

export const adminBroadcastEmailAPI = {
  sendBroadcastEmail,
  improveBroadcastMessage
};

export default adminBroadcastEmailAPI;
