import { rentalMode } from './rentalMode.js';
import { getPropertyOccupancy } from './occupancy.mjs';
import { getLeaseHeaderBalance } from './leaseHeaderSummary.js';

export function getPropertyOverdueRent(propertyId, records = [], unavailable = false) {
  if (unavailable || !Array.isArray(records)) return null;
  return records.filter((record) => String(read(record, 'propertyId', 'PropertyId')) === String(propertyId))
    .reduce((total, record) => total + getLeaseHeaderBalance(record).overdueAmount, 0);
}

const read = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

export function getOwnerProperties(properties = [], now = new Date()) {
  return (properties || []).filter((property) => read(property, 'id', 'Id') != null).map((property) => {
    const id = read(property, 'id', 'Id');
    const shortStayUnit = (read(property, 'units', 'Units') || []).find(
      (unit) => rentalMode(unit) === 'shortTerm' && read(unit, 'id', 'Id') != null
    );
    return {
      id,
      name: read(property, 'name', 'Name') || read(property, 'streetAddress', 'StreetAddress') || 'Property',
      address: [read(property, 'streetAddress', 'StreetAddress'), read(property, 'city', 'City'), read(property, 'state', 'State')].filter(Boolean).join(', '),
      imageUrl: read(property, 'mainImageUrl', 'MainImageUrl') || read(property, 'images', 'Images')?.[0]?.blobUrl || null,
      original: property,
      activeLeaseCount: getPropertyOccupancy(property, now).occupiedUnits,
      href: `/landlord/property/${encodeURIComponent(id)}`,
      shortStayHref: shortStayUnit
        ? `/landlord/property/${encodeURIComponent(id)}/unit/${encodeURIComponent(read(shortStayUnit, 'id', 'Id'))}/short-stay`
        : null
    };
  }).sort((a, b) => Number(b.activeLeaseCount > 0) - Number(a.activeLeaseCount > 0) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function getPropertyMonthRent(propertyId, records = [], unavailable = false) {
  if (unavailable || !Array.isArray(records)) return null;
  const matching = records.filter((record) => String(read(record, 'propertyId', 'PropertyId')) === String(propertyId));
  if (matching.some((record) => read(record, 'currentMonthExpected', 'CurrentMonthExpected') == null || read(record, 'currentMonthCollected', 'CurrentMonthCollected') == null)) return null;
  const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const expected = matching.reduce((total, record) => total + amount(read(record, 'currentMonthExpected', 'CurrentMonthExpected')), 0);
  const paid = matching.reduce((total, record) => total + amount(read(record, 'currentMonthCollected', 'CurrentMonthCollected')), 0);
  return { expected, paid, percent: expected > 0 ? Math.min(100, (paid * 100) / expected) : 0 };
}

export function getOwnerNextStep({ reminders = [], properties = [], propertiesLoading = false, propertiesError = false } = {}) {
  const reminder = reminders[0];
  if (reminder) {
    return {
      title: reminder.title,
      label: 'Scheduled for today',
      href: reminder.type === 'rent' && reminder.leaseId != null && reminder.leaseId !== ''
        ? `/landlord/leases/${encodeURIComponent(reminder.leaseId)}`
        : reminder.type === 'maintenance' ? '/landlord/maintenances' : '/landlord/dashboard?tab=tasks'
    };
  }
  if (propertiesLoading || propertiesError) return null;
  if (!properties?.length) return { title: 'Add your first property', label: 'Get started', href: '/landlord/properties/add' };
  return null;
}
