// Calendar-day arithmetic only. The server owns the property's current date and availability.
export const dayNumber = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp / 86400000;
};

export const validateStay = ({ checkIn, checkOut, guests }, listing) => {
  const start = dayNumber(checkIn);
  const end = dayNumber(checkOut);
  if (start === null || end === null) return 'Choose a valid check-in and check-out date.';
  const nights = end - start;
  if (nights < 1 || nights > 30) return 'Choose a stay of 1 to 30 nights, with check-out after check-in.';
  if (nights < listing.minimumNights) return `This stay requires at least ${listing.minimumNights} nights.`;
  if (!Number.isInteger(Number(guests)) || Number(guests) < 1 || Number(guests) > listing.maxGuests) {
    return `Choose 1 to ${listing.maxGuests} guests.`;
  }
  return null;
};

export const moneyFromCents = (cents) =>
  Number.isSafeInteger(cents) && cents >= 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : null;

export const publicStayError = (error, fallback) => {
  const message = error?.message ?? error?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
};
