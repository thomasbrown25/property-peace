export const FEATURE_KEYS = Object.freeze({
  tenantScreening: 'TenantScreening',
  listingSyndication: 'ListingSyndication',
  eSignature: 'ESignature',
  onlineRentCollection: 'OnlineRentCollection',
  dedicatedSmsNumber: 'DedicatedSmsNumber',
  percy: 'Percy'
});

const result = (status, title, message, severity, canInvoke = false, action = null) => ({
  status, title, message, severity, canInvoke, action
});

export function getFeaturePresentation(readiness, { isLoading = false, error = null } = {}) {
  if (isLoading) return result('loading', 'Checking availability', 'Checking whether this feature is ready for your organization…', 'info');
  if (error) return result('error', 'Availability could not be verified', 'This feature is disabled until availability can be verified. Please try again.', 'error');
  if (!readiness || typeof readiness !== 'object') {
    return result('unavailable', 'Unavailable', 'This feature is not available for your organization.', 'warning');
  }

  const state = String(readiness.state || 'unavailable').toLowerCase();
  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  const canInvoke = readiness.canInvoke === true;

  if (state === 'suspended') return result('suspended', 'Temporarily suspended', 'This feature is temporarily suspended. Contact support if you need help.', 'error');
  if (state === 'comingsoon') return result('coming-soon', 'Coming soon', 'This feature is not available yet. We’ll let you know when it is ready.', 'info');
  if (state === 'unavailable') return result('unavailable', 'Unavailable', 'This feature is not currently available.', 'warning');
  if (blockers.includes('PlanEntitlement') || readiness.planEntitled === false) {
    return result('upgrade', 'Upgrade required', 'Your current plan does not include this feature.', 'warning', false, 'upgrade');
  }
  if (
    state === 'configurationrequired' ||
    blockers.includes('ProviderConfiguration') ||
    blockers.includes('OrganizationReadiness') ||
    readiness.providerConfigured === false ||
    readiness.organizationReady === false
  ) {
    return result('setup', 'Setup required', 'Finish organization or provider setup before using this feature.', 'warning', false, 'setup');
  }
  if (!canInvoke) {
    return result('unavailable', 'Unavailable', 'This feature cannot be used by your account right now.', 'warning');
  }
  if (state === 'pilot') return result('pilot', 'Pilot access', 'Your organization has pilot access to this feature.', 'info', true);
  if (state === 'available') return result('available', 'Available', 'This feature is ready to use.', 'success', true);
  return result('unavailable', 'Unavailable', 'This feature is not currently available.', 'warning');
}

export function findFeatureReadiness(items, feature) {
  if (!Array.isArray(items)) return undefined;
  return items.find((item) => String(item?.feature).toLowerCase() === String(feature).toLowerCase());
}
