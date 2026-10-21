export type ListingForm = {
  nightlyBasePrice: string; minimumNights: string; capacity: string; cleaningFee: string;
  checkInTime: string; checkOutTime: string; houseRules: string; amenities: string; cancellationPolicy: string;
  publicTitle: string; publicSummary: string;
  lodgingTaxRatePercent: string; attestLodgingTaxResponsibility: boolean;
};
export const emptyListing = (): ListingForm => ({ nightlyBasePrice: '', minimumNights: '1', capacity: '1', cleaningFee: '0', checkInTime: '', checkOutTime: '', houseRules: '', amenities: '', cancellationPolicy: '', publicTitle: '', publicSummary: '', lodgingTaxRatePercent: '', attestLodgingTaxResponsibility: false });
export const parseLodgingTaxRate = (value: string): number | null | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(trimmed)) return undefined;
  const rate = Number(trimmed);
  return rate <= 100 ? rate : undefined;
};
export const parseLocalDate = (input: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [year, month, day] = input.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day ? input : null;
};
export const validLocalRange = (start: string, end: string): boolean => {
  if (!parseLocalDate(start) || !parseLocalDate(end)) return false;
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
  return days > 0 && days <= 366;
};
export const parseMoney = (value: string, allowZero = false): number | null => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value.trim());
  return Number.isSafeInteger(Math.round(amount * 100)) && (allowZero ? amount >= 0 : amount >= 0.01) && amount <= 999999.99 ? amount : null;
};
const positiveInteger = (value: string): number | null => /^[1-9]\d*$/.test(value.trim()) && Number.isSafeInteger(Number(value.trim())) && Number(value.trim()) <= 2147483647 ? Number(value.trim()) : null;
const time = (value: string): string | null | undefined => value.trim() === '' ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? value.trim() : undefined;
export const listingPayload = (form: ListingForm) => {
  const nightlyBasePrice = parseMoney(form.nightlyBasePrice);
  const minimumNights = positiveInteger(form.minimumNights);
  const capacity = positiveInteger(form.capacity);
  const cleaningFee = parseMoney(form.cleaningFee, true);
  const checkInTime = time(form.checkInTime);
  const checkOutTime = time(form.checkOutTime);
  const lodgingTaxRatePercent = parseLodgingTaxRate(form.lodgingTaxRatePercent);
  if (nightlyBasePrice === null || minimumNights === null || capacity === null || cleaningFee === null || checkInTime === undefined || checkOutTime === undefined || lodgingTaxRatePercent === undefined || (lodgingTaxRatePercent !== null) !== form.attestLodgingTaxResponsibility || form.houseRules.length > 4000 || form.amenities.length > 4000 || form.cancellationPolicy.length > 2000 || form.publicTitle.length > 100 || form.publicSummary.length > 1200) return null;
  return { nightlyBasePrice, minimumNights, capacity, cleaningFee, checkInTime, checkOutTime,
    houseRules: form.houseRules.trim() || null, amenities: form.amenities.trim() || null, cancellationPolicy: form.cancellationPolicy.trim() || null,
    publicTitle: form.publicTitle, publicSummary: form.publicSummary,
    lodgingTaxRatePercent, attestLodgingTaxResponsibility: form.attestLodgingTaxResponsibility };
};
export const ratePayload = (input: string) => {
  const nightlyRate = parseMoney(input);
  return nightlyRate === null ? null : { nightlyRate };
};
export const isOwnerBlock = (block: { id: number; source: string }): boolean => block.source === 'OwnerBlock' && block.id > 0;
export const airbnbTimestamp = (utc: string | null, timeZoneId: string): string => {
  if (!utc) return 'Never';
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  } catch { return 'Unavailable'; }
};
export const ownerError = (error: any): string => error?.response?.data?.message ?? error?.message ?? 'Could not save. Refresh and try again.';
