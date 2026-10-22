import { rentalMode } from './rentalMode.js';

const read = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

export function getOwnerProperties(properties = []) {
  return (properties || []).filter((property) => read(property, 'id', 'Id') != null).map((property) => {
    const id = read(property, 'id', 'Id');
    const shortStayUnit = (read(property, 'units', 'Units') || []).find(
      (unit) => rentalMode(unit) === 'shortTerm' && read(unit, 'id', 'Id') != null
    );
    return {
      id,
      name: read(property, 'name', 'Name') || read(property, 'streetAddress', 'StreetAddress') || 'Property',
      href: `/landlord/property/${encodeURIComponent(id)}`,
      shortStayHref: shortStayUnit
        ? `/landlord/property/${encodeURIComponent(id)}/unit/${encodeURIComponent(read(shortStayUnit, 'id', 'Id'))}/short-stay`
        : null
    };
  });
}

export function getOwnerNextStep({ reminders = [], properties = [], propertiesLoading = false, propertiesError = false } = {}) {
  const reminder = reminders[0];
  if (reminder) {
    return {
      title: reminder.title,
      label: 'Scheduled for today',
      href: reminder.type === 'maintenance' ? '/landlord/maintenances' : '/landlord/dashboard?tab=tasks'
    };
  }
  if (propertiesLoading || propertiesError) return null;
  if (!properties?.length) return { title: 'Add your first property', label: 'Get started', href: '/landlord/properties/add' };
  return null;
}
