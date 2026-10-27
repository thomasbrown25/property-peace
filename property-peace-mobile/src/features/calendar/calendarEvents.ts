import type { Lease } from '../../api/leaseAPI';
import type { MaintenanceRequest } from '../../api/maintenanceAPI';

export type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  detail: string;
  category: 'Lease' | 'Maintenance' | 'Task' | 'Rent';
  destination?: { tab: 'Leases' | 'Maintenance'; screen: 'LeaseDetail' | 'LandlordMaintenanceDetail'; params: object };
};

type CalendarTask = { id?: number | string; Id?: number | string; title?: string; Title?: string; dueDate?: string; DueDate?: string; status?: number | string; Status?: number | string; propertyName?: string; PropertyName?: string };

// Date-only values are calendar days, not UTC instants. Parsing them in local time
// prevents an ISO midnight from appearing on the previous day in US time zones.
export function calendarDate(raw: unknown, dateOnly = false): Date | null {
  if (typeof raw !== 'string' || !raw) return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(raw);
  if (day && (dateOnly || !raw.includes('T') || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.\d+)?$/.test(raw))) {
    const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return date.getFullYear() === Number(day[1]) && date.getMonth() === Number(day[2]) - 1 && date.getDate() === Number(day[3]) ? date : null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const field = (value: any, name: string) => value?.[name] ?? value?.[name[0].toUpperCase() + name.slice(1)];
const validId = (value: unknown) => value != null && String(value).trim() !== '' && String(value) !== '0';

export function buildCalendarEvents(leases: Lease[], requests: MaintenanceRequest[], tasks: CalendarTask[], displayedMonth?: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const lease of leases) {
    if (lease.archived || field(lease, 'isDeleted') || field(lease, 'isDrafted') || field(field(lease, 'leaseAgreement'), 'isDrafted') || String(field(lease, 'status') ?? '').toLowerCase() === 'draft') continue;
    const id = field(lease, 'id');
    const property = field(lease, 'propertyName') || 'Property';
    const unit = field(lease, 'unitName');
    for (const [key, label] of [['startDate', 'Move-in'], ['endDate', 'Move-out']] as const) {
      const date = calendarDate(field(lease, key), true);
      if (!date) continue;
      events.push({ id: `lease-${id ?? property}-${key}-${dayKey(date)}`, date, title: `${label} · ${property}`, detail: [unit, 'Lease'].filter(Boolean).join(' · '), category: 'Lease',
        destination: validId(id) ? { tab: 'Leases', screen: 'LeaseDetail', params: { leaseId: String(id), archived: false } } : undefined });
    }
    // Due dates are schedule markers, not payment status. Clamp the 29th–31st
    // to the last day of shorter months instead of rolling into the next month.
    if (displayedMonth && [true, 1].includes(field(lease, 'isActive'))) {
      const dueDay = Number(field(lease, 'rentDueDay') ?? 1);
      if (Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31) {
        const year = displayedMonth.getFullYear();
        const month = displayedMonth.getMonth();
        const date = new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()));
        const start = calendarDate(field(lease, 'startDate'), true);
        const end = calendarDate(field(lease, 'endDate'), true);
        if (start && dayKey(date) >= dayKey(start) && (!end || dayKey(date) <= dayKey(end))) {
          events.push({ id: `rent-${id ?? property}-${dayKey(date)}`, date, title: `Rent due · ${property}`, detail: [unit, 'Scheduled due date · payment status not shown'].filter(Boolean).join(' · '), category: 'Rent',
            destination: validId(id) ? { tab: 'Leases', screen: 'LeaseDetail', params: { leaseId: String(id), archived: false } } : undefined });
        }
      }
    }
  }
  for (const request of requests) {
    const id = field(request, 'id');
    const appointments = field(request, 'appointments');
    if (Array.isArray(appointments) && appointments.length) {
      for (const appointment of appointments) {
        const status = String(field(appointment, 'status') ?? '').toLowerCase();
        if (status === 'cancelled' || status === 'canceled') continue;
        const date = calendarDate(field(appointment, 'startsAtUtc'));
        if (date) events.push({ id: `appointment-${id}-${field(appointment, 'id') ?? dayKey(date)}`, date, title: field(request, 'title') || 'Maintenance appointment', detail: 'Maintenance appointment', category: 'Maintenance',
          destination: validId(id) ? { tab: 'Maintenance', screen: 'LandlordMaintenanceDetail', params: { requestId: String(id) } } : undefined });
      }
    } else {
      const date = calendarDate(field(request, 'scheduledDate'));
      if (date) events.push({ id: `maintenance-${id ?? dayKey(date)}`, date, title: field(request, 'title') || 'Scheduled maintenance', detail: 'Scheduled maintenance', category: 'Maintenance',
        destination: validId(id) ? { tab: 'Maintenance', screen: 'LandlordMaintenanceDetail', params: { requestId: String(id) } } : undefined });
    }
  }
  for (const task of tasks) {
    const status = String(field(task, 'status') ?? '').toLowerCase();
    if (status === '2' || status === 'cancelled' || status === 'canceled') continue;
    const date = calendarDate(field(task, 'dueDate'));
    if (date) events.push({ id: `task-${field(task, 'id') ?? dayKey(date)}`, date, title: field(task, 'title') || 'Task', detail: [field(task, 'propertyName'), status === '1' || status === 'done' ? 'Completed' : 'Task'].filter(Boolean).join(' · '), category: 'Task' });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
}
