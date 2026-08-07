export type MfaMethod = 'sms' | 'totp';

export interface MfaChallenge {
  challengeId: string;
  method: MfaMethod;
  maskedDestination: string | null;
  expiresAt?: string;
}

export type AuthResult<TUser> =
  | { kind: 'authenticated'; user: TUser }
  | { kind: 'challenge'; challenge: MfaChallenge };

type ApiMfaChallenge = {
  challengeId?: string;
  method?: string | number;
  maskedPhone?: string | null;
  expiresAt?: string;
};

type ApiAuthResponse<TUser> = {
  success?: boolean;
  data?: TUser;
  mfaRequired?: boolean;
  mfa?: ApiMfaChallenge;
};

const normalizeMethod = (method: string | number | undefined): MfaMethod => {
  const normalized = typeof method === 'number'
    ? (method === 0 ? 'sms' : method === 1 ? 'totp' : '')
    : String(method ?? '').toLowerCase();

  if (normalized !== 'sms' && normalized !== 'totp') {
    throw new Error('The server returned an unsupported multi-factor method. Please try again.');
  }
  return normalized;
};

export const normalizeAuthResult = <TUser extends { jwtToken?: string }>(
  response: ApiAuthResponse<TUser>,
): AuthResult<TUser> => {
  if (response?.mfaRequired === true) {
    if (!response.mfa?.challengeId) {
      throw new Error('The server returned an invalid multi-factor challenge. Please try again.');
    }

    return {
      kind: 'challenge',
      challenge: {
        challengeId: response.mfa.challengeId,
        method: normalizeMethod(response.mfa.method),
        maskedDestination: response.mfa.maskedPhone ?? null,
        expiresAt: response.mfa.expiresAt,
      },
    };
  }

  if (!response?.data?.jwtToken) {
    throw new Error('The server did not return a valid sign-in session.');
  }

  return { kind: 'authenticated', user: response.data };
};
