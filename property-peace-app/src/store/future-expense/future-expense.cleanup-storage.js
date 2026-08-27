const CLEANUP_STORAGE_PREFIX = 'property-peace:future-expense-cleanup:v2';
const LEGACY_CLEANUP_STORAGE_PREFIX = 'property-peace:future-expense-cleanup:v1';

const hasIdentity = (value) => value !== null && value !== undefined && String(value).length > 0;

const normalizeMarker = (marker, landlordId, organizationId) => {
  if (!marker || !hasIdentity(marker.futureExpenseId) || !hasIdentity(marker.propertyId)) return null;
  if (!hasIdentity(marker.landlordId) || String(marker.landlordId) !== String(landlordId)) return null;
  if (!hasIdentity(marker.organizationId) || String(marker.organizationId) !== String(organizationId)) return null;

  return {
    futureExpenseId: marker.futureExpenseId,
    propertyId: marker.propertyId,
    landlordId: marker.landlordId,
    organizationId: marker.organizationId,
    cleanupError: typeof marker.cleanupError === 'string' ? marker.cleanupError : null
  };
};

export const cleanupStorageKey = (landlordId, organizationId) => (
  `${CLEANUP_STORAGE_PREFIX}:${encodeURIComponent(String(landlordId))}:${encodeURIComponent(String(organizationId))}`
);

export const readFutureExpenseCleanupMarkers = (storage, landlordId, organizationId) => {
  if (!storage || !hasIdentity(landlordId) || !hasIdentity(organizationId)) return {};

  try {
    storage.removeItem(`${LEGACY_CLEANUP_STORAGE_PREFIX}:${encodeURIComponent(String(landlordId))}`);
    const value = storage.getItem(cleanupStorageKey(landlordId, organizationId));
    if (!value) return {};
    const envelope = JSON.parse(value);
    if (
      envelope?.version !== 2 ||
      String(envelope?.landlordId) !== String(landlordId) ||
      String(envelope?.organizationId) !== String(organizationId) ||
      !Array.isArray(envelope?.markers)) return {};

    return Object.fromEntries(
      envelope.markers
        .map((marker) => normalizeMarker(marker, landlordId, organizationId))
        .filter(Boolean)
        .map((marker) => [String(marker.futureExpenseId), marker])
    );
  } catch {
    return {};
  }
};

export const writeFutureExpenseCleanupMarkers = (storage, landlordId, organizationId, markers) => {
  if (!storage || !hasIdentity(landlordId) || !hasIdentity(organizationId)) return false;

  try {
    const normalized = Object.values(markers || {})
      .map((marker) => normalizeMarker(marker, landlordId, organizationId))
      .filter(Boolean);
    const key = cleanupStorageKey(landlordId, organizationId);
    if (normalized.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ version: 2, landlordId: String(landlordId), organizationId: String(organizationId), markers: normalized }));
    return true;
  } catch {
    return false;
  }
};

export const upsertFutureExpenseCleanupMarker = (storage, marker) => {
  if (!marker || !hasIdentity(marker.landlordId) || !hasIdentity(marker.organizationId)) return false;
  const normalized = normalizeMarker(marker, marker.landlordId, marker.organizationId);
  if (!normalized) return false;
  const markers = readFutureExpenseCleanupMarkers(storage, marker.landlordId, marker.organizationId);
  markers[String(normalized.futureExpenseId)] = normalized;
  return writeFutureExpenseCleanupMarkers(storage, marker.landlordId, marker.organizationId, markers);
};

export const removeFutureExpenseCleanupMarker = (storage, landlordId, organizationId, futureExpenseId) => {
  if (!hasIdentity(futureExpenseId)) return false;
  const markers = readFutureExpenseCleanupMarkers(storage, landlordId, organizationId);
  delete markers[String(futureExpenseId)];
  return writeFutureExpenseCleanupMarkers(storage, landlordId, organizationId, markers);
};

export const getFutureExpenseCleanupStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};
