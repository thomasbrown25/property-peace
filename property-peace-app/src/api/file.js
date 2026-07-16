import axiosServices from 'utils/axios';

export const getFiles = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.categoryId) params.append('categoryId', filters.categoryId);
  if (filters.propertyId) params.append('propertyId', filters.propertyId);
  if (filters.unitId) params.append('unitId', filters.unitId);
  if (filters.leaseId) params.append('leaseId', filters.leaseId);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);

  const response = await axiosServices.get(`/api/file?${params.toString()}`);
  return response.data;
};

export const getFileById = async (id) => {
  const response = await axiosServices.get(`/api/file/${id}`);
  return response.data;
};

export const uploadFiles = async (files, data = {}) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  if (data.title) formData.append('title', data.title);
  if (data.categoryId) formData.append('categoryId', data.categoryId);
  if (data.propertyId) formData.append('propertyId', data.propertyId);
  if (data.unitId) formData.append('unitId', data.unitId);
  if (data.leaseId) formData.append('leaseId', data.leaseId);

  const response = await axiosServices.post('/api/file/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const updateFile = async (id, data) => {
  const response = await axiosServices.put(`/api/file/${id}`, data);
  return response.data;
};

export const deleteFile = async (id) => {
  const response = await axiosServices.delete(`/api/file/${id}`);
  return response.data;
};

