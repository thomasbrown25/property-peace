import assert from 'node:assert/strict';
import test from 'node:test';

let taskWorkspace = {};

try {
  taskWorkspace = await import('./taskWorkspace.js');
} catch {
  // The first TDD run intentionally exercises the missing workspace module.
}

test('summarizeTasks counts open, resolved, due-today, and recurring work across API casing variants', () => {
  const now = new Date('2026-08-26T12:00:00-04:00');
  const tasks = [
    { id: 1, title: 'Inspect unit', dueDate: '2026-08-26T14:00:00-04:00', status: 0, isRecurring: false },
    { Id: 2, Title: 'Send renewal', DueDate: '2026-08-27T09:00:00-04:00', Status: 1, IsRecurring: true },
    { id: 3, title: 'Cancelled visit', dueDate: '2026-08-26T10:00:00-04:00', status: 2, isRecurring: true }
  ];

  assert.deepEqual(taskWorkspace.summarizeTasks?.(tasks, now), {
    open: 1,
    resolved: 2,
    today: 1,
    recurring: 2
  });
});

test('filterAndSortTasks prioritizes overdue and due-today open work before future and resolved tasks', () => {
  const now = new Date('2026-08-26T12:00:00-04:00');
  const tasks = [
    { id: 1, title: 'Completed', dueDate: '2026-08-20T09:00:00-04:00', status: 1 },
    { id: 2, title: 'Future', dueDate: '2026-08-29T09:00:00-04:00', status: 0 },
    { id: 3, title: 'Today', dueDate: '2026-08-26T15:00:00-04:00', status: 0 },
    { id: 4, title: 'Overdue', dueDate: '2026-08-25T09:00:00-04:00', status: 0 },
    { id: 5, title: 'Cancelled', dueDate: '2026-08-19T09:00:00-04:00', status: 2 }
  ];

  const result = taskWorkspace.filterAndSortTasks?.(tasks, {}, now);

  assert.deepEqual(
    result?.map((task) => task.id),
    [4, 3, 2, 1, 5]
  );
});

test('filterAndSortTasks applies search, status, property, date, and frequency filters', () => {
  const now = new Date('2026-08-26T12:00:00-04:00');
  const tasks = [
    {
      id: 1,
      title: 'Inspect kitchen',
      propertyName: 'Elm House',
      propertyId: 10,
      dueDate: '2026-08-26T14:00:00-04:00',
      status: 0,
      isRecurring: false
    },
    {
      id: 2,
      title: 'Send renewal',
      propertyName: 'Oak Court',
      propertyId: 20,
      dueDate: '2026-08-29T09:00:00-04:00',
      status: 0,
      isRecurring: true
    },
    {
      id: 3,
      title: 'Close repair',
      propertyName: 'Elm House',
      propertyId: 10,
      dueDate: '2026-08-25T09:00:00-04:00',
      status: 1,
      isRecurring: false
    }
  ];
  const ids = (filters) => taskWorkspace.filterAndSortTasks?.(tasks, filters, now).map((task) => task.id);

  assert.deepEqual(ids({ search: 'renewal' }), [2]);
  assert.deepEqual(ids({ status: 'done' }), [3]);
  assert.deepEqual(ids({ propertyId: '10' }), [1, 3]);
  assert.deepEqual(ids({ date: 'today' }), [1]);
  assert.deepEqual(ids({ frequency: 'recurring' }), [2]);
});

