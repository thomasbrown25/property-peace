// All links are untrusted API data; accept only canonical publisher and Stripe hosted origins.
export function collectionPolicyUrl(requirements) {
  if (requirements?.available !== true || requirements.identityEnabled !== true ||
      typeof requirements.feePolicyConsentVersion !== 'string' ||
      !requirements.feePolicyConsentVersion.trim() || requirements.feePolicyConsentVersion.length > 64 ||
      requirements.feePolicyConsentVersion !== requirements.feePolicyConsentVersion.trim()) return null;
  const value = requirements.feePolicyUrl;
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith('https://app.propertypeace.io/legal/')) return null;
  try {
    const url = new URL(value);
    const path = value.slice('https://app.propertypeace.io/legal/'.length);
    return url.href === value && url.protocol === 'https:' && url.hostname === 'app.propertypeace.io' &&
      url.port === '' && !url.username && !url.password && !url.search && !url.hash &&
      path.split('/').every(segment => /^[a-z0-9-]+$/.test(segment)) ? value : null;
  } catch { return null; }
}

export function stripeIdentityUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.href === value && url.protocol === 'https:' && url.hostname === 'verify.stripe.com' &&
      url.port === '' && !url.username && !url.password && !url.hash ? value : null;
  } catch { return null; }
}

export function draftPropertyIds(applications, propertyId) {
  if (!Array.isArray(applications) || applications.length > 1 ||
      applications.some(app => app?.status !== 'draft')) return null;
  const id = Number(propertyId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const existing = applications[0]?.propertyIds ?? [];
  if (!Array.isArray(existing) || existing.some(value => !Number.isSafeInteger(value) || value <= 0) ||
      new Set(existing).size !== existing.length) return null;
  const ids = [...new Set([...existing, id])];
  return ids.length <= 50 ? ids : null;
}

export function canSaveCollection(requirements, authorityAttested, feeConsent, ids) {
  return Boolean(collectionPolicyUrl(requirements) && authorityAttested === true && feeConsent === true &&
    Array.isArray(ids) && ids.length > 0 && ids.length <= 50);
}

export function collectionStatus(value) {
  return ({ draft: 'Draft saved', submitted: 'Submitted — awaiting identity verification',
    identityPending: 'Identity pending — awaiting Stripe confirmation', identityVerified: 'Identity verified — awaiting review',
    underReview: 'Under review', payoutApproved: 'Review complete — no booking or payout enabled here',
    suspended: 'Suspended — contact support', rejected: 'Rejected — contact support' })[value] || 'Status unavailable — refresh to check';
}
