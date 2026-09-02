import { addDays, endOfDay, isSameDay, startOfDay } from 'date-fns';

const valueOf = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

export const taskStatusKey = (task) => {
  const value = valueOf(task, 'status', 'Status');
  if (value === 1 || String(value).toLowerCase() === 'done') return 'done';
  if (value === 2 || String(value).toLowerCase() === 'cancelled' || String(value).toLowerCase() === 'canceled') return 'cancelled';
  return 'open';
};

export const taskCategoryKey = (task) => {
  const value = valueOf(task, 'category', 'Category');
  if (value === 1 || String(value).toLowerCase() === 'rentpayment') return 'rent';
  if (value === 2 || String(value).toLowerCase() === 'maintenance') return 'maintenance';
  if (value === 3 || String(value).toLowerCase() === 'lease') return 'lease';
  return 'task';
};

export function buildTaskUpdatePayload(task, overrides = {}) {
  return {
    id: valueOf(task, 'id', 'Id'),
    title: valueOf(task, 'title', 'Title') || '',
    dueDate: valueOf(task, 'dueDate', 'DueDate'),
    category: Number(valueOf(task, 'category', 'Category') ?? 0),
    status: Number(overrides.status ?? valueOf(task, 'status', 'Status') ?? 0),
    propertyId: valueOf(task, 'propertyId', 'PropertyId') || null,
    isRecurring: Boolean(valueOf(task, 'isRecurring', 'IsRecurring')),
    recurrenceType: Number(valueOf(task, 'recurrenceType', 'RecurrenceType') ?? 0),
    recurrenceInterval: Number(valueOf(task, 'recurrenceInterval', 'RecurrenceInterval') || 1),
    recurrenceEndDate: valueOf(task, 'recurrenceEndDate', 'RecurrenceEndDate') || null,
    ...overrides
  };
}

export function summarizeTasks(tasks = [], now = new Date()) {
  return tasks.reduce(
    (summary, task) => {
      const status = taskStatusKey(task);
      const dueDateValue = valueOf(task, 'dueDate', 'DueDate');
      const dueDate = dueDateValue ? new Date(dueDateValue) : null;

      if (status === 'open') summary.open += 1;
      else summary.resolved += 1;
      if (status === 'open' && dueDate && !Number.isNaN(dueDate.getTime()) && isSameDay(dueDate, now)) summary.today += 1;
      if (Boolean(valueOf(task, 'isRecurring', 'IsRecurring'))) summary.recurring += 1;
      return summary;
    },
    { open: 0, resolved: 0, today: 0, recurring: 0 }
  );
}

export function filterAndSortTasks(tasks = [], filters = {}, now = new Date()) {
  const today = startOfDay(now);
  const search = String(filters.search || '')
    .trim()
    .toLowerCase();
  const filteredTasks = tasks.filter((task) => {
    const status = taskStatusKey(task);
    const rawDueDate = valueOf(task, 'dueDate', 'DueDate');
    const dueDate = rawDueDate ? new Date(rawDueDate) : null;
    const hasValidDueDate = dueDate && !Number.isNaN(dueDate.getTime());
    const recurring = Boolean(valueOf(task, 'isRecurring', 'IsRecurring'));
    const searchableText = [valueOf(task, 'title', 'Title'), valueOf(task, 'propertyName', 'PropertyName')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (search && !searchableText.includes(search)) return false;
    if (filters.status && filters.status !== 'all' && status !== filters.status) return false;
    if (filters.propertyId && String(valueOf(task, 'propertyId', 'PropertyId')) !== String(filters.propertyId)) return false;
    if (filters.frequency === 'recurring' && !recurring) return false;
    if (filters.frequency === 'one-time' && recurring) return false;
    if (filters.date === 'today' && (!hasValidDueDate || !isSameDay(dueDate, now))) return false;
    if (filters.date === 'overdue' && (!hasValidDueDate || status !== 'open' || dueDate >= today)) return false;
    if (filters.date === 'next-7-days' && (!hasValidDueDate || dueDate < today || dueDate > endOfDay(addDays(today, 7)))) return false;
    return true;
  });

  const rank = (task) => {
    const status = taskStatusKey(task);
    if (status === 'done') return 3;
    if (status === 'cancelled') return 4;

    const rawDueDate = valueOf(task, 'dueDate', 'DueDate');
    const dueDate = rawDueDate ? new Date(rawDueDate) : null;
    if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < today) return 0;
    if (dueDate && !Number.isNaN(dueDate.getTime()) && isSameDay(dueDate, now)) return 1;
    return 2;
  };

  return [...filteredTasks].sort((left, right) => {
    const rankDifference = rank(left) - rank(right);
    if (rankDifference !== 0) return rankDifference;
    const leftDueDate = new Date(valueOf(left, 'dueDate', 'DueDate') || Number.MAX_SAFE_INTEGER).getTime();
    const rightDueDate = new Date(valueOf(right, 'dueDate', 'DueDate') || Number.MAX_SAFE_INTEGER).getTime();
    return leftDueDate - rightDueDate;
  });
}

