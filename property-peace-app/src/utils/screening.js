const numeric = (value) => typeof value === 'number' && Number.isFinite(value);

export const normalizeOptions = (payload) => {
  const options = payload?.options ?? payload?.Options;
  return Array.isArray(options) ? options.filter((option) => option && (option.packageCode ?? option.PackageCode)) : [];
};

export const getPayerLabel = (option = {}) => {
  const landlord = option.landlordAmountMinor ?? option.LandlordAmountMinor;
  const applicant = option.applicantAmountMinor ?? option.ApplicantAmountMinor;
  if (numeric(landlord) && numeric(applicant) && landlord > 0 && applicant > 0) return 'Split payment';
  const payer = option.payer ?? option.Payer;
  return payer === 1 || String(payer).toLowerCase() === 'landlord' ? 'Landlord pays' : 'Applicant pays';
};

export const formatMinorAmount = (amount, currency) => {
  if (!numeric(amount) || !currency) return 'Provided after order creation';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
};

export const read = (object, key) => object?.[key] ?? object?.[key[0].toUpperCase() + key.slice(1)];

export const enumLabel = (value, labels = {}) =>
  labels[value] ?? (typeof value === 'string' ? value.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Unknown');

export const screeningErrorState = (status) => {
  if (status === 410) return { kind: 'expired', title: 'This screening link is no longer active' };
  if (status === 401 || status === 403) return { kind: 'denied', title: 'Screening access was denied' };
  if (status === 503) return { kind: 'unavailable', title: 'Screening is temporarily unavailable' };
  return { kind: 'error', title: 'We could not load this screening' };
};

export const getSafeNavigationUrl = (exchange, metadata = {}) => {
  const contentType = metadata.contentType || '';
  const cacheControl = metadata.cacheControl || '';
  if (!/^application\/json\b/i.test(contentType)) throw new Error('Navigation exchange was not JSON.');
  if (!/(^|,)\s*(?:private,\s*)?no-store\b/i.test(cacheControl)) throw new Error('Navigation exchange must be no-store.');

  const pageOrigin = new URL(metadata.pageOrigin).origin;
  const responseOrigin = new URL(metadata.responseUrl, pageOrigin).origin;
  if (pageOrigin !== responseOrigin) throw new Error('Navigation exchange must be same-origin.');

  const rawUrl = exchange?.continuationUrl ?? exchange?.ContinuationUrl ?? exchange?.accessUrl ?? exchange?.AccessUrl;
  const rawExpiry = exchange?.expiresAt ?? exchange?.ExpiresAt;
  const target = new URL(rawUrl);
  if (target.protocol !== 'https:' || target.username || target.password || target.hash || (target.port && target.port !== '443')) {
    throw new Error('A safe HTTPS navigation URL is required.');
  }
  const now = metadata.now ? new Date(metadata.now) : new Date();
  const expiresAt = new Date(rawExpiry);
  const lifetime = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > 15 * 60 * 1000) throw new Error('Navigation access must be short-lived.');
  return target.href;
};

export const navigateTopLevel = (destination, browsingContext = window) => {
  browsingContext.top.location.assign(destination);
};

export const exchangeMetadata = (response) => ({
  pageOrigin: window.location.origin,
  responseUrl: response.url || response.request?.responseURL || response.config?.url,
  contentType: response.headers?.get?.('content-type') || response.headers?.['content-type'] || '',
  cacheControl: response.headers?.get?.('cache-control') || response.headers?.['cache-control'] || ''
});
