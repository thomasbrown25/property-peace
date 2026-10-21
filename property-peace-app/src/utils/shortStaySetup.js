// Property-local dates only; never convert these calendar keys through UTC or Date.toISOString().
export function isLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const days = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export function calendarRange(start, end) {
  if (!isLocalDate(start) || !isLocalDate(end) || start >= end) throw new Error('Enter valid local dates with end after start (end is exclusive).');
  const dayNumber = (key) => { const [year, month, day] = key.split('-').map(Number); const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0); return date.getTime() / 86400000; };
  if (dayNumber(end) - dayNumber(start) > 366) throw new Error('Select no more than 366 nights.');
  return { start, end };
}

export function blockPayload(startDate, endDate, reason) {
  calendarRange(startDate, endDate);
  if ((reason?.trim().length ?? 0) > 500) throw new Error('Reason must be at most 500 characters.');
  return { startDate, endDate, reason: reason?.trim() || null };
}

function money(value, label, allowZero = false) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || !Number.isFinite(Number(text)) || (allowZero ? Number(text) < 0 : Number(text) <= 0))
    throw new Error(`${label} must be ${allowZero ? 'nonnegative' : 'positive'} with at most two decimal places.`);
  return Number(text);
}

function discountPercent(value, label) {
  const text = String(value ?? '0').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || !Number.isFinite(Number(text)) || Number(text) >= 100)
    throw new Error(`${label} must be between 0 and 99.99 percent with at most two decimal places.`);
  return Number(text);
}

function positiveInteger(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > 2147483647) throw new Error(`${label} must be a positive whole number.`);
  return Number(text);
}

export function listingPayload(values, attestLodgingTaxResponsibility = false) {
  const taxText = String(values.lodgingTaxRatePercent ?? '').trim();
  let lodgingTaxRatePercent = null;
  if (taxText !== '') {
    if (!/^(?:\d+)(?:\.\d{1,4})?$/.test(taxText) || !Number.isFinite(Number(taxText)) || Number(taxText) > 100)
      throw new Error('Lodging tax rate must be between 0 and 100 percent with at most four decimal places.');
    if (!attestLodgingTaxResponsibility) throw new Error('Confirm owner/manager lodging tax responsibility before saving a rate.');
    lodgingTaxRatePercent = Number(taxText);
  } else if (attestLodgingTaxResponsibility) {
    throw new Error('Enter a lodging tax rate before confirming responsibility (enter 0 only if applicable).');
  }
  const time = (value, label) => {
    if (!value) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${label} must be a local HH:mm time.`);
    return value;
  };
  for (const [key, max] of [['houseRules', 4000], ['amenities', 4000], ['cancellationPolicy', 2000]]) {
    if (String(values[key] ?? '').length > max) throw new Error(`${key} exceeds ${max} characters.`);
  }
  for (const [key, label, max] of [['publicTitle', 'Public title', 100], ['publicSummary', 'Public summary', 1200]]) {
    if (String(values[key] ?? '').length > max) throw new Error(`${label} exceeds ${max} characters.`);
  }
  return {
    nightlyBasePrice: money(values.nightlyBasePrice, 'Base nightly price'),
    weekendNightlyRate: String(values.weekendNightlyRate ?? '').trim() === '' ? null : rateAmount(values.weekendNightlyRate, 'Weekend nightly rate'),
    weeklyDiscountPercent: discountPercent(values.weeklyDiscountPercent, 'Weekly discount'),
    monthlyDiscountPercent: discountPercent(values.monthlyDiscountPercent, 'Monthly discount'),
    minimumNights: positiveInteger(values.minimumNights, 'Minimum nights'),
    capacity: positiveInteger(values.capacity, 'Sleeping capacity'),
    cleaningFee: money(values.cleaningFee, 'Cleaning fee', true),
    lodgingTaxRatePercent, attestLodgingTaxResponsibility,
    checkInTime: time(values.checkInTime, 'Check-in'),
    checkOutTime: time(values.checkOutTime, 'Check-out'),
    houseRules: values.houseRules ?? '', amenities: values.amenities ?? '', cancellationPolicy: values.cancellationPolicy ?? '',
    ...(values.publicTitle !== undefined ? { publicTitle: values.publicTitle } : {}),
    ...(values.publicSummary !== undefined ? { publicSummary: values.publicSummary } : {})
  };
}

function rateAmount(value, label) {
  const amount = money(value, label);
  if (amount > 999999.99) throw new Error(`${label} must be at most 999999.99.`);
  return amount;
}

export function ratePayload(date, nightlyRate) {
  if (!isLocalDate(date)) throw new Error('Enter a valid yyyy-MM-dd local night.');
  return { nightlyRate: rateAmount(nightlyRate, 'Nightly rate') };
}

export function rangeRatePayload(startDate, endDate, nightlyRate) {
  calendarRange(startDate, endDate);
  return { startDate, endDate, nightlyRate: rateAmount(nightlyRate, 'Nightly rate') };
}

export function setupError(error) {
  const message = error?.message || error?.response?.data?.message || 'Request failed. Try again.';
  const status = error?.status ?? error?.response?.status ?? error?.statusCode;
  if (status === 409) return `${message} Check that this unit is short-term and the property has a valid IANA time zone; refresh the calendar to review conflicts before retrying.`;
  return message;
}
