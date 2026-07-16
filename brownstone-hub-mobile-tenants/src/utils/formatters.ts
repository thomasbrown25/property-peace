import moment from 'moment';

/**
 * Formats a number as currency
 * @param amount - The amount to format
 * @param currency - The currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  } catch (error) {
    // Fallback to USD if currency is invalid
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
};

/**
 * Formats a date string or Date object as a readable date
 * @param date - Date string or Date object
 * @returns Formatted date string (e.g., "January 15, 2024")
 */
export const formatDate = (date: string | Date): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Formats a date as relative time (e.g., "2 days ago", "just now")
 * @param date - Date string or Date object
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (date: string | Date): string => {
  if (!date) return '';

  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else {
    // Handle UTC dates - if no timezone info, append 'Z'
    let dateStr = String(date).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
      dateStr += 'Z';
    }
    dateObj = new Date(dateStr);
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  // Handle future dates
  if (diffInSeconds < 0) {
    if (Math.abs(diffInSeconds) < 60) {
      return 'just now';
    }
    return formatDate(dateObj);
  }

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  return formatDate(dateObj);
};

/**
 * Calculates the next payment date for a lease, taking into account the lease start date.
 * The first payment is always on the lease start date. Subsequent payments are on the rent due day.
 * If the lease hasn't started yet, returns the lease start date.
 * 
 * @param leaseStartDate - The lease start date (also the first payment date)
 * @param rentDueDay - The day of the month rent is due for subsequent payments (1-31)
 * @param leaseEndDate - Optional lease end date to cap the calculation
 * @returns The next payment date, or null if invalid input
 */
export const calculateNextPaymentDate = (
  leaseStartDate: string | Date,
  rentDueDay: number,
  leaseEndDate?: string | Date | null
): Date | null => {
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
  if (nextDue.isBefore(startDate, 'day')) {
    nextDue = firstPaymentDate;
  }

  // Ensure we don't go past the lease end date
  if (endDate && nextDue.isAfter(endDate, 'day')) {
    return null;
  }

  return nextDue.toDate();
};
