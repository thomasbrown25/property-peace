export const listingFields = [
  'squareFeet', 'monthlyRent', 'securityDeposit', 'yearBuilt', 'dateAvailable', 'minLeaseDuration', 'maxLeaseDuration', 'additionalLeaseTermsNotes',
  'petsAllowed', 'marketingDescription', 'videoTourUrl', 'acceptOnlineApplications', 'applicationFeeRequired', 'applicationFee',
  'listingContactName', 'listingContactPhone', 'listingContactEmail', 'syndicateToListingWebsite',
  'requireScreening', 'screeningType', 'requireIncomeVerification', 'incomeVerificationCost', 'syndicateToFreeSites', 'syndicateToPremiumSites',
] as const;
export type ListingField = typeof listingFields[number];
export const listingNumbers = ['squareFeet', 'monthlyRent', 'securityDeposit', 'yearBuilt', 'applicationFee', 'incomeVerificationCost'] as const;
export const listingBooleans = ['petsAllowed', 'acceptOnlineApplications', 'applicationFeeRequired', 'syndicateToListingWebsite', 'requireScreening', 'requireIncomeVerification', 'syndicateToFreeSites', 'syndicateToPremiumSites'] as const;
export const listingAmenityKeys = ['basicAmenityIds', 'defaultAmenityIds', 'customAmenityIds', 'defaultFeatureIds', 'customFeatureIds'] as const;
export type ListingAmenityKey = typeof listingAmenityKeys[number];
export type ListingForm = Record<ListingField, string | boolean> & Record<ListingAmenityKey, number[]> & { propertyId: number | null; unitId: number | null };
const read = (item: Record<string, any>, key: string) => item[key] ?? item[key[0].toUpperCase() + key.slice(1)];
const ids = (items: any[], custom?: boolean) => items.filter(a => custom === undefined || Boolean(read(a, 'isCustom')) === custom).map(a => Number(read(a, 'id'))).filter(id => Number.isInteger(id) && id > 0);
export function listingInitial(item: Record<string, any> = {}): ListingForm {
  const amenities = read(item, 'propertyAmenities') ?? [];
  const features = read(item, 'propertyFeatures') ?? [];
  const result = { propertyId: read(item, 'propertyId') ?? null, unitId: read(item, 'unitId') ?? null,
    basicAmenityIds: ids(read(item, 'basicAmenities') ?? []), defaultAmenityIds: ids(amenities, false), customAmenityIds: ids(amenities, true),
    defaultFeatureIds: ids(features, false), customFeatureIds: ids(features, true) } as ListingForm;
  for (const key of listingFields) {
    const value = read(item, key);
    result[key] = (listingBooleans as readonly string[]).includes(key)
      ? (value == null ? key === 'acceptOnlineApplications' || key === 'syndicateToListingWebsite' : Boolean(value))
      : key === 'screeningType' ? (value == null ? '' : String(value).toLowerCase() === 'essential' ? '0' : String(value).toLowerCase() === 'premium' ? '1' : String(value))
      : key === 'dateAvailable' ? String(value ?? '').slice(0, 10) : String(value ?? (key === 'monthlyRent' || key === 'applicationFee' ? 0 : ''));
  }
  return result;
}
export function listingError(form: ListingForm, requiresUnit = true, original?: ListingForm): string {
  if (!form.propertyId || (requiresUnit && !form.unitId)) return 'Select a property and unit where required.';
  for (const key of listingNumbers) {
    const value = String(form[key]).trim();
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0 || (['squareFeet', 'yearBuilt'].includes(key) && !Number.isInteger(Number(value))))) return `Enter a valid ${key}.`;
  }
  if (form.dateAvailable && !validDate(String(form.dateAvailable))) return 'Enter dates as YYYY-MM-DD.';
  if (form.videoTourUrl && !/^https?:\/\//i.test(String(form.videoTourUrl).trim())) return 'Video tour must be an HTTP(S) URL.';
  if (form.applicationFeeRequired && Number(form.applicationFee) <= 0) return 'Enter a positive application fee.';
  if (form.requireScreening && !['0', '1'].includes(String(form.screeningType))) return 'Select a screening type.';
  if (form.listingContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.listingContactEmail).trim())) return 'Enter a valid listing contact email.';
  // Null is ignored by the update endpoint for nullable date/number fields.
  for (const key of [...listingNumbers, 'dateAvailable'] as const) {
    if (original && String(original[key]).trim() && !String(form[key]).trim())
      return `Cannot clear ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} here; the server does not support removing this value. Enter a replacement instead.`;
  }
  return '';
}
function validDate(value: string) { const d = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function listingPayload(form: ListingForm, editing = false): Record<string, string | number | boolean | null | number[]> {
  const payload: Record<string, string | number | boolean | null | number[]> = { propertyId: form.propertyId, unitId: form.unitId };
  for (const key of listingFields) {
    const raw = form[key];
    payload[key] = (listingBooleans as readonly string[]).includes(key) ? Boolean(raw)
      : (listingNumbers as readonly string[]).includes(key) ? (String(raw).trim() ? Number(raw) : null)
      : key === 'screeningType' ? (String(raw) ? Number(raw) : null)
      : key === 'dateAvailable' ? (raw ? `${raw}T00:00:00` : null) : editing ? String(raw).trim() : String(raw).trim() || null;
  }
  for (const key of listingAmenityKeys) payload[key] = form[key];
  payload.monthlyRent ??= 0;
  return payload;
}
