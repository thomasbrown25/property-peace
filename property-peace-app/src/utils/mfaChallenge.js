const SUPPORTED_CHALLENGE_METHODS = new Set(['sms', 'totp']);

export const getChallengeMethodLabel = (type) => {
  if (type === 'sms') return 'Text message';
  if (type === 'totp') return 'Authenticator app';
  return type;
};

export const normalizeLoginResult = (responseBody) => {
  if (responseBody?.mfaRequired === true && responseBody?.mfa) {
    const mfa = responseBody.mfa;
    const method = String(mfa.method || '').toLowerCase();
    if (!mfa.challengeId || !SUPPORTED_CHALLENGE_METHODS.has(method)) {
      throw new Error('The server returned an invalid multi-factor challenge. Please try again.');
    }
    return {
      kind: 'challenge',
      challenge: {
        requiresMfa: true,
        challengeId: mfa.challengeId,
        expiresAt: mfa.expiresAt,
        methods: [{ type: method, maskedDestination: mfa.maskedPhone || null }]
      }
    };
  }

  const payload = responseBody?.data ?? responseBody;
  if (payload?.requiresMfa === true) {
    if (!payload.challengeId || !Array.isArray(payload.methods)) {
      throw new Error('The server returned an invalid multi-factor challenge. Please try again.');
    }

    const methods = payload.methods
      .map((method) => ({
        type: String(method?.type || '').toLowerCase(),
        maskedDestination: method?.maskedDestination || null
      }))
      .filter((method) => SUPPORTED_CHALLENGE_METHODS.has(method.type));

    if (!methods.length) {
      throw new Error('No supported authentication method is available for this challenge.');
    }

    return { kind: 'challenge', challenge: { ...payload, methods } };
  }

  return { kind: 'authenticated', user: payload };
};
