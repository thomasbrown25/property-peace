import { calendarRange, setupError } from '../../utils/shortStaySetup.js';

// Every request is scoped to a mounted unit and a property-local, end-exclusive calendar window.
export function createInventorySnapshot({ api, unitId, update }) {
  let active = false;
  let revision = 0;
  const invalidate = () => { active = false; revision++; };
  const load = async (start, end) => {
    if (!active) return;
    const token = ++revision;
    const current = () => active && token === revision;
    update({ report: null, loading: false, error: '' });
    try {
      calendarRange(start, end);
      update({ loading: true });
      const report = await api.getInventoryReport(unitId, start, end);
      if (!current()) return;
      // An empty or mismatched response is not a zero-night report.
      if (!report || String(report.unitId) !== String(unitId) || report.start !== start || report.end !== end ||
          !report.timeZoneId || !['totalNights', 'ownerBlockedNights', 'airbnbBlockedNights', 'overlapNights', 'blockedNights', 'unblockedNights', 'pricedUnblockedNights', 'unpricedUnblockedNights'].every((key) => Number.isSafeInteger(report[key]) && report[key] >= 0) ||
          report.blockedNights + report.unblockedNights !== report.totalNights ||
          report.pricedUnblockedNights + report.unpricedUnblockedNights !== report.unblockedNights)
        throw new Error('Inventory snapshot unavailable. Try again.');
      update({ report });
    } catch (error) {
      if (current()) update({ report: null, error: setupError(error) });
    } finally {
      if (current()) update({ loading: false });
    }
  };
  return { activate: () => { active = true; revision++; }, invalidate, load };
}
