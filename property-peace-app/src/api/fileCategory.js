import axiosServices from 'utils/axios';

export const getFileCategories = async () => {
  const response = await axiosServices.get('/api/filecategory');
  return response.data;
};

export const getFileCategoryById = async (id) => {
  const response = await axiosServices.get(`/api/filecategory/${id}`);
  return response.data;
};

export const addFileCategory = async (data) => {
  const response = await axiosServices.post('/api/filecategory', data);
  return response.data;
};

export const updateFileCategory = async (id, data) => {
  const response = await axiosServices.put(`/api/filecategory/${id}`, data);
  return response.data;
};

export const deleteFileCategory = async (id) => {
  const response = await axiosServices.delete(`/api/filecategory/${id}`);
  return response.data;
};

