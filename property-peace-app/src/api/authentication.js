export const createAuthenticationApi = (http) => ({
  login: (email, password, rememberMe) => http.post('/api/user/login', { email, password, rememberMe: Boolean(rememberMe) }),
  verifyMfa: (challengeId, code, rememberMe) => {
    const body = { challengeId, code };
    if (rememberMe != null) body.rememberMe = Boolean(rememberMe);
    return http.post('/api/mfa/login/verify', body);
  }
});
