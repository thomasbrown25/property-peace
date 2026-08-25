import api from 'utils/axios';

export const getRentPaymentAccess = (signal) => api.get('/api/rent-payment-access', { signal });
export const getRentPaymentFeatureReadiness = (signal) => api.get('/api/feature-readiness', { signal });
export const getRentPaymentActionReadiness = (action, signal) => api.get(`/api/feature-readiness/rent-payments/${action}`, { signal });
export const requestRentPaymentAccess = (signal) => api.post('/api/rent-payment-access/requests', undefined, { signal });
export const listRentPaymentAccessRequests = (status) => api.get('/api/admin/rent-payment-access/requests', { params: { status } });
export const getRentPaymentAccessRequest = (publicId) => api.get(`/api/admin/rent-payment-access/requests/${publicId}`);
export const approveRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/approve`, review);
export const rejectRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/reject`, review);
export const suspendRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/suspend`, review);
