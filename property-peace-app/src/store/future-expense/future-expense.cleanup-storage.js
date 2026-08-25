const CLEANUP_STORAGE_PREFIX = 'property-peace:future-expense-cleanup:v1';

const hasIdentity = (value) => value !== null && value !== undefined && String(value).length > 0;

const normalizeMarker = (marker, landlordId) => {
  if (!marker || !hasIdentity(marker.futureExpenseId) || !hasIdentity(marker.propertyId)) return null;
  if (!hasIdentity(marker.landlordId) || String(marker.landlordId) !== String(landlordId)) return null;

  return {
    futureExpenseId: marker.futureExpenseId,
    propertyId: marker.propertyId,
    landlordId: marker.landlordId,
    cleanupError: typeof marker.cleanupError === 'string' ? marker.cleanupError : null
  };
};

export const cleanupStorageKey = (landlordId) => (
  `${CLEANUP_STORAGE_PREFIX}:${encodeURIComponent(String(landlordId))}`
);

export const readFutureExpenseCleanupMarkers = (storage, landlordId) => {
  if (!storage || !hasIdentity(landlordId)) return {};

  try {
    const value = storage.getItem(cleanupStorageKey(landlordId));
    if (!value) return {};
    const envelope = JSON.parse(value);
    if (String(envelope?.landlordId) !== String(landlordId) || !Array.isArray(envelope?.markers)) return {};

    return Object.fromEntries(
      envelope.markers
        .map((marker) => normalizeMarker(marker, landlordId))
        .filter(Boolean)
        .map((marker) => [String(marker.futureExpenseId), marker])
    );
  } catch {
    return {};
  }
};

export const writeFutureExpenseCleanupMarkers = (storage, landlordId, markers) => {
  if (!storage || !hasIdentity(landlordId)) return false;

  try {
    const normalized = Object.values(markers || {})
      .map((marker) => normalizeMarker(marker, landlordId))
      .filter(Boolean);
    const key = cleanupStorageKey(landlordId);
    if (normalized.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ landlordId: String(landlordId), markers: normalized }));
    return true;
  } catch {
    return false;
  }
};

export const upsertFutureExpenseCleanupMarker = (storage, marker) => {
  if (!marker || !hasIdentity(marker.landlordId)) return false;
  const normalized = normalizeMarker(marker, marker.landlordId);
  if (!normalized) return false;
  const markers = readFutureExpenseCleanupMarkers(storage, marker.landlordId);
  markers[String(normalized.futureExpenseId)] = normalized;
  return writeFutureExpenseCleanupMarkers(storage, marker.landlordId, markers);
};

export const removeFutureExpenseCleanupMarker = (storage, landlordId, futureExpenseId) => {
  if (!hasIdentity(futureExpenseId)) return false;
  const markers = readFutureExpenseCleanupMarkers(storage, landlordId);
  delete markers[String(futureExpenseId)];
  return writeFutureExpenseCleanupMarkers(storage, landlordId, markers);
};

export const getFutureExpenseCleanupStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};
