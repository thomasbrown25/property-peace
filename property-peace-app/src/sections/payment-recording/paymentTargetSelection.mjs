// Reuse the selector's recordability checks; never default to another property's lease.
export function getLatestActivePaymentTarget(targets, propertyId) {
  if (propertyId == null || propertyId === '') return null;

  return targets.reduce((latest, target) => {
    if (!target.isRecordable || String(target.propertyId) !== String(propertyId)) return latest;
    const start = Date.parse(target.lease?.startDate ?? target.lease?.StartDate);
    if (!Number.isFinite(start)) return latest;
    const latestStart = latest ? Date.parse(latest.lease?.startDate ?? latest.lease?.StartDate) : -Infinity;
    return start > latestStart ? target : latest;
  }, null);
}
