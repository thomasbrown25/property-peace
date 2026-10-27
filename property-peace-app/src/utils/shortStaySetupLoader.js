import { calendarRange, isLocalDate, setupError } from './shortStaySetup.js';

export function propertyDateWindow(timeZoneId, now = new Date()) {
  if (!timeZoneId || typeof timeZoneId !== 'string') throw new Error('A valid property IANA time zone is required to view the calendar.');
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch {
    throw new Error('A valid property IANA time zone is required to view the calendar.');
  }
  const value = (type) => parts.find((part) => part.type === type)?.value;
  const start = `${value('year')}-${value('month')}-${value('day')}`;
  if (!isLocalDate(start)) throw new Error('Unable to determine the property-local date.');
  const endDate = new Date(0);
  endDate.setUTCFullYear(Number(value('year')), Number(value('month')) - 1, Number(value('day')) + 30);
  const end = `${String(endDate.getUTCFullYear()).padStart(4, '0')}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
  return { start, end };
}

export function assertUnitInProperty(units, unitId) {
  if (!Array.isArray(units) || !units.some((unit) => String(unit?.id) === String(unitId)))
    throw new Error('Unit does not belong to this property or is not accessible.');
}

// Created per mounted route pair. Generation and calendar revision gate every async completion.
export function createShortStaySetupLoader({ api, propertyId, unitId, update, now = () => new Date() }) {
  let generation = 0;
  let calendarGeneration = 0;
  let active = true;
  const current = (token) => active && generation === token;
  const activate = () => { active = true; generation++; calendarGeneration++; };
  const invalidate = () => { active = false; generation++; calendarGeneration++; };
  const calendar = async (start, end) => {
    if (!active) return;
    const token = generation;
    const request = ++calendarGeneration;
    const valid = () => current(token) && calendarGeneration === request;
    if (valid()) update({ calendarLoading: true, calendarError: '', calendar: null });
    try {
      calendarRange(start, end);
      const result = await api.getCalendar(unitId, start, end);
      if (valid()) update({ calendar: result });
    } catch (error) {
      if (valid()) update({ calendar: null, calendarError: setupError(error) });
    } finally {
      if (valid()) update({ calendarLoading: false });
    }
  };
  const load = async () => {
    if (!active) return;
    const token = ++generation;
    calendarGeneration++;
    if (current(token)) update({ loading: true, verified: false, error: '', notice: '', timeZoneId: '', draft: null, calendar: null, start: '', end: '', calendarError: '', calendarLoading: false });
    try {
      assertUnitInProperty(await api.getUnits(propertyId), unitId);
      if (!current(token)) return;
      update({ verified: true });
      const zone = await api.getTimeZone(propertyId);
      if (!current(token)) return;
      const timeZoneId = zone?.timeZoneId || '';
      if (!timeZoneId) {
        update({ timeZoneId, draft: null });
        return;
      }
      const range = propertyDateWindow(timeZoneId, now());
      update({ timeZoneId, ...range });
      const listing = await api.getListing(unitId);
      if (!current(token)) return;
      update({ draft: listing });
      await calendar(range.start, range.end);
    } catch (error) {
      if (current(token)) update({ error: setupError(error), timeZoneId: '', draft: null, calendar: null });
    } finally {
      if (current(token)) update({ loading: false });
    }
  };
  return { load, calendar, activate, invalidate, isActive: () => active };
}
