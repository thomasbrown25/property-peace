import axiosServices from 'utils/axios';

export const getFutureExpenses = async (landlordId, filters = {}) => {
  const { propertyId } = filters;
  const params = new URLSearchParams({ landlordId });
  
  if (propertyId) params.append('propertyId', propertyId);

  const response = await axiosServices.get(`/api/futureexpense?${params.toString()}`);
  return response.data;
};

export const getFutureExpenseById = async (futureExpenseId) => {
  const response = await axiosServices.get(`/api/futureexpense/${futureExpenseId}`);
  return response.data;
};

export const addFutureExpense = async (futureExpense) => {
  const response = await axiosServices.post('/api/futureexpense', futureExpense);
  return response.data;
};

export const deleteFutureExpense = async (futureExpenseId) => {
  const response = await axiosServices.delete(`/api/futureexpense/${futureExpenseId}`);
  return response.data;
};
