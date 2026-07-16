import { useSelector } from 'react-redux';
import { selectUserSettings } from 'store/user/user.selector';
import moment from 'moment';

/**
 * Hook that provides formatting functions based on user settings
 * @returns {Object} Object containing formatting functions
 */
export const useUserFormatters = () => {
  const userSettings = useSelector(selectUserSettings);

  // Get default values from user settings or fallback to defaults
  const timezone = userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  const dateFormat = userSettings?.dateFormat || 'MM/DD/YYYY';
  const timeFormat = userSettings?.timeFormat || '12h';
  const currency = userSettings?.currency || 'USD';

  /**
   * Converts a date to user's timezone using Intl API
   * @param {string|Date} dateString - The date to convert
   * @returns {Date} - Date in user's timezone
   */
  const toUserTimezone = (dateString) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      // Use Intl API to format in user's timezone, then parse back
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(date);
      const year = parseInt(parts.find(p => p.type === 'year').value);
      const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
      const day = parseInt(parts.find(p => p.type === 'day').value);
      const hour = parseInt(parts.find(p => p.type === 'hour').value);
      const minute = parseInt(parts.find(p => p.type === 'minute').value);
      const second = parseInt(parts.find(p => p.type === 'second').value);
      
      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      console.warn('[toUserTimezone] Error converting timezone:', error);
      return new Date(dateString);
    }
  };

  /**
   * Formats a date according to user's date format preference
   * @param {string|Date} dateString - The date to format
   * @param {string} [customFormat] - Optional custom format override
   * @returns {string} - Formatted date string
   */
  const formatDate = (dateString, customFormat = null) => {
    if (!dateString) return '';
    
    const format = customFormat || dateFormat;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('[formatDate] Invalid date:', dateString);
        return '';
      }

      // Use Intl API to get date parts in user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year').value;
      const month = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;

      // Map format patterns to actual values
      const formatMap = {
        'MM/DD/YYYY': `${month}/${day}/${year}`,
        'DD/MM/YYYY': `${day}/${month}/${year}`,
        'YYYY-MM-DD': `${year}-${month}-${day}`,
        'DD-MM-YYYY': `${day}-${month}-${year}`
      };

      return formatMap[format] || format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
    } catch (error) {
      console.warn('[formatDate] Error formatting date:', error);
      // Fallback to moment
      const date = moment(dateString);
      if (!date.isValid()) return '';
      
      const formatMap = {
        'MM/DD/YYYY': 'MM/DD/YYYY',
        'DD/MM/YYYY': 'DD/MM/YYYY',
        'YYYY-MM-DD': 'YYYY-MM-DD',
        'DD-MM-YYYY': 'DD-MM-YYYY'
      };
      return date.format(formatMap[format] || format);
    }
  };

  /**
   * Formats a time according to user's time format preference
   * @param {string|Date} dateString - The date/time to format
   * @returns {string} - Formatted time string
   */
  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('[formatTime] Invalid date:', dateString);
        return '';
      }

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: timeFormat === '12h'
      });

      return formatter.format(date);
    } catch (error) {
      console.warn('[formatTime] Error formatting time:', error);
      // Fallback to moment
      const date = moment(dateString);
      if (!date.isValid()) return '';
      
      return timeFormat === '24h' ? date.format('HH:mm') : date.format('h:mm A');
    }
  };

  /**
   * Formats a date and time according to user's preferences
   * @param {string|Date} dateString - The date/time to format
   * @returns {string} - Formatted date and time string
   */
  const formatDateAndTime = (dateString) => {
    if (!dateString) return '';
    
    const dateStr = formatDate(dateString);
    const timeStr = formatTime(dateString);
    
    return dateStr && timeStr ? `${dateStr} ${timeStr}` : '';
  };

  /**
   * Formats a currency amount according to user's currency preference
   * @param {number} amount - The amount to format
   * @param {Object} [options] - Additional formatting options
   * @returns {string} - Formatted currency string
   */
  const formatCurrency = (amount, options = {}) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '';
    }

    const {
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
      showSymbol = true
    } = options;

    try {
      // Get locale based on currency (simplified mapping)
      const localeMap = {
        'USD': 'en-US',
        'EUR': 'de-DE',
        'GBP': 'en-GB',
        'CAD': 'en-CA',
        'AUD': 'en-AU'
      };
      
      const locale = localeMap[currency] || 'en-US';
      
      return new Intl.NumberFormat(locale, {
        style: showSymbol ? 'currency' : 'decimal',
        currency: currency,
        minimumFractionDigits,
        maximumFractionDigits
      }).format(amount);
    } catch (error) {
      console.warn('[formatCurrency] Error formatting currency:', error);
      // Fallback to USD if currency is invalid
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits,
        maximumFractionDigits
      }).format(amount);
    }
  };

  /**
   * Gets the current date/time in user's timezone
   * @returns {Date} - Current date in user's timezone
   */
  const getCurrentDateInTimezone = () => {
    try {
      const now = new Date();
      return toUserTimezone(now);
    } catch (error) {
      console.warn('[getCurrentDateInTimezone] Error:', error);
      return new Date();
    }
  };

  return {
    formatDate,
    formatTime,
    formatDateAndTime,
    formatCurrency,
    toUserTimezone,
    getCurrentDateInTimezone,
    timezone,
    dateFormat,
    timeFormat,
    currency
  };
};

export default useUserFormatters;

