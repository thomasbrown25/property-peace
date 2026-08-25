import api from 'utils/axios';

export const getRentPaymentAccess = () => api.get('/api/rent-payment-access');
export const requestRentPaymentAccess = () => api.post('/api/rent-payment-access/requests');
export const listRentPaymentAccessRequests = (status) => api.get('/api/admin/rent-payment-access/requests', { params: { status } });
export const getRentPaymentAccessRequest = (publicId) => api.get(`/api/admin/rent-payment-access/requests/${publicId}`);
export const approveRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/approve`, review);
export const rejectRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/reject`, review);
export const suspendRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/suspend`, review);
