import type { MaintenanceRequest } from '../../api/maintenanceAPI';
import { forProperty } from '../maintenance/propertyMaintenanceScope';

/** RentDue is accrued unpaid rent (including prior periods), not monthly rent or fees. */
export const propertyRentDue = (records: unknown, propertyId: string): number => {
  if (!Array.isArray(records)) throw new Error('Rent records unavailable');
  return records.reduce((sum: number, record: any) => {
    if (String(record?.propertyId ?? record?.PropertyId ?? '') !== String(propertyId)) return sum;
    const amount = record?.rentDue ?? record?.RentDue;
    const due = Number(amount);
    if (amount == null || !Number.isFinite(due)) throw new Error('Rent due unavailable');
    return sum + Math.max(0, due);
  }, 0);
};

export const propertyOpenRepairs = (requests: MaintenanceRequest[], propertyId: string): number =>
  forProperty(requests, propertyId).length;
