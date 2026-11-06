// Reuse recent property occupancy responses when the tab is remounted.
// Keep this short-lived: lease changes should become visible without a hard refresh.
const CACHE_MS = 30_000;
const calendars = new Map();

export function readOccupancyCalendar(landlordId, propertyId, startDate, now = Date.now()) {
  const key = `${landlordId}:${propertyId}:${startDate.getFullYear()}-${startDate.getMonth()}`;
  const entry = calendars.get(key);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    calendars.delete(key);
    return null;
  }
  return entry.data;
}

export function storeOccupancyCalendar(landlordId, propertyId, startDate, data, now = Date.now()) {
  const key = `${landlordId}:${propertyId}:${startDate.getFullYear()}-${startDate.getMonth()}`;
  calendars.set(key, { data, expiresAt: now + CACHE_MS });
  // Prevent unbounded growth across properties, accounts and calendar windows.
  if (calendars.size > 24) calendars.delete(calendars.keys().next().value);
}
