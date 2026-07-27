import axiosServices from 'utils/axios';

// ==============================|| ANNOUNCEMENT API ||============================== //

/**
 * Format message with AI
 * @param {string} message - The message to format
 * @returns {Promise<{success: boolean, data?: string, message?: string}>}
 */
export const formatMessageWithAI = async (message) => {
  try {
    const response = await axiosServices.post('/api/announcement/format', {
      message
    });
    return {
      success: response.data?.success || false,
      data: response.data?.data?.formattedMessage || response.data?.formattedMessage,
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error formatting message with AI:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to format message'
    };
  }
};

/**
 * Send announcement to selected recipients
 * @param {Object} data - Announcement data
 * @param {long[]} data.organizationIds - Array of organization IDs
 * @param {long[]} data.propertyIds - Array of property IDs
 * @param {long[]} data.unitIds - Array of unit IDs
 * @param {string} data.message - The announcement message
 * @param {boolean} data.sendEmail - Whether to send via email
 * @param {boolean} data.sendNotification - Whether to send as in-app notification
 * @returns {Promise<{success: boolean, data?: {sentCount: number, failedCount: number}, message?: string}>}
 */
export const sendAnnouncement = async (data) => {
  try {
    const response = await axiosServices.post('/api/announcement/send', data);
    return {
      success: response.data?.success || false,
      data: response.data?.data,
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error sending announcement:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send announcement'
    };
  }
};

/**
 * Preview the tenant portal users who will receive an announcement.
 * @param {Object} data - Selected organization, property, and unit IDs
 * @returns {Promise<{success: boolean, data?: {userId: number, name: string, email: string}[], message?: string}>}
 */
export const previewAnnouncementRecipients = async (data) => {
  try {
    const response = await axiosServices.post('/api/announcement/recipients/preview', data);
    return {
      success: response.data?.success || false,
      data: response.data?.data || [],
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error previewing announcement recipients:', error);
    return {
      success: false,
      data: [],
      message: 'We could not verify the recipients for this announcement. Please refresh and try again.'
    };
  }
};

/**
 * Get past announcements
 * @param {Object} params - Query parameters
 * @param {string} params.fromDate - Start date (yyyy-MM-dd format)
 * @param {string} params.toDate - End date (yyyy-MM-dd format)
 * @param {number} params.organizationId - Organization ID to filter by
 * @param {number} params.propertyId - Property ID to filter by
 * @returns {Promise<{success: boolean, data?: any[], message?: string}>}
 */
export const getAnnouncements = async (params = {}) => {
  try {
    const response = await axiosServices.get('/api/announcement', { params });
    return {
      success: response.data?.success || false,
      data: response.data?.data,
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch announcements'
    };
  }
};

/**
 * Get announcement by ID
 * @param {number} id - Announcement ID
 * @returns {Promise<{success: boolean, data?: any, message?: string}>}
 */
export const getAnnouncementById = async (id) => {
  try {
    const response = await axiosServices.get(`/api/announcement/${id}`);
    return {
      success: response.data?.success || false,
      data: response.data?.data,
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error fetching announcement:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch announcement'
    };
  }
};

/**
 * Delete or cancel an announcement
 * @param {number} id - Announcement ID
 * @returns {Promise<{success: boolean, data?: boolean, message?: string}>}
 */
export const deleteAnnouncement = async (id) => {
  try {
    const response = await axiosServices.delete(`/api/announcement/${id}`);
    return {
      success: response.data?.success || false,
      data: response.data?.data,
      message: response.data?.message
    };
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to delete announcement'
    };
  }
};