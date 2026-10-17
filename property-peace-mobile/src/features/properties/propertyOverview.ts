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

/** An accrued balance alone is not overdue; use the API's overdue amount. */
export const propertyOverdueRent = (records: unknown, propertyId: string): boolean => {
  if (!Array.isArray(records)) throw new Error('Rent records unavailable');
  let overdue = false;
  for (const record of records) {
    if (String(record?.propertyId ?? record?.PropertyId ?? '') !== String(propertyId)) continue;
    const amount = record?.overdueAmount ?? record?.OverdueAmount;
    const value = Number(amount);
    if (amount == null || !Number.isFinite(value)) throw new Error('Overdue rent unavailable');
    if (value > 0) overdue = true;
  }
  return overdue;
};

export type PropertyRentStatus = 'overdue' | 'paid' | 'due' | 'no-records';

/** Only a settled, validated property balance can be called paid up to date. */
export const propertyRentStatus = (records: unknown, propertyId: string): PropertyRentStatus => {
  const due = propertyRentDue(records, propertyId);
  const overdue = propertyOverdueRent(records, propertyId);
  if (overdue) return 'overdue';
  if (due > 0) return 'due';
  return (records as any[]).some(record => String(record?.propertyId ?? record?.PropertyId ?? '') === String(propertyId))
    ? 'paid' : 'no-records';
};

export const propertyOpenRepairs = (requests: MaintenanceRequest[], propertyId: string): number =>
  forProperty(requests, propertyId).length;