test('buildTodayReminders combines open tasks, scheduled maintenance, and active rent due events while excluding resolved work', () => {
  const now = new Date('2026-08-26T12:00:00-04:00');
  const result = taskWorkspace.buildTodayReminders?.(
    {
      tasks: [
        { id: 1, title: 'Inspect Unit 4', dueDate: '2026-08-26T14:00:00-04:00', status: 0 },
        { id: 2, title: 'Already handled', dueDate: '2026-08-26T10:00:00-04:00', status: 1 }
      ],
      dashboardSummary: {
        maintenanceRequests: {
          maintenanceRequests: [
            { id: 8, title: 'Meet the plumber', scheduledDate: '2026-08-26T16:00:00-04:00', status: 'Open' },
            { id: 9, title: 'Finished repair', scheduledDate: '2026-08-26T09:00:00-04:00', status: 'Completed' }
          ]
        }
      },
      properties: [
        {
          id: 10,
          name: 'Elm House',
          units: [
            {
              id: 20,
              status: 'occupied',
              lease: { id: 30, isActive: true, startDate: '2026-01-01', endDate: '2027-01-01', rentDueDay: 26 }
            }
          ]
        }
      ]
    },
    now
  );

  assert.deepEqual(
    result?.map((reminder) => reminder.title),
    ['Rent due · Elm House', 'Inspect Unit 4', 'Meet the plumber']
  );
});

test('taskCategoryKey follows the backend task category enum used by Calendar and Tasks', () => {
  assert.equal(taskWorkspace.taskCategoryKey?.({ category: 0 }), 'task');
  assert.equal(taskWorkspace.taskCategoryKey?.({ category: 1 }), 'rent');
  assert.equal(taskWorkspace.taskCategoryKey?.({ category: 2 }), 'maintenance');
  assert.equal(taskWorkspace.taskCategoryKey?.({ category: 3 }), 'lease');
});

test('buildTaskUpdatePayload preserves the backend task contract when changing status', () => {
  const task = {
    Id: 42,
    Title: 'Inspect boiler',
    DueDate: '2026-08-26T14:00:00Z',
    Category: 2,
    Status: 0,
    PropertyId: 9,
    IsRecurring: true,
    RecurrenceType: 3,
    RecurrenceInterval: 1,
    RecurrenceEndDate: '2027-01-01T00:00:00Z'
  };

  assert.deepEqual(taskWorkspace.buildTaskUpdatePayload?.(task, { status: 1 }), {
    id: 42,
    title: 'Inspect boiler',
    dueDate: '2026-08-26T14:00:00Z',
    category: 2,
    status: 1,
    propertyId: 9,
    isRecurring: true,
    recurrenceType: 3,
    recurrenceInterval: 1,
    recurrenceEndDate: '2027-01-01T00:00:00Z'
  });
});

test('buildRecurringExpenseTaskEvents shows active recurring fees as Task calendar events', () => {
  const events = taskWorkspace.buildRecurringExpenseTaskEvents?.(
    [
      {
        id: 7,
        name: 'Water service',
        amount: 85.5,
        frequency: 'Monthly',
        dayOfPeriod: 31,
        startDate: '2026-01-31T09:00:00',
        propertyId: 12,
        propertyName: 'Elm House',
        isPaused: false
      },
      {
        id: 8,
        name: 'Paused landscaping',
        frequency: 0,
        dayOfPeriod: 15,
        startDate: '2026-01-15T09:00:00',
        isPaused: true
      }
    ],
    new Date('2026-02-01T00:00:00'),
    new Date('2026-03-31T23:59:59'),
    new Date('2026-02-15T12:00:00')
  );

  assert.deepEqual(
    events?.map((event) => ({ title: event.title, category: event.category, date: event.date.getDate(), status: event.status })),
    [
      { title: 'Pay · Water service', category: 'Task', date: 28, status: 'Upcoming' },
      { title: 'Pay · Water service', category: 'Task', date: 31, status: 'Upcoming' }
    ]
  );
  assert.equal(events?.[0].amount, 85.5);
  assert.equal(events?.[0].propertyId, 12);
});

test('buildRecurringExpenseTaskEvents honors quarterly cadence and inclusive end dates', () => {
  const events = taskWorkspace.buildRecurringExpenseTaskEvents?.(
    [{ Id: 9, Name: 'Quarterly service', Frequency: 1, DayOfPeriod: 10, StartDate: '2026-01-10', EndDate: '2026-07-10' }],
    new Date('2026-01-01'),
    new Date('2026-12-31'),
    new Date('2025-12-01')
  );

  assert.deepEqual(events?.map((event) => `${event.date.getMonth() + 1}/${event.date.getDate()}`), ['1/10', '4/10', '7/10']);
});
