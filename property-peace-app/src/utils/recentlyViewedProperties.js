import { getActiveOrganizationId } from './impersonationSession.js';

const STORAGE_PREFIX = 'propertyPeace:recent-properties';
const MAX_RECENT_PROPERTIES = 5;
export const PROPERTY_VISITED_EVENT = 'propertyPeace:property-visited';

const readField = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];

export function getRecentPropertyStorageKey(user) {
  const userId = readField(user, 'id', 'Id');
  let organizationId = null;
  try {
    organizationId = getActiveOrganizationId(user);
  } catch {
    return null;
  }

  if (!userId || !organizationId) return null;
  return `${STORAGE_PREFIX}:${organizationId}:${userId}`;
}

export function readRecentlyViewedPropertyIds(user, storage = globalThis.localStorage) {
  const key = getRecentPropertyStorageKey(user);
  if (!key || !storage) return [];

  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];

    return value
      .map((id) => String(id).trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_PROPERTIES);
  } catch {
    return [];
  }
}

export function readPropertyVisitDates(user, storage = globalThis.localStorage) {
  const key = getRecentPropertyStorageKey(user);
  if (!key || !storage) return {};
  try {
    const value = JSON.parse(storage.getItem(`${key}:visited-at`) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, date]) => Number.isFinite(date) && date > 0));
  } catch {
    return {};
  }
}

export function sortPropertiesByLastVisit(properties, visitDates) {
  return [...properties].sort((a, b) =>
    (visitDates[String(readField(b, 'id', 'Id'))] || 0) - (visitDates[String(readField(a, 'id', 'Id'))] || 0) ||
    (readField(a, 'name', 'Name') || '').localeCompare(readField(b, 'name', 'Name') || '', 'en', { sensitivity: 'base' })
  );
}

export function recordRecentlyViewedProperty(propertyId, user, storage = globalThis.localStorage, visitedAt = Date.now()) {
  const key = getRecentPropertyStorageKey(user);
  const normalizedId = propertyId === undefined || propertyId === null ? '' : String(propertyId).trim();
  if (!key || !normalizedId || !storage) return [];

  const nextIds = [normalizedId, ...readRecentlyViewedPropertyIds(user, storage).filter((id) => id !== normalizedId)].slice(
    0,
    MAX_RECENT_PROPERTIES
  );

  try {
    storage.setItem(key, JSON.stringify(nextIds));
    storage.setItem(`${key}:visited-at`, JSON.stringify({ ...readPropertyVisitDates(user, storage), [normalizedId]: visitedAt }));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(PROPERTY_VISITED_EVENT));
    }
    return nextIds;
  } catch {
    return [];
  }
}

export function resolveRecentlyViewedProperties(ids, properties, limit = 3) {
  const propertyMap = new Map(
    (properties || [])
      .map((property) => [readField(property, 'id', 'Id'), property])
      .filter(([id]) => id !== undefined && id !== null)
      .map(([id, property]) => [String(id), property])
  );

  return (ids || [])
    .map((id) => propertyMap.get(String(id)))
    .filter(Boolean)
    .slice(0, limit);
}
