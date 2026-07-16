import axiosServices from 'utils/axios';

const listingApi = {
  getListings: async () => {
    const response = await axiosServices.get('/api/listing');
    return response.data;
  },

  getListingById: async (id) => {
    const response = await axiosServices.get(`/api/listing/${id}`);
    return response.data;
  },

  getPublicListing: async (listingNumber) => {
    const response = await axiosServices.get(`/api/listing/public/${listingNumber}`);
    return response.data;
  },

  getListingsByPropertyId: async (propertyId) => {
    const response = await axiosServices.get(`/api/listing/property/${propertyId}`);
    return response.data;
  },

  isUnitListed: async (unitId) => {
    const response = await axiosServices.get(`/api/listing/unit/${unitId}/is-listed`);
    return response.data;
  },

  createListing: async (listingData, imageFiles) => {
    const formData = new FormData();
    
    // Append listing data as JSON
    Object.keys(listingData).forEach(key => {
      const value = listingData[key];
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            formData.append(`${key}[${index}]`, item);
          });
        } else {
          formData.append(key, value);
        }
      }
    });

    // Append image files
    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append('files', file);
      });
    }

    // Do not set Content-Type: let the client set multipart/form-data with boundary
    const response = await axiosServices.post('/api/listing', formData);
    return response.data;
  },

  updateListing: async (id, listingData) => {
    const response = await axiosServices.put(`/api/listing/${id}`, listingData);
    return response.data;
  },

  publishListing: async (id) => {
    const response = await axiosServices.post(`/api/listing/${id}/publish`);
    return response.data;
  },

  deleteListing: async (id) => {
    const response = await axiosServices.delete(`/api/listing/${id}`);
    return response.data;
  },

  uploadListingImages: async (listingId, files) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    // Do not set Content-Type: let the client set multipart/form-data with boundary
    const response = await axiosServices.post(`/api/listingimage/${listingId}`, formData);
    return response.data;
  },

  getListingImages: async (listingId) => {
    const response = await axiosServices.get(`/api/listingimage/${listingId}`);
    return response.data;
  },

  deleteListingImage: async (id) => {
    const response = await axiosServices.delete(`/api/listingimage/${id}`);
    return response.data;
  },

  setCoverPhoto: async (id, listingId) => {
    const response = await axiosServices.put(`/api/listingimage/${id}/set-cover?listingId=${listingId}`);
    return response.data;
  },
};

export default listingApi;
