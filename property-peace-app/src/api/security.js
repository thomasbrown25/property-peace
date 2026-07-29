import axios from 'utils/axios';

const MFA_METHODS = new Set(['sms', 'totp']);
const unwrap = (response) => response.data?.data ?? response.data;

const assertMethod = (type) => {
  const normalized = String(type || '').toLowerCase();
  if (!MFA_METHODS.has(normalized)) throw new Error('Unsupported authentication method.');
  return normalized;
};

export const getMfaStatus = async () => unwrap(await axios.get('/api/mfa/status'));

export const startSmsEnrollment = async (phoneNumber) =>
  unwrap(await axios.post('/api/mfa/enrollment/sms', { phoneNumber }));

export const confirmSmsEnrollment = async (challengeId, code) =>
  unwrap(await axios.post('/api/mfa/enrollment/verify', { challengeId, code }));

export const startTotpEnrollment = async () => unwrap(await axios.post('/api/mfa/enrollment/totp'));

export const confirmTotpEnrollment = async (challengeId, code) =>
  unwrap(await axios.post('/api/mfa/enrollment/verify', { challengeId, code }));

export const disableMfaMethod = async (type) =>
  unwrap(await axios.delete(`/api/mfa/enrollment/${assertMethod(type)}`));

export const verifyMfaChallenge = async (challengeId, code) =>
  unwrap(await axios.post('/api/mfa/login/verify', { challengeId, code }));

export const securityAPI = {
  getStatus: getMfaStatus,
  startSmsEnrollment,
  confirmSmsEnrollment,
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableMethod: disableMfaMethod,
  verifyChallenge: verifyMfaChallenge
};
