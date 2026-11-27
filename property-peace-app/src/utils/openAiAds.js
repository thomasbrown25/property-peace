const CLICK_COOKIE_PREFIX = '__Secure-pp-openai-ads-click=';
const REGISTRATION_ENDPOINT = '/api/advertising-conversions/registration-completed';

export async function trackOpenAiRegistration(post, browser = globalThis.window) {
  if (browser?.location.origin !== 'https://app.propertypeace.io') return;

  try {
    const clickCookie = browser.document.cookie.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(CLICK_COOKIE_PREFIX));
    if (!clickCookie) return;

    const oppref = decodeURIComponent(clickCookie.slice(CLICK_COOKIE_PREFIX.length));
    if (!oppref || oppref.length > 2048 || /[\s\p{Cc}]/u.test(oppref)) return;

    await post(REGISTRATION_ENDPOINT, { oppref }, {
      adapter: 'fetch',
      fetchOptions: { keepalive: true },
      skipAuthRedirect: true,
      skipTokenRefresh: true
    });
  } catch {
    // Attribution failures must never interrupt signup.
  }
}
