import axiosServices from 'utils/axios';

/**
 * Get state late fee law for a specific state
 * GET: /api/StateLateFeeLaw/{state}
 */
export const getStateLaw = async (state) => {
  try {
    const response = await axiosServices.get(`/api/StateLateFeeLaw/${state}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching state late fee law:', error);
    throw error;
  }
};

/**
 * Get all state late fee laws
 * GET: /api/StateLateFeeLaw
 */
export const getAllStateLaws = async () => {
  try {
    const response = await axiosServices.get('/api/StateLateFeeLaw');
    return response.data;
  } catch (error) {
    console.error('Error fetching all state late fee laws:', error);
    throw error;
  }
};

/**
 * Update state late fee law (Admin only)
 * POST: /api/StateLateFeeLaw
 */
export const updateStateLaw = async (stateLawData) => {
  try {
    const response = await axiosServices.post('/api/StateLateFeeLaw', stateLawData);
    return response.data;
  } catch (error) {
    console.error('Error updating state late fee law:', error);
    throw error;
  }
};
