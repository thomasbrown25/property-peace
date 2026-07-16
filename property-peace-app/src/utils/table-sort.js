/**
 * Utility functions for table sorting
 */

/**
 * Creates a sort handler function
 * @param {string} field - The field to sort by
 * @param {string} sortField - Current sort field
 * @param {string} sortOrder - Current sort order ('asc' | 'desc')
 * @param {Function} setSortField - Function to set sort field
 * @param {Function} setSortOrder - Function to set sort order
 * @returns {Function} Handler function
 */
export const createSortHandler = (field, sortField, sortOrder, setSortField, setSortOrder) => {
  return () => {
    if (sortField === field) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };
};

/**
 * Generic sort function for arrays
 * @param {Array} array - Array to sort
 * @param {string} sortField - Field to sort by
 * @param {string} sortOrder - Sort order ('asc' | 'desc')
 * @param {Function} getSortValue - Function to extract sort value from item
 * @returns {Array} Sorted array
 */
export const sortArray = (array, sortField, sortOrder, getSortValue) => {
  if (!array || array.length === 0) return [];
  
  return [...array].sort((a, b) => {
    const aValue = getSortValue(a, sortField);
    const bValue = getSortValue(b, sortField);
    
    let comparison = 0;
    
    // Handle different value types
    if (aValue === null || aValue === undefined) {
      comparison = bValue === null || bValue === undefined ? 0 : 1;
    } else if (bValue === null || bValue === undefined) {
      comparison = -1;
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      comparison = aStr.localeCompare(bStr);
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
};

/**
 * Sort by string value (case-insensitive)
 */
export const sortByString = (a, b, field) => {
  const aValue = (a[field] || '').toLowerCase();
  const bValue = (b[field] || '').toLowerCase();
  return aValue.localeCompare(bValue);
};

/**
 * Sort by number value
 */
export const sortByNumber = (a, b, field) => {
  return (a[field] || 0) - (b[field] || 0);
};

/**
 * Sort by date value
 */
export const sortByDate = (a, b, field) => {
  const aDate = a[field] ? new Date(a[field]).getTime() : 0;
  const bDate = b[field] ? new Date(b[field]).getTime() : 0;
  return aDate - bDate;
};

/**
 * Sort by array length
 */
export const sortByArrayLength = (a, b, field) => {
  const aLength = (a[field] || []).length;
  const bLength = (b[field] || []).length;
  return aLength - bLength;
};

