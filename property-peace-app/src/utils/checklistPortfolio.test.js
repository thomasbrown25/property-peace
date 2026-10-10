import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChecklistWorkspacePath,
  enrichChecklistsWithProperties,
  filterChecklistPortfolio,
  getChecklistDateSummary,
  getChecklistProgress,
  getChecklistStatus,
  getChecklistTypeLabel,
  sortChecklistPortfolio
} from './checklistPortfolio.js';

test('defaults to creation date newest first, regardless of completion, inspection, or updates', () => {
  const records = [
    { id: 1, createdAt: '2026-01-01', updatedAt: '2026-10-01', isCompleted: false },
    { id: 2, createdAt: '2026-03-01', inspectionDate: '2025-01-01', isCompleted: true },
    { id: 3, createdAt: '2026-02-01', updatedAt: '2026-12-01' }
  ];
  assert.deepEqual(sortChecklistPortfolio(records).map(({ id }) => id), [2, 3, 1]);
  assert.deepEqual(records.map(({ id }) => id), [1, 2, 3]);
  assert.deepEqual(sortChecklistPortfolio(records, 'created', 'asc').map(({ id }) => id), [1, 3, 2]);
});

test('sorts each visible column by its data, toggling direction, and keeps missing dates last', () => {
  const records = [
    { id: 1, propertyName: 'Z House', unitName: '2', checklistType: 41, leaseStartDate: '2026-05-01', inspectionDate: '2026-06-01', createdAt: '2026-01-01', items: [{ condition: 'Good' }] },
    { id: 2, propertyName: 'A House', unitName: '1', checklistType: 40, leaseStartDate: '2026-02-01', inspectionDate: '2026-03-01', createdAt: '2026-01-02', items: [{ condition: 'NR' }] },
    { id: 3, propertyName: 'M House', unitName: '3', checklistType: 41, createdAt: '2026-01-03', items: [{ condition: 'Good' }, {}] }
  ];
  const ids = (key, direction = 'asc') => sortChecklistPortfolio(records, key, direction).map(({ id }) => id);
  assert.deepEqual(ids('home'), [2, 3, 1]);
  assert.deepEqual(ids('home', 'desc'), [1, 3, 2]);
  assert.deepEqual(ids('checklist'), [2, 3, 1]);
  assert.deepEqual(ids('lease'), [2, 1, 3]);
  assert.deepEqual(ids('lease', 'desc'), [1, 2, 3]);
  assert.deepEqual(ids('progress'), [3, 2, 1]);
  assert.deepEqual(ids('inspection'), [2, 1, 3]);
  assert.deepEqual(ids('status'), [1, 2, 3]);
});

test('opens a unit checklist in its existing property workspace route', () => {
  assert.equal(
    buildChecklistWorkspacePath({ id: 91, propertyId: 12, unitId: 34 }),
    '/landlord/checklists/property/12/unit/34/checklist/91'
  );
});

test('opens a property checklist without adding an empty unit segment', () => {
  assert.equal(buildChecklistWorkspacePath({ id: 92, propertyId: 13, unitId: null }), '/landlord/checklists/property/13/checklist/92');
});

test('derives rated and legacy checked item progress for the checklist ledger', () => {
  assert.deepEqual(getChecklistProgress({ items: [{ isChecked: true }, { isChecked: false }, { isChecked: true }] }), {
    completed: 2,
    total: 3,
    percent: 67
  });
  assert.deepEqual(getChecklistProgress({ items: [{ condition: 'Good', isChecked: false }, { condition: 'NR' }, {}] }), {
    completed: 2, total: 3, percent: 67
  });
});

