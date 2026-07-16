import ApiClient from './client.js';

export class AnnouncementAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async formatMessageWithAI(message) {
    try {
      const response = await this.client.post('/api/announcement/format', {
        message
      });
      return {
        success: response?.success || false,
        data: response?.data?.formattedMessage || response?.formattedMessage,
        message: response?.message
      };
    } catch (error) {
      console.error('Error formatting message with AI:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to format message'
      };
    }
  }

  async sendAnnouncement(data) {
    try {
      const response = await this.client.post('/api/announcement/send', data);
      return {
        success: response?.success || false,
        data: response?.data,
        message: response?.message
      };
    } catch (error) {
      console.error('Error sending announcement:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to send announcement'
      };
    }
  }

  async getAnnouncements(params = {}) {
    try {
      const response = await this.client.get('/api/announcement', {
        params
      });
      return {
        success: response?.success || false,
        data: response?.data,
        message: response?.message
      };
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch announcements'
      };
    }
  }

  async getAnnouncementById(id) {
    try {
      const response = await this.client.get(`/api/announcement/${id}`);
      return {
        success: response?.success || false,
        data: response?.data,
        message: response?.message
      };
    } catch (error) {
      console.error('Error fetching announcement:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch announcement'
      };
    }
  }

  async deleteAnnouncement(id) {
    try {
      const response = await this.client.delete(`/api/announcement/${id}`);
      return {
        success: response?.success || false,
        data: response?.data,
        message: response?.message
      };
    } catch (error) {
      console.error('Error deleting announcement:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete announcement'
      };
    }
  }
}

export default AnnouncementAPI;
