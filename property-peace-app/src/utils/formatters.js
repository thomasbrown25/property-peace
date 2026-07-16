import moment from 'moment';
import { maintenancePriorityOptions, maintenanceStatusOptions, propertyTypeOptions } from './models';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const formatPhone = (raw) => {
  // Handle null, undefined, or empty values
  if (!raw || raw === '') return '';
  const phoneNumber = parsePhoneNumberFromString(raw, 'US');
  return phoneNumber ? phoneNumber.formatNational() : raw;
};

/**
 * Formats phone number as user types
 * 10 digits: (555) 555-5555
 * 11 digits: +1 (555) 555-5555
 * @param {string} value - The input value
 * @returns {string} - Formatted phone number
 */
export const formatPhoneInput = (value) => {
  // Handle null, undefined, or empty values
  if (!value || value === '') return '';
  
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  // Limit to 11 digits
  const limited = numbers.slice(0, 11);
  
  // Format based on length
  if (limited.length === 0) return '';
  
  if (limited.length <= 3) {
    return limited;
  }
  
  if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  }
  
  if (limited.length <= 10) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
  
  // 11 digits - add country code
  return `+${limited.slice(0, 1)} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 11)}`;
};

/**
 * Extracts only numbers from phone input
 * @param {string} value - The formatted phone number
 * @returns {string} - Just the numbers
 */
export const cleanPhoneInput = (value) => {
  // Handle null, undefined, or empty values
  if (!value || value === '') return '';
  return value.replace(/\D/g, '');
};

export const parseCurrencyToDecimal = (currencyStr) => {
  if (typeof currencyStr !== 'string') return currencyStr;

  // Remove $ and commas, then convert to float
  const numericStr = currencyStr.replace(/[$,]/g, '');
  const parsed = parseFloat(numericStr);

  return isNaN(parsed) ? 0 : parsed;
};
export const parseDecimalToCurrency = (amount, cents = false) => {
  if (typeof amount !== 'number') return '';
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0
  });
};

/**
 * Gets today's date in local timezone as YYYY-MM-DD string
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const getTodayLocalDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a Date object as local datetime string (YYYY-MM-DDTHH:mm:ss)
 * @param {Date} date - The Date object to format
 * @returns {string} - Date string in YYYY-MM-DDTHH:mm:ss format
 */
export const formatLocalDateTime = (date) => {
  if (!date || !(date instanceof Date)) {
    throw new Error('formatLocalDateTime expects a Date object');
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  // Check if date is valid (not Invalid Date and not epoch date)
  if (isNaN(date.getTime()) || date.getTime() === 0) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDate2 = (dateString) => {
  if (!dateString) return '';
  // Ensure UTC dates are properly handled and converted to local time
  let dateStr = String(dateString).trim();
  // If it's an ISO string without timezone info, append 'Z' to indicate UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
    dateStr += 'Z';
  }
  // Parse as UTC and convert to local time for display
  return moment.utc(dateStr).local().format('M/D/YYYY');
};

export const formatDateAndTime = (dateString) => {
  if (!dateString) return '';
  // Ensure UTC dates are properly handled - backend sends dates in UTC
  let dateStr = String(dateString).trim();
  // If it's an ISO string without timezone info, append 'Z' to indicate UTC
  // Format: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sss
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
    dateStr += 'Z';
  }
  // Parse as UTC and convert to local time for display
  return moment.utc(dateStr).local().format('M/D/YYYY h:mm A');
};