const recurringExpenseIntervalMonths = (frequency) => {
  const normalized = String(frequency ?? '').toLowerCase();
  if (frequency === 0 || normalized === 'monthly') return 1;
  if (frequency === 1 || normalized === 'quarterly') return 3;
  if (frequency === 2 || normalized === 'yearly') return 12;
  return null;
};

const parseCalendarDate = (value) => {
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

const occurrenceInMonth = (startDate, monthOffset, dayOfPeriod) => {
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + monthOffset;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(
    year,
    month,
    Math.min(Math.max(Number(dayOfPeriod) || startDate.getDate(), 1), lastDay),
    startDate.getHours(),
    startDate.getMinutes(),
    startDate.getSeconds(),
    startDate.getMilliseconds()
  );
};

export function buildRecurringExpenseTaskEvents(recurringExpenses = [], viewStart, viewEnd, now = new Date()) {
  if (!(viewStart instanceof Date) || !(viewEnd instanceof Date)) return [];

  const today = startOfDay(now);
  const events = [];

  recurringExpenses.forEach((expense) => {
    if (Boolean(valueOf(expense, 'isPaused', 'IsPaused'))) return;

    const intervalMonths = recurringExpenseIntervalMonths(valueOf(expense, 'frequency', 'Frequency'));
    const rawStartDate = valueOf(expense, 'startDate', 'StartDate');
    const startDate = rawStartDate ? parseCalendarDate(rawStartDate) : null;
    if (!intervalMonths || !startDate || Number.isNaN(startDate.getTime())) return;

    const rawEndDate = valueOf(expense, 'endDate', 'EndDate');
    const configuredEnd = rawEndDate ? endOfDay(parseCalendarDate(rawEndDate)) : null;
    const effectiveEnd = configuredEnd && !Number.isNaN(configuredEnd.getTime()) && configuredEnd < viewEnd ? configuredEnd : viewEnd;
    const dayOfPeriod = valueOf(expense, 'dayOfPeriod', 'DayOfPeriod');
    const expenseId = valueOf(expense, 'id', 'Id');
    const name = valueOf(expense, 'name', 'Name') || 'Recurring expense';

    for (let monthOffset = 0, safety = 0; safety < 500; monthOffset += intervalMonths, safety += 1) {
      const occurrence = occurrenceInMonth(startDate, monthOffset, dayOfPeriod);
      if (occurrence > effectiveEnd) break;
      if (occurrence < startDate || occurrence < viewStart) continue;

      events.push({
        id: `recurring-expense-${expenseId}-${occurrence.getFullYear()}-${occurrence.getMonth() + 1}-${occurrence.getDate()}`,
        title: `Pay · ${name}`,
        date: occurrence,
        category: 'Task',
        source: 'recurring-expense',
        recurringExpenseId: expenseId,
        recurringExpense: expense,
        propertyId: valueOf(expense, 'propertyId', 'PropertyId') || null,
        propertyName: valueOf(expense, 'propertyName', 'PropertyName') || null,
        unitId: valueOf(expense, 'unitId', 'UnitId') || null,
        unitName: valueOf(expense, 'unitName', 'UnitName') || null,
        amount: valueOf(expense, 'amount', 'Amount'),
        status: occurrence < today ? 'Overdue' : 'Upcoming'
      });
    }
  });

  return events.sort((left, right) => left.date - right.date);
}

export function buildTodayReminders({ tasks = [], dashboardSummary = {}, properties = [] } = {}, now = new Date()) {
  const reminders = [];

  tasks.forEach((task) => {
    const rawDueDate = valueOf(task, 'dueDate', 'DueDate');
    const dueDate = rawDueDate ? new Date(rawDueDate) : null;
    if (taskStatusKey(task) !== 'open' || !dueDate || Number.isNaN(dueDate.getTime()) || !isSameDay(dueDate, now)) return;
    reminders.push({
      id: `task-${valueOf(task, 'id', 'Id')}`,
      type: 'task',
      title: valueOf(task, 'title', 'Title') || 'Task',
      date: dueDate
    });
  });

  const maintenanceRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
  maintenanceRequests.forEach((request) => {
    const rawScheduledDate = valueOf(request, 'scheduledDate', 'ScheduledDate');
    const scheduledDate = rawScheduledDate ? new Date(rawScheduledDate) : null;
    const status = String(valueOf(request, 'status', 'Status') || '').toLowerCase();
    if (
      !scheduledDate ||
      Number.isNaN(scheduledDate.getTime()) ||
      !isSameDay(scheduledDate, now) ||
      ['completed', 'done', 'cancelled', 'canceled'].includes(status)
    ) {
      return;
    }
    reminders.push({
      id: `maintenance-${valueOf(request, 'id', 'Id')}`,
      type: 'maintenance',
      title: valueOf(request, 'title', 'Title') || 'Scheduled maintenance',
      date: scheduledDate
    });
  });

  properties.forEach((property) => {
    const propertyName = valueOf(property, 'name', 'Name') || valueOf(property, 'streetAddress', 'StreetAddress') || 'Property';
    (property.units || property.Units || []).forEach((unit) => {
      if (String(valueOf(unit, 'status', 'Status') || '').toLowerCase() === 'draft') return;
      const lease = unit.lease || unit.Lease;
      if (!lease || String(valueOf(lease, 'status', 'Status') || '').toLowerCase() === 'draft') return;

      const leaseId = valueOf(lease, 'id', 'Id');
      const active = valueOf(lease, 'isActive', 'IsActive');
      const rawStartDate = valueOf(lease, 'startDate', 'StartDate');
      const rawEndDate = valueOf(lease, 'endDate', 'EndDate');
      const startDate = rawStartDate ? new Date(rawStartDate) : null;
      const endDate = rawEndDate ? new Date(rawEndDate) : null;
      const unitName = valueOf(unit, 'name', 'Name') || propertyName;

      if (startDate && !Number.isNaN(startDate.getTime()) && isSameDay(startDate, now)) {
        reminders.push({ id: `lease-start-${leaseId}`, type: 'lease', title: `Lease start · ${unitName}`, date: startDate });
      }
      if (endDate && !Number.isNaN(endDate.getTime()) && isSameDay(endDate, now)) {
        reminders.push({ id: `lease-end-${leaseId}`, type: 'lease', title: `Move-out · ${unitName}`, date: endDate });
      }

      const rentDueDay = Number(valueOf(lease, 'rentDueDay', 'RentDueDay') || 1);
      const leaseHasStarted = !startDate || Number.isNaN(startDate.getTime()) || startDate <= endOfDay(now);
      const leaseHasNotEnded = !endDate || Number.isNaN(endDate.getTime()) || endDate >= startOfDay(now);
      if (active && leaseHasStarted && leaseHasNotEnded && now.getDate() === rentDueDay) {
        reminders.push({
          id: `rent-${leaseId}-${now.getFullYear()}-${now.getMonth() + 1}`,
          type: 'rent',
          title: `Rent due · ${propertyName}`,
          date: startOfDay(now)
        });
      }
    });
  });

  return reminders.sort((left, right) => left.date - right.date);
}
