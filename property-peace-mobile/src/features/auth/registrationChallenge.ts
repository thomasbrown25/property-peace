const PATH = '/mobile-signup-challenge';

export function challengeRequired(isDev: boolean, disabled: string | undefined): boolean {
  // This switch is ONLY for local API instances with Turnstile explicitly disabled.
  return !(isDev && disabled === 'true');
}

export function challengeUrl(base: string): string {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('Set EXPO_PUBLIC_APP_URL to the HTTPS app host (or localhost for development).');
  }
  return new URL(PATH.slice(1), url.origin + '/').href;
}

export function isAllowedChallengeNavigation(page: string, destination: string): boolean {
  try {
    const url = new URL(destination);
    return destination === page ||
      (url.protocol === 'https:' && url.hostname === 'challenges.cloudflare.com' &&
       url.pathname.startsWith('/cdn-cgi/challenge-platform/') && !url.username && !url.password);
  } catch { return false; }
}

export function parseChallengeMessage(data: string, sourceUrl: string, page: string, nonce: string):
  { type: 'token'; token: string } | { type: 'error' } | { type: 'expired' } | { type: 'setup-error' } | null {
  if (sourceUrl !== page || data.length > 3200) return null;
  try {
    const message = JSON.parse(data);
    if (!message || message.nonce !== nonce) return null;
    if (message.type === 'turnstile-token' && typeof message.token === 'string' &&
        message.token.length > 0 && message.token.length <= 2048 && !/\s/.test(message.token)) {
      return { type: 'token', token: message.token };
    }
    if (message.type === 'turnstile-error') return { type: 'error' };
    if (message.type === 'turnstile-setup-error') return { type: 'setup-error' };
    if (message.type === 'turnstile-expired') return { type: 'expired' };
  } catch { /* Ignore malformed and unrelated messages. */ }
  return null;
}
