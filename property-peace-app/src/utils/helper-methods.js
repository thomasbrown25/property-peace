import { differenceInCalendarDays, isBefore, parseISO } from 'date-fns';
import moment from 'moment';

export const addMonths = (date, monthsToAdd) => {
  let newDate = new Date(date); // Create a new Date object to avoid modifying the original
  newDate.setMonth(newDate.getMonth() + monthsToAdd);
  newDate = newDate.toISOString().split('T')[0];
  return newDate;
};

export const getEndDate = (startDate, leaseLengthOptions, value) => {
  const selectedOption = leaseLengthOptions.find((option) => option.value === Number(value));
  startDate = new Date(startDate);
  const endDate = addMonths(startDate, selectedOption.value);
  return endDate;
};

export const diffInMonths = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  // If the end day is before the start day, count the last month as incomplete
  if (e.getDate() < s.getDate()) months -= 1;
  return Math.max(0, months);
};

export const calculateOccupancyPercentage = (units) => {
  if (!Array.isArray(units) || units.length === 0) return 0;

  const occupiedCount = units.filter((unit) => unit.isOccupied).length;
  const percentage = (occupiedCount / units.length) * 100;

  return Math.round(percentage);
};

export const isOccupied = (units) => {
  if (!Array.isArray(units) || units.length === 0) return false;

  return units.some((unit) => unit.isOccupied);
};

export const valueToCommaDelimitedString = (values) => {
  return values.map((v) => v.label).join(', ');
};

// export const getPropertyRoutes = (propertyId) => {
//   return propertyRoutes.map((route) => ({
//     ...route,
//     href: route.href.replace(':propertyId', propertyId),
//   }));
// };

export const getNextDueDate = (startDate, frequency, rentDueDay) => {
  if (!startDate || !frequency) return null;

  const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  const today = new Date();

  const dueDay = rentDueDay || start.getDate();
  const incrementMonths = { monthly: 1, quarterly: 3, yearly: 12 }[frequency.toLowerCase()];
  if (!incrementMonths) return null;

  let currentDue = new Date(start);
  currentDue.setDate(dueDay);

  while (currentDue <= today) {
    currentDue = new Date(addMonths(currentDue, incrementMonths));
    currentDue.setDate(dueDay);
  }

  return `${currentDue.getFullYear()}-${String(currentDue.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(currentDue.getDate()).padStart(2, '0')}`;
};

export const getRentStatus = (nextDueDate) => {
  if (!nextDueDate) return 'No due date';

  const dueDate = new Date(nextDueDate);
  const today = new Date();

  const daysDifference = differenceInCalendarDays(dueDate, today);

  if (daysDifference === 0) return 'Due today';
  if (daysDifference > 0) return `Due in ${daysDifference} day${daysDifference > 1 ? 's' : ''}`;
  return `Overdue by ${Math.abs(daysDifference)} day${Math.abs(daysDifference) > 1 ? 's' : ''}`;
};

/**
 * Calculates the next payment date for a lease, taking into account the lease start date.
 * The first payment is always on the lease start date. Subsequent payments are on the rent due day.
 * If the lease hasn't started yet, returns the lease start date.
 * 
 * @param {string|Date} leaseStartDate - The lease start date (also the first payment date)
 * @param {number} rentDueDay - The day of the month rent is due for subsequent payments (1-31)
 * @param {string|Date} [leaseEndDate] - Optional lease end date to cap the calculation
 * @returns {Date|null} The next payment date, or null if invalid input
 */
export const calculateNextPaymentDate = (leaseStartDate, rentDueDay, leaseEndDate = null) => {
  if (!leaseStartDate || !rentDueDay) return null;

  const today = moment();
  const startDate = moment(leaseStartDate);
  const endDate = leaseEndDate ? moment(leaseEndDate) : null;
  const dueDay = rentDueDay || 1;

  // First payment is always on the lease start date
  const firstPaymentDate = startDate;

  // If lease hasn't started yet, return the lease start date (first payment)
  if (today.isBefore(startDate, 'day')) {
    return endDate && firstPaymentDate.isAfter(endDate, 'day') ? null : firstPaymentDate.toDate();
  }

  // If today is on or before the start date, return the start date (first payment)
  if (today.isSameOrBefore(startDate, 'day')) {
    return firstPaymentDate.toDate();
  }

  // After the first payment (start date), subsequent payments are on the rent due day
  // Calculate next due date from today using the rent due day
  let nextDue = moment().date(dueDay);

  // If the due day has passed this month, move to next month
  if (nextDue.isBefore(today, 'day')) {
    nextDue = nextDue.add(1, 'month');
  }

  // Ensure the next payment date is not before the start date
  // If the calculated date is before the start date, return the start date (first payment)
  if (nextDue.isBefore(startDate, 'day')) {
    return firstPaymentDate.toDate();
  }

  // If there's an end date and the calculated date is after it, return null
  if (endDate && nextDue.isAfter(endDate, 'day')) {
    return null;
  }

  return nextDue.toDate();
};

export function calculateMonthlyIncome(units) {
  if (!Array.isArray(units)) return 0;

  return units.reduce((total, unit) => {
    if (unit?.lease?.isActive && unit?.lease?.rentAmount) {
      return total + Number(unit.lease.rentAmount);
    }
    return total;
  }, 0);
}

export const getPropertyNameById = (properties, propertyId) => {
  const property = properties.find((property) => property.id === propertyId);
  return property ? property.name : '';
};

export const getUnitNameById = (units, unitId) => {
  const unit = units.find((unit) => unit.id === unitId);
  return unit ? unit.name : '';
};

export const getStatusColor = (s) => {
  const status = typeof s === 'string' ? s.toLowerCase() : s;
  switch (status) {
    case 'open':
      return 'primary';
    case 'inprogress':
    case 'in-progress':
      return 'warning';
    case 'pending':
    case 'onhold':
    case 'on-hold':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'default';
    default:
      return 'default';
  }
};

// priority color
export const getPriorityColor = (p) => {
  const priority = typeof p === 'string' ? p.toLowerCase() : p;
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};
