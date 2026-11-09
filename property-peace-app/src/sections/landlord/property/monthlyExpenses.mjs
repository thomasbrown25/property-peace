// Business dates are calendar dates, not UTC instants.
const calendarDate = value => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

// Full-month expected cost: recorded expenses plus scheduled costs not yet generated.
// LastGeneratedDate prevents counting an occurrence again after it becomes a real expense.
export function getMonthlyExpenses({ expenses = [], recurringExpenses = [], futureExpenses = [], propertyId, now = new Date() }) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const inMonth = date => date && date.getFullYear() === year && date.getMonth() === month;
  const scoped = record => String(record.propertyId ?? record.PropertyId) === String(propertyId);
  const amount = record => Number(record.amount ?? record.Amount) || 0;
  const field = (record, key) => record[key] ?? record[key[0].toUpperCase() + key.slice(1)];
  let total = expenses.filter(scoped).reduce((sum, record) =>
    // Recurring template rows are schedules, not an additional transaction.
    sum + (!field(record, 'isRecurring') && inMonth(calendarDate(field(record, 'dueDate') || field(record, 'expenseDate'))) ? amount(record) : 0), 0);
  total += futureExpenses.filter(scoped).reduce((sum, record) =>
    sum + (inMonth(calendarDate(field(record, 'dueDate'))) ? amount(record) : 0), 0);

  const schedules = [
    ...recurringExpenses.filter(scoped),
    ...expenses.filter(record => scoped(record) && field(record, 'isRecurring'))
  ];
  for (const record of schedules) {
    if (field(record, 'isPaused')) continue;
    const start = calendarDate(field(record, 'startDate'));
    const end = calendarDate(field(record, 'endDate'));
    if (!start) continue;
    const frequency = String(field(record, 'frequency')).toLowerCase();
    const interval = { monthly: 1, quarterly: 3, yearly: 12, 0: 1, 1: 3, 2: 12 }[frequency];
    if (!interval) continue;
    const day = Number(field(record, 'dayOfPeriod'));
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    const monthsSinceStart = (year - start.getFullYear()) * 12 + month - start.getMonth();
    let occurrence;
    if (monthsSinceStart === 0) {
      occurrence = start;
    } else if (monthsSinceStart > 0) {
      // The API aligns quarterly recurrences to Jan/Apr/Jul/Oct.
      const due = interval === 3 ? month % 3 === 0 : monthsSinceStart % interval === 0;
      if (due) occurrence = new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
    }
    const scheduledNext = calendarDate(field(record, 'nextOccurrenceDate'));
    if (scheduledNext) occurrence = scheduledNext;
    const generated = calendarDate(field(record, 'lastGeneratedDate'));
    if (inMonth(occurrence) && (!end || occurrence <= end) && (!generated || occurrence > generated)) total += amount(record);
  }
  return total;
}
