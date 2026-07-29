import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}));

vi.mock('utils/axios', () => ({ default: http }));

import {
  confirmSmsEnrollment,
  confirmTotpEnrollment,
  disableMfaMethod,
  getMfaStatus,
  startSmsEnrollment,
  startTotpEnrollment,
  verifyMfaChallenge
} from './security';

describe('security API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('centralizes MFA status and enrollment endpoints', async () => {
    http.get.mockResolvedValueOnce({ data: { data: { methods: [] } } });
    http.post.mockResolvedValue({ data: { success: true } });

    await expect(getMfaStatus()).resolves.toEqual({ methods: [] });
    await startSmsEnrollment('+15551234567');
    await confirmSmsEnrollment('sms-enrollment', '123456');
    await startTotpEnrollment();
    await confirmTotpEnrollment('totp-enrollment', '654321');

    expect(http.get).toHaveBeenCalledWith('/api/mfa/status');
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/mfa/enrollment/sms', { phoneNumber: '+15551234567' });
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/mfa/enrollment/verify', { challengeId: 'sms-enrollment', code: '123456' });
    expect(http.post).toHaveBeenNthCalledWith(3, '/api/mfa/enrollment/totp');
    expect(http.post).toHaveBeenNthCalledWith(4, '/api/mfa/enrollment/verify', { challengeId: 'totp-enrollment', code: '654321' });
  });

  it('centralizes method removal and login challenge verification', async () => {
    http.post.mockResolvedValue({ data: { success: true } });

    http.delete.mockResolvedValue({ data: { success: true } });

    await disableMfaMethod('totp');
    await verifyMfaChallenge('challenge/one', '123456');

    expect(http.delete).toHaveBeenCalledWith('/api/mfa/enrollment/totp');
    expect(http.post).toHaveBeenCalledWith('/api/mfa/login/verify', { challengeId: 'challenge/one', code: '123456' });
  });

  it('rejects unsupported method types before making a request', async () => {
    await expect(disableMfaMethod('email')).rejects.toThrow('Unsupported authentication method');
    expect(http.delete).not.toHaveBeenCalled();
  });
});
