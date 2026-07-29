export const adminUserSortableColumns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'roles', label: 'Roles' },
  { key: 'authProvider', label: 'Auth Provider' },
  { key: 'createDate', label: 'Created Date' },
  { key: 'lastLogin', label: 'Last Login' },
  { key: 'loginCount', label: 'Login Count' },
  { key: 'status', label: 'Status' }
];

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

const getName = (user) => {
  const firstName = user.firstName || user.firstname || '';
  const lastName = user.lastName || user.lastname || '';
  return `${firstName} ${lastName}`.trim() || 'N/A';
};

const getStatus = (user) => {
  if (user.isDeleted) return 'Deleted';
  if (user.isSuspended) return 'Suspended';
  return 'Active';
};

const getSortValue = (user, key) => {
  switch (key) {
    case 'name':
      return getName(user);
    case 'email':
      return user.email || null;
    case 'phone':
      return user.phoneNumber || null;
    case 'roles':
      return user.roles?.length ? [...user.roles].sort((a, b) => collator.compare(a, b)).join(', ') : 'No Role';
    case 'authProvider':
      return user.authProvider || 'Email';
    case 'createDate':
      return user.createDate ? new Date(user.createDate).getTime() : null;
    case 'lastLogin': {
      const lastLogin = user.lastLogin || user.LastLogin;
      return lastLogin ? new Date(lastLogin).getTime() : null;
    }
    case 'loginCount':
      return user.loginCount ?? user.LoginCount ?? 0;
    case 'status':
      return getStatus(user);
    default:
      return null;
  }
};

const compareValues = (left, right) => {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return collator.compare(String(left), String(right));
};

export const sortAdminUsers = (users, sortConfig) => {
  if (!sortConfig?.key) return [...users];

  const directionMultiplier = sortConfig.direction === 'desc' ? -1 : 1;

  return users
    .map((user, index) => ({ user, index, value: getSortValue(user, sortConfig.key) }))
    .sort((left, right) => {
      const leftMissing = left.value === null || left.value === undefined || left.value === '';
      const rightMissing = right.value === null || right.value === undefined || right.value === '';

      if (leftMissing && rightMissing) return left.index - right.index;
      if (leftMissing) return 1;
      if (rightMissing) return -1;

      const comparison = compareValues(left.value, right.value);
      return comparison === 0 ? left.index - right.index : comparison * directionMultiplier;
    })
    .map(({ user }) => user);
};

export const getNextAdminUserSort = (currentSort, key) => ({
  key,
  direction: currentSort?.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc'
});
