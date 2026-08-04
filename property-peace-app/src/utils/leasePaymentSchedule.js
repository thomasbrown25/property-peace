const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const parseDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')
].join('-');

const roundCurrency = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

const dueDateInMonth = (year, month, dueDayValue) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const requestedDay = Number(dueDayValue);
  const dueDay = requestedDay === -1 ? lastDay : Math.min(Math.max(requestedDay || 1, 1), lastDay);
  return new Date(year, month, dueDay);
};

const calculateProratedAmount = (startDate, nextDueDate, monthlyRent) => {
  let amount = 0;
  const cursor = new Date(startDate);
  while (cursor < nextDueDate) {
    amount += monthlyRent / new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    cursor.setDate(cursor.getDate() + 1);
  }
  return roundCurrency(amount);
};

export const buildLeasePaymentSchedule = (lease = {}) => {
  const startDate = parseDateOnly(firstDefined(lease.startDate, lease.StartDate));
  const endDate = parseDateOnly(firstDefined(lease.endDate, lease.EndDate));
  const monthlyRent = Number(firstDefined(lease.rentAmount, lease.RentAmount));
  const rentDueDay = Number(firstDefined(lease.rentDueDay, lease.RentDueDay, 1));

  if (!startDate || !endDate || endDate < startDate || !Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return { cycles: [], totalContractValue: 0 };
  }

  let firstRegularDueDate = dueDateInMonth(startDate.getFullYear(), startDate.getMonth(), rentDueDay);
  if (firstRegularDueDate < startDate) {
    firstRegularDueDate = dueDateInMonth(startDate.getFullYear(), startDate.getMonth() + 1, rentDueDay);
  }

  const prorationEnabled = Boolean(firstDefined(
    lease.proratedRentDue,
    lease.ProratedRentDue,
    lease.isProratedRent,
    lease.IsProratedRent,
    false
  ));
  const persistedProratedAmount = Number(firstDefined(lease.proratedRentAmount, lease.ProratedRentAmount));
  const cycles = [];

  if (prorationEnabled && firstRegularDueDate > startDate) {
    const amount = Number.isFinite(persistedProratedAmount) && persistedProratedAmount > 0
      ? roundCurrency(persistedProratedAmount)
      : calculateProratedAmount(startDate, firstRegularDueDate, monthlyRent);

    if (amount > 0) {
      const dueDate = toDateKey(startDate);
      cycles.push({
        key: `move-in-${dueDate}`,
        label: MONTH_LABELS[startDate.getMonth()],
        dueDate,
        amount,
        isProrated: true
      });
    }
  }

  let cursor = firstRegularDueDate;
  while (cursor <= endDate) {
    const dueDate = toDateKey(cursor);
    cycles.push({
      key: `rent-${dueDate}`,
      label: MONTH_LABELS[cursor.getMonth()],
      dueDate,
      amount: roundCurrency(monthlyRent),
      isProrated: false
    });
    cursor = dueDateInMonth(cursor.getFullYear(), cursor.getMonth() + 1, rentDueDay);
  }

  return {
    cycles,
    totalContractValue: roundCurrency(cycles.reduce((total, cycle) => total + cycle.amount, 0))
  };
};
