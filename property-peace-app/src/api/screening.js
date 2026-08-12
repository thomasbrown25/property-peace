import axiosServices from 'utils/axios';

const data = (response) => response.data?.data ?? response.data;

export const screeningApi = {
  quoteOptions: (applicationId) => axiosServices.get(`/api/screenings/application/${applicationId}/quote-options`).then(data),
  detailsByApplication: (applicationId) => axiosServices.get(`/api/screenings/application/${applicationId}/details`).then(data),
  detail: (orderId) => axiosServices.get(`/api/screenings/${orderId}/detail`).then(data),
  create: (applicationId, packageCode, payer, idempotencyKey) =>
    axiosServices
      .post(
        '/api/screenings/invitations',
        {
          applicationId,
          package: packageCode,
          payer
        },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
      .then(data),
  decide: (orderId, payload) => axiosServices.post(`/api/screenings/${orderId}/decision`, payload).then(data),
  adverseAction: (orderId, payload) => axiosServices.post(`/api/screenings/${orderId}/adverse-actions`, payload).then(data),
  retryAdverseAction: (adverseActionId, channel) =>
    axiosServices.post(`/api/screenings/adverse-actions/${adverseActionId}/retry`, { channel }).then(data),
  revokeAccess: (orderId) => axiosServices.post(`/api/screenings/${orderId}/applicant-access/revoke`).then(data),
  reportAccess: (orderId) => axiosServices.post(`/api/screenings/${orderId}/report-access`, { purpose: 1 }).then((response) => response)
};

const applicantRequest = async (path, token, init = {}) => {
  const accessHeader = token ? { 'X-Screening-Access': token } : {};
  const response = await fetch(`/api/screenings/applicant${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...accessHeader,
      ...(init.headers || {})
    }
  });
  let body = null;
  if ((response.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.message || 'Screening request failed.');
    error.status = response.status;
    throw error;
  }
  return { body, response };
};

export const applicantScreeningApi = {
  invitation: (token) => applicantRequest('/invitation', token),
  status: (token) => applicantRequest('/status', token),
  consent: (token, payload) => applicantRequest('/consent/start', token, { method: 'POST', body: JSON.stringify(payload) }),
  reportAccess: (token) => applicantRequest('/report-access', token, { method: 'POST', body: '{}' }),
  adverseAction: (token) => applicantRequest('/adverse-action', token),
  reconsider: (token, reason) =>
    applicantRequest('/adverse-action/reconsideration', token, { method: 'POST', body: JSON.stringify({ reason }) }),
  dispute: (token, payload) => applicantRequest('/disputes', token, { method: 'POST', body: JSON.stringify(payload) })
};
