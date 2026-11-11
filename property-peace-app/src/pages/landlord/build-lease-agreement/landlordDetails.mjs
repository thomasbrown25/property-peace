import { readAgreement } from './agreementWorkflow.mjs';

export const landlordFields = {
  firstName: 'First name', lastName: 'Last name', companyName: 'Company name', email: 'Email', phone: 'Phone',
  streetAddress: 'Street address', unit: 'Unit / suite', city: 'City', state: 'State', zipCode: 'ZIP code'
};
export const emptyLandlord = () => ({ entityType: 'Individual', ...Object.fromEntries(Object.keys(landlordFields).map((key) => [key, ''])) });
export function landlordsFromLease(lease, user) {
  const saved = readAgreement(lease, 'leaseLandlords') || [];
  if (saved.length) return saved.map((person) => Object.fromEntries(Object.keys(emptyLandlord()).map((key) => [key, readAgreement(person, key) ?? emptyLandlord()[key]])));
  return [{ ...emptyLandlord(), firstName: user?.firstName ?? user?.firstname ?? '',
    lastName: user?.lastName ?? user?.lastname ?? '', email: user?.email || '' }];
}
export function landlordError(landlords) {
  if (!landlords.length) return 'Add at least one landlord for the agreement.';
  for (const person of landlords) {
    if (!['Individual', 'Company'].includes(person.entityType)) return 'Choose a valid landlord type.';
    if (person.entityType === 'Company' ? !person.companyName?.trim() : !person.firstName?.trim() || !person.lastName?.trim()) {
      return person.entityType === 'Company' ? 'Enter the landlord company name.' : 'Enter the landlord first and last name.';
    }
    if (person.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim())) return 'Enter a valid landlord email address.';
  }
  return null;
}
export function landlordPayload(landlords) {
  return { isPeopleOnLeaseComplete: true, leaseLandlords: landlords.map((person, sortOrder) => ({
    entityType: person.entityType,
    ...Object.fromEntries(Object.keys(landlordFields).map((key) => [key, person[key]?.trim() || null])),
    sortOrder
  })) };
}