/**
 * Formats a date as relative time (e.g., "5 seconds ago", "2 minutes ago", "3 hours ago", "2 days ago")
 * All times are displayed in local time zone.
 * @param {string|Date} dateString - The date to format (backend sends UTC dates)
 * @returns {string} - Relative time string
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) {
    return '';
  }

  // Parse the date - handle both ISO strings and Date objects
  let date;
  if (dateString instanceof Date) {
    date = dateString;
  } else {
    // Backend sends dates in UTC. If the string doesn't have timezone info (no 'Z' or offset),
    // we need to treat it as UTC. JavaScript's Date constructor will parse ISO strings without
    // timezone as local time, which is incorrect for our use case.
    let dateStr = String(dateString).trim();
    
    // If it's an ISO string without timezone info, append 'Z' to indicate UTC
    // Format: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sss
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
      dateStr += 'Z';
    }
    
    date = new Date(dateStr);
  }
  
  const now = new Date();
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('[formatRelativeTime] Invalid date string:', dateString);
    return '';
  }
  
  // Calculate difference in seconds (both dates are in the same timezone context)
  // Date objects store time as UTC milliseconds internally, so subtraction works correctly
  const diffInSeconds = Math.floor((now - date) / 1000);

  // Handle future dates - if less than 1 minute in the future, treat as "just now"
  // This handles minor clock skew between client and server
  if (diffInSeconds < 0) {
    if (Math.abs(diffInSeconds) < 60) {
      return 'just now';
    }
    return 'just now';
  }

  // Less than 60 seconds - show seconds for anything > 1 second
  if (diffInSeconds < 60) {
    if (diffInSeconds <= 1) {
      return 'just now';
    }
    return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'} ago`;
  }

  // Less than 60 minutes
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than 24 hours
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  // Less than 30 days
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  // More than 30 days - show actual date in local time
  // Use moment to format the date in local time directly
  return moment(date).format('M/D/YYYY');
};

export const formatCurrency = (amount, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  } catch (error) {
    // Fallback to USD if currency is invalid
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
};

export const formatRentStatus = (status) => {
  switch (status) {
    case 'upcomingDue':
      return 'Upcoming Due';
    case 'upToDate':
      return 'Up to Date';
    case 'overdue':
      return 'Overdue';
    case 'archived':
      return 'Archived';
    case 'notStarted':
      return 'Not Started';
    case 'draft':
    case 'Draft':
      return 'Draft';
    default:
      return status || 'default';
  }
};

export const getRentStatusColor = (status) => {
  switch (status) {
    case 'upcomingDue':
      return 'warning';
    case 'upToDate':
      return 'success';
    case 'overdue':
      return 'error';
    case 'notStarted':
      return 'warning';
    case 'archived':
      return 'default';
    case 'draft':
    case 'Draft':
      return 'default';
    default:
      return 'default';
  }
};

export const getPropertyTypeLabel = (type) => {
  if (!type) return '';
  
  // Normalize property type to handle different formats
  const normalizedType = type.toLowerCase();
  
  // Find exact match first
  let propertyType = propertyTypeOptions.find((option) => option.value === type);
  
  // If no exact match, try case-insensitive match
  if (!propertyType) {
    propertyType = propertyTypeOptions.find((option) => option.value.toLowerCase() === normalizedType);
  }
  
  // If still no match, try mapping common variations
  if (!propertyType) {
    if (normalizedType === 'multiunit' || normalizedType === 'multi-unit') {
      propertyType = propertyTypeOptions.find((option) => option.value === 'multiUnit');
    } else if (normalizedType === 'singlefamily' || normalizedType === 'single-family') {
      propertyType = propertyTypeOptions.find((option) => option.value === 'singleFamily');
    }
  }
  
  return propertyType?.label || type;
};

export const getMaintenancePriorityLabel = (priority) => {
  const priorityOption = maintenancePriorityOptions.find((option) => option.value === priority);
  return priorityOption ? priorityOption.label : 'Unknown';
};

export const getMaintenancePriorityColorKey = (priority) => {
  const colorKey = maintenancePriorityOptions.find((option) => option.value === priority);
  return colorKey ? colorKey.colorKey : 'default';
};

export const getMaintenanceStatusLabel = (status) => {
  const statusOption = maintenanceStatusOptions.find((option) => option.value === status);
  return statusOption ? statusOption.label : 'Unknown';
};

export const buildImageFromURL = (serverImage) => {
  return {
    id: serverImage.id, // DB id
    url: serverImage.blobUrl, // blob storage url
    file: null,
    preview: serverImage.blobUrl,
    source: 'existing',
    deleted: false,
    sortOrder: serverImage.sortOrder ?? 0
  };
};

export const buildImageFromFile = (file) => {
  const objUrl = URL.createObjectURL(file);
  return {
    id: String(Date.now()), // Generate a unique ID
    file: file,
    url: objUrl,
    preview: objUrl,
    source: 'new',
    deleted: false,
    sortOrder: 0
  };
};

/**
 * Formats message timestamp with specific rules:
 * - Less than an hour: "X minutes ago"
 * - Past an hour but same day: "Today 5:03 PM"
 * - Past a day but less than 2 days: "Yesterday 5:03 PM"
 * - More than a day but less than a week: "Tuesday 1:50 PM"
 * - More than a week: "1/8/2025 4:50 PM"
 * @param {string|Date} dateString - The date to format (backend sends UTC dates)
 * @returns {string} - Formatted time string
 */
export const formatMessageTime = (dateString) => {
  if (!dateString) {
    return '';
  }

  // Parse the date - handle both ISO strings and Date objects
  let date;
  if (dateString instanceof Date) {
    date = dateString;
  } else {
    // Backend sends dates in UTC. If the string doesn't have timezone info (no 'Z' or offset),
    // we need to treat it as UTC.
    let dateStr = String(dateString).trim();
    
    // If it's an ISO string without timezone info, append 'Z' to indicate UTC
    // Format: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sss
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
      dateStr += 'Z';
    }
    
    date = new Date(dateStr);
  }
  
  const now = new Date();
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('[formatMessageTime] Invalid date string:', dateString);
    return '';
  }
  
  // Calculate difference in milliseconds
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Format time portion (e.g., "5:03 PM") - date is already in local time
  const formatTime = (d) => {
    // d is already a Date object in local time, so toLocaleTimeString will show local time
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Check if same day
  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };
  
  // Check if yesterday
  const isYesterday = (d) => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(d, yesterday);
  };
  
  // Less than an hour - show "X minutes ago"
  if (diffMins < 60) {
    if (diffMins < 1) {
      return 'Just now';
    }
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // Past an hour but same day - show "Today 5:03 PM"
  if (isSameDay(date, now)) {
    return `Today ${formatTime(date)}`;
  }
  
  // Yesterday - show "Yesterday 5:03 PM"
  if (isYesterday(date)) {
    return `Yesterday ${formatTime(date)}`;
  }
  
  // More than a day but less than a week - show "Tuesday 1:50 PM"
  if (diffDays < 7) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    return `${dayName} ${formatTime(date)}`;
  }
  
  // More than a week - show "1/8/2025 4:50 PM"
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
  return `${formattedDate} ${formatTime(date)}`;
};