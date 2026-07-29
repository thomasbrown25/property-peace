import { describe, expect, it } from 'vitest';
import { getChallengeMethodLabel, normalizeLoginResult } from './mfaChallenge';

describe('normalizeLoginResult', () => {
  it('preserves the existing non-MFA login response shape', () => {
    const user = { id: 7, jwtToken: 'token' };
    expect(normalizeLoginResult({ success: true, data: user })).toEqual({ kind: 'authenticated', user });
  });

  it('recognizes a nested MFA challenge without treating it as authenticated user data', () => {
    const challenge = {
      requiresMfa: true,
      challengeId: 'challenge-1',
      expiresAt: '2026-07-28T18:00:00Z',
      methods: [
        { type: 'SMS', maskedDestination: '••• ••• 0199' },
        { type: 'totp' },
        { type: 'email' }
      ]
    };

    expect(normalizeLoginResult({ success: true, data: challenge })).toEqual({
      kind: 'challenge',
      challenge: {
        ...challenge,
        methods: [
          { type: 'sms', maskedDestination: '••• ••• 0199' },
          { type: 'totp', maskedDestination: null }
        ]
      }
    });
  });

  it('recognizes a top-level challenge and rejects malformed challenges', () => {
    expect(normalizeLoginResult({ requiresMfa: true, challengeId: 'abc', methods: [{ type: 'totp' }] }).kind).toBe('challenge');
    expect(() => normalizeLoginResult({ requiresMfa: true, methods: [] })).toThrow('invalid multi-factor challenge');
  });

  it('normalizes the API password-login MFA response', () => {
    expect(normalizeLoginResult({
      success: true,
      mfaRequired: true,
      mfa: { challengeId: 'api-challenge', method: 'Sms', maskedPhone: '*******4567', expiresAt: '2026-07-28T18:00:00Z' }
    })).toEqual({
      kind: 'challenge',
      challenge: {
        requiresMfa: true,
        challengeId: 'api-challenge',
        expiresAt: '2026-07-28T18:00:00Z',
        methods: [{ type: 'sms', maskedDestination: '*******4567' }]
      }
    });
  });
});

describe('getChallengeMethodLabel', () => {
  it('uses user-facing method names', () => {
    expect(getChallengeMethodLabel('sms')).toBe('Text message');
    expect(getChallengeMethodLabel('totp')).toBe('Authenticator app');
  });
});
