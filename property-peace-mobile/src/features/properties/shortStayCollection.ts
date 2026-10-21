import type { CollectionApplication, CollectionRequirements } from '../../api/shortStayCollectionAPI';

// URL parsing checks the origin, not a string prefix (which would accept attacker subdomains).
export function hostedIdentityUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'verify.stripe.com' && !url.username && !url.password && !url.port && !url.hash;
  } catch { return false; }
}
export function feePolicyUrl(value: unknown): value is string {
  const prefix = 'https://app.propertypeace.io/legal/';
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith(prefix)) return false;
  try {
    const url = new URL(value);
    const path = value.slice(prefix.length);
    return url.href === value && url.protocol === 'https:' && url.hostname === 'app.propertypeace.io' &&
      !url.port && !url.username && !url.password && !url.search && !url.hash &&
      path.split('/').every(segment => /^[a-z0-9-]+$/.test(segment));
  } catch { return false; }
}
export function policyReady(requirements: CollectionRequirements | null): requirements is CollectionRequirements & { feePolicyConsentVersion: string; feePolicyUrl: string } {
  return !!requirements?.available && requirements.reasonCode == null && requirements.identityEnabled === true &&
    typeof requirements.feePolicyConsentVersion === 'string' && !!requirements.feePolicyConsentVersion.trim() &&
    requirements.feePolicyConsentVersion.length <= 64 && requirements.feePolicyConsentVersion === requirements.feePolicyConsentVersion.trim() &&
    feePolicyUrl(requirements.feePolicyUrl);
}
export function collectionUnavailable(requirements: CollectionRequirements | null): string {
  if (!requirements) return 'Collection requirements could not be loaded. Retry to review the current fee policy.';
  if (requirements.reasonCode === 'fee_policy_unavailable' || !feePolicyUrl(requirements.feePolicyUrl) ||
      typeof requirements.feePolicyConsentVersion !== 'string' || !requirements.feePolicyConsentVersion.trim() ||
      requirements.feePolicyConsentVersion.length > 64 || requirements.feePolicyConsentVersion !== requirements.feePolicyConsentVersion.trim())
    return 'The current fee policy is unavailable. Applications and identity verification are paused.';
  if (requirements.reasonCode === 'identity_disabled' || !requirements.identityEnabled)
    return 'Hosted identity verification is not enabled. Applications are paused.';
  return 'Collection applications are currently unavailable. Try again later.';
}
export function scopeMatches(app: CollectionApplication, propertyId: number): boolean {
  return app.propertyIds.length === 1 && app.propertyIds[0] === propertyId;
}
export function currentApplication(apps: CollectionApplication[]): CollectionApplication | null {
  // Multiple active applications are inconsistent; caller must not mutate either.
  const active = apps.filter(app => app.status !== 'rejected');
  return active.length === 1 ? active[0] : null;
}
export function applicationConflict(apps: CollectionApplication[]): boolean {
  return apps.filter(app => app.status !== 'rejected').length > 1;
}
