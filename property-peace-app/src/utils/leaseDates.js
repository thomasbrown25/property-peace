const pad = (value) => String(value).padStart(2, '0');

const parseCalendarDate = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addCalendarMonths = (date, months) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + Number(months));
  result.setDate(Math.min(originalDay, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return result;
};

export const formatCalendarDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const calculateLeaseEndDate = (startDate, leaseLength) => {
  const start = parseCalendarDate(startDate);
  if (!start) return '';
  const length = Number(leaseLength);
  if (!Number.isFinite(length) || length === 0) return '';
  const termMonths = length === -1 ? 1 : length;
  return formatCalendarDate(addCalendarMonths(start, termMonths));
};
