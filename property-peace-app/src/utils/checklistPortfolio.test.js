import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChecklistWorkspacePath,
  enrichChecklistsWithProperties,
  filterChecklistPortfolio,
  getChecklistDateSummary,
  getChecklistProgress
} from './checklistPortfolio.js';

test('opens a unit checklist in its existing property workspace route', () => {
  assert.equal(
    buildChecklistWorkspacePath({ id: 91, propertyId: 12, unitId: 34 }),
    '/landlord/checklists/property/12/unit/34/checklist/91'
  );
});

test('opens a property checklist without adding an empty unit segment', () => {
  assert.equal(buildChecklistWorkspacePath({ id: 92, propertyId: 13, unitId: null }), '/landlord/checklists/property/13/checklist/92');
});

test('derives checked item progress for the checklist ledger', () => {
  assert.deepEqual(getChecklistProgress({ items: [{ isChecked: true }, { isChecked: false }, { isChecked: true }] }), {
    completed: 2,
    total: 3,
    percent: 67
  });
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

test('filters the ledger by checklist type and completion status', () => {
  const checklists = [
    { id: 1, checklistType: 40, isCompleted: false },
    { id: 2, checklistType: 40, isCompleted: true },
    { id: 3, checklistType: 41, isCompleted: false }
  ];

  assert.deepEqual(
    filterChecklistPortfolio(checklists, { type: 'move-in', status: 'in-progress' }).map((item) => item.id),
    [1]
  );
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
