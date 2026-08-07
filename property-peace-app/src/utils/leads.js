export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'showingScheduled', 'applied', 'lost'];
export const SHOWING_STATUSES = ['confirmed', 'cancelled', 'completed', 'noShow'];
const LEAD_TRANSITIONS = {
  new: ['contacted', 'qualified', 'lost'], contacted: ['qualified', 'lost'],
  qualified: ['showingScheduled', 'applied', 'lost'], showingScheduled: ['qualified', 'applied', 'lost'],
  applied: [], lost: ['new']
};
export const allowedLeadStatuses = (current) => [current, ...(LEAD_TRANSITIONS[current] || [])]
  .filter((value, index, all) => all.indexOf(value) === index);

const positive = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

export function buildLeadQuery(filters = {}) {
  const params = new URLSearchParams();
  if (LEAD_STATUSES.includes(filters.status)) params.set('status', filters.status);
  const owner = positive(filters.ownerUserId);
  const listing = positive(filters.listingId);
  if (owner) params.set('ownerUserId', String(owner));
  if (listing) params.set('listingId', String(listing));
  for (const key of ['followUpFromUtc', 'followUpToUtc']) {
    if (typeof filters[key] === 'string' && !Number.isNaN(Date.parse(filters[key]))) params.set(key, filters[key]);
  }
  if (filters.followUpMissing === true) params.set('followUpMissing', 'true');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function formatZonedDateTime(value, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, locale = undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not set';
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(date);
  }
}

function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(instant).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  const representedAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return representedAsUtc - instant.getTime();
}

export function toUtcIso(localDateTime, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime || '')) return null;
  const [datePart, timePart] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const normalized = new Date(wallClockUtc);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 ||
      normalized.getUTCDate() !== day || normalized.getUTCHours() !== hour || normalized.getUTCMinutes() !== minute) return null;
  try {
    // Round-trip every offset in the surrounding transition window. Gaps have zero matches and fall-back
    // overlaps have two; neither is safe to silently choose for a landlord or prospect.
    const offsets = new Set();
    for (let delta = -36; delta <= 36; delta += 6) {
      offsets.add(zoneOffsetMs(new Date(wallClockUtc + delta * 3600000), timeZone));
    }
    const matches = [...offsets].map((offset) => new Date(wallClockUtc - offset))
      .filter((candidate) => zoneOffsetMs(candidate, timeZone) === wallClockUtc - candidate.getTime())
      .filter((candidate) => toZonedLocalInput(candidate.toISOString(), timeZone) === localDateTime);
    const unique = [...new Map(matches.map((candidate) => [candidate.getTime(), candidate])).values()];
    return unique.length === 1 ? unique[0].toISOString() : null;
  } catch {
    return null;
  }
}

export function toZonedLocalInput(value, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return date.toISOString().slice(0, 16);
  }
}

export function normalizeInquiryResult(value) {
  if (!value || typeof value.receipt !== 'string' || !value.receipt.trim()) return null;
  return { receipt: value.receipt, verificationStatus: value.verificationStatus === 'pending' ? 'pending' : 'pending' };
}

export function getLeadErrorMessage(error, fallback = 'The request could not be completed. Please try again.') {
  const status = Number(error?.status ?? error?.response?.status);
  if (status === 401) return 'Your session has ended. Sign in again to continue.';
  if (status === 403) return 'You do not have permission to access this lead workspace.';
  if (status === 404) return 'This lead or showing was not found, or you no longer have access.';
  if (status === 409) return 'That time or update is no longer available. Refresh and try again.';
  if (status === 412) return 'This record changed since it was opened. Refresh before trying again.';
  if (status === 429) return 'Too many requests were made. Wait a moment and try again.';
  return fallback;
}

export const titleCaseStatus = (value) => String(value || '').replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