test('checklist status requires 100% progress and uses the worst condition', () => {
  const items = (conditions) => conditions.map((condition) => ({ condition }));
  assert.deepEqual(getChecklistStatus({ isCompleted: false, items: items(['Good', 'Good']) }),
    { label: 'Complete, all good', color: 'success', completed: true });
  for (const condition of ['NC', 'NP', 'NSC', 'NSP']) {
    assert.deepEqual(getChecklistStatus({ items: items(['Good', condition]) }),
      { label: 'Complete, needs attention', color: 'warning', completed: true });
  }
  for (const condition of ['NR', 'RP']) {
    assert.deepEqual(getChecklistStatus({ items: items(['Good', 'NP', condition]) }),
      { label: 'Complete, needs repairs', color: 'error', completed: true });
  }
  assert.deepEqual(getChecklistStatus({ isCompleted: true, items: items(['NR', null]) }),
    { label: 'In progress', color: 'warning', completed: false });
  assert.deepEqual(getChecklistStatus({ isCompleted: true, items: [] }),
    { label: 'In progress', color: 'warning', completed: false });
  assert.deepEqual(getChecklistStatus({ items: [{ isChecked: true }] }),
    { label: 'Complete, needs attention', color: 'warning', completed: true });
});

test('checklist type label ignores stored home and unit title', () => {
  assert.equal(getChecklistTypeLabel({ checklistType: 40, title: 'Elm House – Unit 2 – Move-In Checklist' }), 'Move-in checklist');
  assert.equal(getChecklistTypeLabel({ checklistType: 41, title: 'Elm House – Unit 2 – Move-Out Checklist' }), 'Move-out checklist');
});

test('selects the date that matches the checklist status label', () => {
  assert.deepEqual(getChecklistDateSummary({ isCompleted: true, inspectionDate: '2026-08-10', completedAt: '2026-08-12' }), {
    value: '2026-08-12',
    label: 'Completed date'
  });
  assert.deepEqual(getChecklistDateSummary({ isCompleted: false, inspectionDate: '2026-08-10' }), {
    value: '2026-08-10',
    label: 'Inspection date'
  });
});

test('searches checklist records by the home, unit, tenant, or title people recognize', () => {
  const checklists = [
    { id: 1, propertyName: 'Ashbury House', unitName: '2B', tenantName: 'Morgan Lee', title: 'Move-In Checklist' },
    { id: 2, propertyName: 'Cedar Court', unitName: 'Garden', tenantName: 'Jules Park', title: 'Move-Out Checklist' }
  ];

  assert.deepEqual(
    filterChecklistPortfolio(checklists, { search: 'morgan' }).map((item) => item.id),
    [1]
  );
  assert.deepEqual(
    filterChecklistPortfolio(checklists, { search: 'garden' }).map((item) => item.id),
    [2]
  );
});

test('filters the ledger by checklist type and visible progress-based status', () => {
  const checklists = [
    { id: 1, checklistType: 40, isCompleted: true, items: [{ isChecked: false }] },
    { id: 2, checklistType: 40, isCompleted: false, items: [{ condition: 'NR' }] },
    { id: 3, checklistType: 41, isCompleted: false, items: [] }
  ];

  assert.deepEqual(
    filterChecklistPortfolio(checklists, { type: 'move-in', status: 'in-progress' }).map((item) => item.id),
    [1]
  );
  assert.deepEqual(filterChecklistPortfolio(checklists, { status: 'completed' }).map((item) => item.id), [2]);
});

test('does not classify unknown checklist types as move-out records', () => {
  const checklists = [
    { id: 1, checklistType: 41 },
    { id: 2, checklistType: 99 }
  ];

  assert.deepEqual(
    filterChecklistPortfolio(checklists, { type: 'move-out' }).map((item) => item.id),
    [1]
  );
});

test('enriches unnamed checklist homes with the property address people recognize', () => {
  const [checklist] = enrichChecklistsWithProperties(
    [{ id: 7, propertyId: 12, propertyName: '' }],
    [{ id: 12, name: '', streetAddress: '410 Cedar Ave', city: 'Akron', state: 'OH' }]
  );

  assert.equal(checklist.propertyName, '410 Cedar Ave');
  assert.equal(checklist.propertyAddress, '410 Cedar Ave, Akron, OH');
  assert.deepEqual(
    filterChecklistPortfolio([checklist], { search: 'akron' }).map((item) => item.id),
    [7]
  );
});
