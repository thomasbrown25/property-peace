const OPENAI_ADS_CLICK_COOKIE = "__Secure-pp-openai-ads-click";
const PRODUCTION_HOSTS = new Set(["propertypeace.io", "www.propertypeace.io"]);
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function isValidOpenAiAdsClickReference(value: string | null): value is string {
  return value !== null
    && value.length > 0
    && value.length <= 2048
    && !/[\s\u0000-\u001F\u007F]/.test(value);
}

export function buildOpenAiAdsClickCookie(value: string | null, hostname: string): string | null {
  if (!PRODUCTION_HOSTS.has(hostname.toLowerCase())) {
    return null;
  }

  if (!isValidOpenAiAdsClickReference(value)) {
    return `${OPENAI_ADS_CLICK_COOKIE}=; Path=/; Domain=.propertypeace.io; Max-Age=0; SameSite=Lax; Secure`;
  }

  return `${OPENAI_ADS_CLICK_COOKIE}=${encodeURIComponent(value)}; Path=/; Domain=.propertypeace.io; Max-Age=${THIRTY_DAYS_SECONDS}; SameSite=Lax; Secure`;
}

export function getOpenAiAdsClickReference(search: string): string | null {
  return new URLSearchParams(search).get("oppref");
}

export function shouldRequestOpenAiAdsMeasurementConsent(
  hasAnalyticsConsent: boolean,
  hasRecordedOpenAiAdsDecision: boolean,
  oppref: string | null,
) {
  return hasAnalyticsConsent
    && !hasRecordedOpenAiAdsDecision
    && isValidOpenAiAdsClickReference(oppref);
}

export function syncOpenAiAdsClickReference(hasMeasurementConsent: boolean, landingReference?: string | null) {
  if (!hasMeasurementConsent) {
    const cookie = buildOpenAiAdsClickCookie(null, window.location.hostname);

    if (cookie) {
      document.cookie = cookie;
    }
    return;
  }

  const oppref = landingReference ?? getOpenAiAdsClickReference(window.location.search);
  if (!isValidOpenAiAdsClickReference(oppref)) {
    return;
  }

  const cookie = buildOpenAiAdsClickCookie(oppref, window.location.hostname);

  if (cookie) {
    document.cookie = cookie;
  }
}
