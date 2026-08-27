import axiosServices from 'utils/axios';

const ROOT = '/api/maintenance-requests';
const data = (response) => response?.data?.data ?? response?.data;
export const newMaintenanceIdempotencyKey = () => crypto.randomUUID();
const idempotencyHeaders = (key) => ({ 'Idempotency-Key': key || newMaintenanceIdempotencyKey() });
const retryKeys = new Map();
const uploadRetryKeys = new WeakMap();
const post = (url, body = {}, key) => {
  const fingerprint = `${url}:${JSON.stringify(body)}`;
  const stableKey = key || retryKeys.get(fingerprint) || newMaintenanceIdempotencyKey();
  if (!key) retryKeys.set(fingerprint, stableKey);
  return axiosServices.post(url, body, { headers: idempotencyHeaders(stableKey) }).then((response) => {
    if (!key) retryKeys.delete(fingerprint);
    return data(response);
  });
};

export const maintenanceWorkflowAPI = {
  list: () => axiosServices.get(ROOT).then(data),
  create: (body, key) => post(ROOT, body, key),
  get: (id) => axiosServices.get(`${ROOT}/${id}`).then(data),
  acknowledge: (id, key) => post(`${ROOT}/${id}/acknowledge`, {}, key),
  changeStatus: (id, status, expectedStatus, key = newMaintenanceIdempotencyKey()) =>
    post(`${ROOT}/${id}/status`, { status, expectedStatus }, key),
  troubleshoot: (id, body, key) => post(`${ROOT}/${id}/percy/troubleshooting`, body, key),
  recordTroubleshootingOutcome: (id, stepId, body, key) => post(`${ROOT}/${id}/percy/troubleshooting/${stepId}/outcome`, body, key),
  assign: (id, body, key) => post(`${ROOT}/${id}/assign`, body, key),
  submitEstimate: (id, body, key) => post(`${ROOT}/${id}/estimates`, body, key),
  approveEstimate: (id, estimateId, expectedVersion, key) => post(`${ROOT}/${id}/estimates/${estimateId}/approve`, { expectedVersion }, key),
  rejectEstimate: (id, estimateId, expectedVersion, reason, key) => post(`${ROOT}/${id}/estimates/${estimateId}/reject`, { expectedVersion, reason }, key),
  issueWorkOrder: (id, body, key) => post(`${ROOT}/${id}/work-orders`, body, key),
  cancelWorkOrder: (id, workOrderId, expectedVersion, reason) => post(`${ROOT}/${id}/work-orders/${workOrderId}/cancel`, { expectedVersion, reason }),
  proposeAppointment: (id, body, key) => post(`${ROOT}/${id}/appointments`, body, key),
  confirmAppointment: (id, appointmentId, expectedVersion, key) => post(`${ROOT}/${id}/appointments/${appointmentId}/confirm`, { expectedVersion }, key),
  cancelAppointment: (id, appointmentId, expectedVersion, reason) => post(`${ROOT}/${id}/appointments/${appointmentId}/cancel`, { expectedVersion, reason }),
  startWork: (id, workOrderId, expectedVersion, key) => post(`${ROOT}/${id}/work-orders/${workOrderId}/start`, { expectedVersion }, key),
  submitCompletion: (id, body, key) => post(`${ROOT}/${id}/completions`, body, key),
  confirmCompletion: (id, completionId, expectedVersion, key) => post(`${ROOT}/${id}/completions/${completionId}/confirm`, { expectedVersion }, key),
  reopenCompletion: (id, completionId, expectedVersion, reason, key) => post(`${ROOT}/${id}/completions/${completionId}/reopen`, { expectedVersion, reason }, key),
  staffCloseCompletion: (id, completionId, expectedVersion, reason, key) => post(`${ROOT}/${id}/completions/${completionId}/staff-close`, { expectedVersion, reason }, key),
  costProjection: (id) => axiosServices.get(`${ROOT}/${id}/cost-projection`).then(data),
  attachments: (id) => axiosServices.get(`${ROOT}/${id}/attachments`).then(data),
  uploadAttachment: (id, purpose, file, key) => {
    const body = new FormData(); body.append('purpose', purpose); body.append('file', file);
    const fingerprint = `${id}:${purpose}`; const fileKeys = uploadRetryKeys.get(file) || new Map();
    const stableKey = key || fileKeys.get(fingerprint) || newMaintenanceIdempotencyKey();
    if (!key) { fileKeys.set(fingerprint, stableKey); uploadRetryKeys.set(file, fileKeys); }
    return axiosServices.post(`${ROOT}/${id}/attachments`, body, { headers: { ...idempotencyHeaders(stableKey), 'Content-Type': 'multipart/form-data' } }).then((response) => {
      if (!key) fileKeys.delete(fingerprint);
      return data(response);
    });
  },
  deleteAttachment: (id, attachmentId) => axiosServices.delete(`${ROOT}/${id}/attachments/${attachmentId}`, { headers: idempotencyHeaders() }).then(data),
  downloadAttachment: (id, attachmentId) => axiosServices.get(`${ROOT}/${id}/attachments/${attachmentId}/content`, { responseType: 'blob' })
};

export function maintenanceProblemMessage(error, fallback = 'The maintenance action could not be completed.') {
  return error?.detail || error?.message || error?.response?.data?.detail || fallback;
}
