export interface MaintenanceFormFields { propertyId: number | null; unitId: number | null; title: string; description: string; startsAt?: Date | null; endsAt?: Date | null }
export function validateMaintenanceRequest(fields: MaintenanceFormFields, now = new Date()): string | null {
  if (!fields.propertyId || !fields.unitId || !fields.title.trim() || fields.description.trim().length < 10) return 'Choose a property and unit, add a title, and describe the issue in at least 10 characters.';
  if (fields.startsAt || fields.endsAt) {
    if (!fields.startsAt || !fields.endsAt || fields.startsAt.getTime() <= now.getTime()) return 'Choose a future start and end time.';
    if (fields.endsAt.getTime() <= fields.startsAt.getTime()) return 'End time must be after start time.';
  }
  return null;
}
export function buildMaintenanceWindow(startsAt: Date | null, endsAt: Date | null, accessInstructions: string) {
  return startsAt && endsAt ? [{ startsAtUtc: startsAt.toISOString(), endsAtUtc: endsAt.toISOString(), accessInstructions: accessInstructions.trim() || null }] : [];
}
