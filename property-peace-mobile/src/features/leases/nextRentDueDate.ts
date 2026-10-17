import type { Lease } from '../../api/leaseAPI';

const field = (lease: Lease, key: string) => lease[key] ?? lease[key[0].toUpperCase() + key.slice(1)];

const dateKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return null;
  const candidate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return candidate.toISOString().slice(0, 10) === match[0].slice(0, 10) ? match[0].slice(0, 10) : null;
};

const scheduledDay = (year: number, month: number, day: number): string => {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, day === -1 ? last : Math.min(day, last))).toISOString().slice(0, 10);
};

/** Returns the next regular rent date, including today; never invents a date after the lease ends. */
export const nextRentDueDate = (lease: Lease, today = new Date()): string | null => {
  const start = dateKey(field(lease, 'startDate'));
  const end = dateKey(field(lease, 'endDate'));
  const day = Number(field(lease, 'rentDueDay'));
  const frequency = String(field(lease, 'rentFrequency') ?? 'Monthly').trim().toLowerCase();
  const interval = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : null;
  if (!start || !end || end < start || !Number.isInteger(day) || (day !== -1 && (day < 1 || day > 31)) || !interval) return null;

  const localToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const earliest = localToday > start ? localToday : start;
  if (earliest > end) return null;

  const [year, month] = start.split('-').map(Number);
  let firstMonth = year * 12 + month - 1;
  if (scheduledDay(year, month - 1, day) < start) firstMonth += interval;
  const [currentYear, currentMonth] = earliest.split('-').map(Number);
  const currentIndex = currentYear * 12 + currentMonth - 1;
  const steps = Math.max(0, Math.floor((currentIndex - firstMonth) / interval));
  let candidateMonth = firstMonth + steps * interval;
  for (let i = 0; i < 2; i++, candidateMonth += interval) {
    const candidate = scheduledDay(Math.floor(candidateMonth / 12), candidateMonth % 12, day);
    if (candidate >= earliest) return candidate <= end ? candidate : null;
  }
  return null;
};
