import api from 'utils/axios';

export const getRentPaymentFeatureReadiness = (signal) => api.get('/api/feature-readiness', { signal });
export const getRentPaymentActionReadiness = (action, signal) => api.get(`/api/feature-readiness/rent-payments/${action}`, { signal });
