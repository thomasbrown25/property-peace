export const ADVANCED_REPORTING_FEATURE = 'advanced-reporting';
export const DEDICATED_SMS_NUMBER_SETUP_FEATURE = 'dedicated-sms-number-setup';
export const SMS_MESSAGING_FEATURE = 'sms-messaging';
export const RENT_ESTIMATE_FEATURE = 'rent-estimate';
export const LEASE_SHIELD_READ_FEATURE = 'lease-shield-read';
export const LEASE_SHIELD_MANAGE_FEATURE = 'lease-shield-manage';

export const ENTITLEMENT_FEATURES = Object.freeze([
  ADVANCED_REPORTING_FEATURE,
  DEDICATED_SMS_NUMBER_SETUP_FEATURE,
  SMS_MESSAGING_FEATURE,
  RENT_ESTIMATE_FEATURE,
  LEASE_SHIELD_READ_FEATURE,
  LEASE_SHIELD_MANAGE_FEATURE
]);
const KNOWN_CATEGORIES = new Set(['allowed', 'upgrade', 'setup', 'unauthorized', 'unavailable']);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const isSupportedEntitlementFeature = (feature) => ENTITLEMENT_FEATURES.includes(feature);

const readWire = (payload, camel, pascal) => payload?.[camel] ?? payload?.[pascal];
const unavailableDecision = (payload, malformed = true) => ({
  isAllowed: false,
  matrixVersion: readWire(payload, 'matrixVersion', 'MatrixVersion') ?? null,
  featureKey: readWire(payload, 'featureKey', 'FeatureKey') ?? null,
  effectivePlan: readWire(payload, 'effectivePlan', 'EffectivePlan') ?? null,
  reasonCode: readWire(payload, 'reasonCode', 'ReasonCode') ?? 'invalid-entitlement-response',
  category: 'unavailable',
  quota: null,
  requiredAddOns: [],
  readinessDependencies: [],
  malformed
});

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isStringCollection = (value) => Array.isArray(value) && value.every(isNonEmptyString);

function normalizeQuota(candidate) {
  const hasCamelQuota = hasOwn(candidate, 'quota');
  const hasPascalQuota = hasOwn(candidate, 'Quota');
  if (!hasCamelQuota && !hasPascalQuota) return { valid: false, value: null };

  const quota = hasCamelQuota ? candidate.quota : candidate.Quota;
  if (quota === null) return { valid: true, value: null };
  if (!quota || typeof quota !== 'object' || Array.isArray(quota)) return { valid: false, value: null };

  const keys = Object.keys(quota);
  const camelShape = keys.length === 2 && hasOwn(quota, 'unit') && hasOwn(quota, 'limit');
  const pascalShape = keys.length === 2 && hasOwn(quota, 'Unit') && hasOwn(quota, 'Limit');
  if (!camelShape && !pascalShape) return { valid: false, value: null };

  const unit = camelShape ? quota.unit : quota.Unit;
  const limit = camelShape ? quota.limit : quota.Limit;
  if (!isNonEmptyString(unit) || !Number.isInteger(limit) || limit < 0) return { valid: false, value: null };
  return { valid: true, value: { unit, limit } };
}

/** Normalize the public decision/denial wire contract. Any ambiguity is a denial. */
export function normalizeEntitlementDecision(response, expectedFeature = ADVANCED_REPORTING_FEATURE) {
  const candidate = response?.data && typeof response.data === 'object' ? response.data : response;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return unavailableDecision(candidate);

  const isAllowed = readWire(candidate, 'isAllowed', 'IsAllowed');
  const matrixVersion = readWire(candidate, 'matrixVersion', 'MatrixVersion');
  const featureKey = readWire(candidate, 'featureKey', 'FeatureKey');
  const effectivePlan = readWire(candidate, 'effectivePlan', 'EffectivePlan');
  const reasonCode = readWire(candidate, 'reasonCode', 'ReasonCode');
  const rawCategory = readWire(candidate, 'category', 'Category');
  const category = typeof rawCategory === 'string' ? rawCategory.toLowerCase() : '';
  const requiredAddOns = readWire(candidate, 'requiredAddOns', 'RequiredAddOns');
  const readinessDependencies = readWire(candidate, 'readinessDependencies', 'ReadinessDependencies');
  const quota = normalizeQuota(candidate);

  if (
    typeof isAllowed !== 'boolean' ||
    typeof matrixVersion !== 'string' ||
    typeof featureKey !== 'string' ||
    featureKey !== expectedFeature ||
    !isSupportedEntitlementFeature(expectedFeature) ||
    !(effectivePlan === null || typeof effectivePlan === 'string') ||
    typeof reasonCode !== 'string' ||
    typeof rawCategory !== 'string' ||
    !KNOWN_CATEGORIES.has(category) ||
    !quota.valid ||
    !isStringCollection(requiredAddOns) ||
    !isStringCollection(readinessDependencies) ||
    (category === 'allowed') !== isAllowed
  ) {
    return unavailableDecision(candidate);
  }

  return {
    isAllowed,
    matrixVersion,
    featureKey,
    effectivePlan,
    reasonCode,
    category,
    quota: quota.value,
    requiredAddOns: [...requiredAddOns],
    readinessDependencies: [...readinessDependencies],
    malformed: false
  };
}

export function getEntitlementPresentation(decision, { isLoading = false, error = null } = {}) {
  if (isLoading) return { kind: 'loading', canInvoke: false };
  if (error || !decision) return { kind: 'unavailable', canInvoke: false };
  if (decision.isAllowed === true && decision.category === 'allowed' && decision.malformed === false) {
    return { kind: 'allowed', canInvoke: true };
  }
  if (['upgrade', 'setup', 'unauthorized'].includes(decision.category)) {
    return { kind: decision.category, canInvoke: false };
  }
  return { kind: 'unavailable', canInvoke: false };
}

/** Pure SWR-to-view state derivation. Pending requests always revoke cached grants. */
export function deriveEntitlementState(
  decision,
  { organizationLoading = false, hasCacheKey = false, requestLoading = false, isValidating = false, error = null } = {}
) {
  const isLoading = Boolean(organizationLoading || (hasCacheKey && (requestLoading || isValidating)));
  return {
    isLoading,
    presentation: getEntitlementPresentation(decision, { isLoading, error })
  };
}

export function buildEntitlementCacheKey({ feature, subject, organizationId }) {
  if (!isSupportedEntitlementFeature(feature) || subject == null || subject === '' || organizationId == null || organizationId === '') return null;
  return ['entitlement', feature, String(subject), String(organizationId)];
}
