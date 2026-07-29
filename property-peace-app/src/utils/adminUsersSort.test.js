import { describe, expect, it } from 'vitest';
import { adminUserSortableColumns, getNextAdminUserSort, sortAdminUsers } from './adminUsersSort';

const users = [
  {
    id: 1,
    firstName: 'Zoe',
    lastName: 'Adams',
    email: 'zoe@example.com',
    phoneNumber: '555-2000',
    roles: ['Tenant'],
    authProvider: 'Google',
    createDate: '2026-02-01T00:00:00Z',
    lastLogin: null,
    loginCount: 2,
    isSuspended: false,
    isDeleted: false
  },
  {
    id: 2,
    firstname: 'Amy',
    lastname: 'Brown',
    email: 'amy@example.com',
    phoneNumber: '555-1000',
    roles: ['Admin', 'Landlord'],
    authProvider: 'Email,Google',
    createDate: '2026-01-01T00:00:00Z',
    LastLogin: '2026-07-01T12:00:00Z',
    LoginCount: 10,
    isSuspended: true,
    isDeleted: false
  },
  {
    id: 3,
    firstName: 'Ben',
    lastName: 'Clark',
    email: 'ben@example.com',
    phoneNumber: null,
    roles: [],
    authProvider: null,
    createDate: null,
    lastLogin: '2026-06-01T12:00:00Z',
    loginCount: 0,
    isSuspended: false,
    isDeleted: true
  }
];

describe('adminUserSortableColumns', () => {
  it('makes every data column sortable while leaving actions out', () => {
    expect(adminUserSortableColumns.map((column) => column.key)).toEqual([
      'name',
      'email',
      'phone',
      'roles',
      'authProvider',
      'createDate',
      'lastLogin',
      'loginCount',
      'status'
    ]);
  });
});

describe('sortAdminUsers', () => {
  it.each([
    ['name', [2, 3, 1]],
    ['email', [2, 3, 1]],
    ['phone', [2, 1, 3]],
    ['roles', [2, 3, 1]],
    ['authProvider', [3, 2, 1]],
    ['createDate', [2, 1, 3]],
    ['lastLogin', [3, 2, 1]],
    ['loginCount', [3, 1, 2]],
    ['status', [1, 3, 2]]
  ])('sorts the %s column ascending and keeps missing values last', (key, expectedIds) => {
    expect(sortAdminUsers(users, { key, direction: 'asc' }).map((user) => user.id)).toEqual(expectedIds);
  });

  it('sorts descending while still keeping missing values last', () => {
    expect(sortAdminUsers(users, { key: 'lastLogin', direction: 'desc' }).map((user) => user.id)).toEqual([2, 3, 1]);
  });

  it('does not mutate the filtered user list', () => {
    const originalIds = users.map((user) => user.id);
    sortAdminUsers(users, { key: 'name', direction: 'asc' });
    expect(users.map((user) => user.id)).toEqual(originalIds);
  });
});

describe('getNextAdminUserSort', () => {
  it('starts a newly selected column in ascending order', () => {
    expect(getNextAdminUserSort({ key: 'name', direction: 'desc' }, 'email')).toEqual({ key: 'email', direction: 'asc' });
  });

  it('toggles the active column between ascending and descending', () => {
    expect(getNextAdminUserSort({ key: 'email', direction: 'asc' }, 'email')).toEqual({ key: 'email', direction: 'desc' });
    expect(getNextAdminUserSort({ key: 'email', direction: 'desc' }, 'email')).toEqual({ key: 'email', direction: 'asc' });
  });
});
