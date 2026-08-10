const VERSION = 1;
const MODES = new Set(['vacant', 'occupied', 'import']);
const KEY_PREFIX = 'propertyPeace.activationMode.v1.organization.';

const validOrganizationId = (value) => Number.isSafeInteger(value) && value > 0;

export function readActivationModePreference(storage, organizationId) {
  if (!validOrganizationId(organizationId) || !storage) return 'vacant';
  try {
    const parsed = JSON.parse(storage.getItem(`${KEY_PREFIX}${organizationId}`));
    return parsed?.version === VERSION && MODES.has(parsed.mode) ? parsed.mode : 'vacant';
  } catch {
    return 'vacant';
  }
}

export function writeActivationModePreference(storage, organizationId, mode) {
  if (!validOrganizationId(organizationId) || !MODES.has(mode) || !storage) return false;
  try {
    storage.setItem(`${KEY_PREFIX}${organizationId}`, JSON.stringify({ version: VERSION, mode }));
    return true;
  } catch {
    return false;
  }
}

export function activationModeStorage(globalObject) {
  try {
    return globalObject?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function explicitActivationMode(input) {
  const requested = typeof input?.get === 'function' ? input.get('mode') : null;
  return MODES.has(requested) ? requested : null;
}
