import axiosServices from 'utils/axios';

export const getRecurringExpenses = async (landlordId, filters = {}) => {
  const { propertyId } = filters;
  const params = new URLSearchParams({ landlordId });
  
  if (propertyId) params.append('propertyId', propertyId);

  const response = await axiosServices.get(`/api/recurringexpense?${params.toString()}`);
  return response.data;
};

export const getRecurringExpenseById = async (recurringExpenseId) => {
  const response = await axiosServices.get(`/api/recurringexpense/${recurringExpenseId}`);
  return response.data;
};

export const addRecurringExpense = async (recurringExpense) => {
  console.log('[API] addRecurringExpense called with:', JSON.stringify(recurringExpense, null, 2));
  try {
    const response = await axiosServices.post('/api/recurringexpense', recurringExpense);
    console.log('[API] addRecurringExpense response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] addRecurringExpense error:', error);
    console.error('[API] Error response:', error.response?.data);
    throw error;
  }
};

export const updateRecurringExpense = async (recurringExpenseId, recurringExpense) => {
  const response = await axiosServices.put(`/api/recurringexpense/${recurringExpenseId}`, recurringExpense);
  return response.data;
};

export const deleteRecurringExpense = async (recurringExpenseId) => {
  const response = await axiosServices.delete(`/api/recurringexpense/${recurringExpenseId}`);
  return response.data;
};

export const pauseRecurringExpense = async (recurringExpenseId) => {
  const response = await axiosServices.post(`/api/recurringexpense/${recurringExpenseId}/pause`);
  return response.data;
};

export const resumeRecurringExpense = async (recurringExpenseId) => {
  const response = await axiosServices.post(`/api/recurringexpense/${recurringExpenseId}/resume`);
  return response.data;
};
