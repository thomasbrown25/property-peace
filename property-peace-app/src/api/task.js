import axiosServices from 'utils/axios';

export const getTasks = async ({ from, to, propertyId } = {}) => {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  if (propertyId) params.append('propertyId', propertyId);
  const response = await axiosServices.get(`/api/task?${params.toString()}`);
  return response.data;
};

export const getTaskById = async (id) => {
  const response = await axiosServices.get(`/api/task/${id}`);
  return response.data;
};

export const addTask = async (task) => {
  const response = await axiosServices.post('/api/task', task);
  return response.data;
};

export const updateTask = async (id, task) => {
  const response = await axiosServices.put(`/api/task/${id}`, task);
  return response.data;
};

export const deleteTask = async (id) => {
  const response = await axiosServices.delete(`/api/task/${id}`);
  return response.data;
};
