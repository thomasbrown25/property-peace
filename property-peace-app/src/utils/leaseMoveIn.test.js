import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveExactLeaseSigners,
  selectCurrentSignatureStatus,
  validateExactLeaseSigners,
  buildLeaseMoveInReadiness,
  buildLeaseChecklistCards,
  sortLeaseChecklistSteps
} from './leaseMoveIn.js';

describe('selectCurrentSignatureStatus', () => {
  it('fails closed when a completed status belongs to another lease or envelope', () => {
    const completedA = {
      leaseId: 10,
      envelopeId: 'envelope-a',
      data: { Status: 'completed', signerStatuses: {} }
    };

    assert.equal(selectCurrentSignatureStatus(completedA, 10, 'envelope-a'), completedA.data);
    assert.equal(selectCurrentSignatureStatus(completedA, 11, 'envelope-a'), null);
    assert.equal(selectCurrentSignatureStatus(completedA, 10, 'envelope-b'), null);
    assert.equal(selectCurrentSignatureStatus(completedA, 11, null), null);
  });
});

describe('deriveExactLeaseSigners', () => {
  it('normalizes mixed-case authoritative tenant fields without making them editable', () => {
    assert.deepEqual(deriveExactLeaseSigners([
      { Id: 9, Firstname: '  Ada ', LastName: ' Lovelace  ', Email: ' ADA@EXAMPLE.COM ' },
      { id: 11, firstName: 'Grace', lastname: ' Hopper ', email: ' Grace@Example.com' }
    ]), [
      { tenantId: 9, name: 'Ada Lovelace', email: 'ada@example.com', signingOrder: 1 },
      { tenantId: 11, name: 'Grace Hopper', email: 'grace@example.com', signingOrder: 2 }
    ]);
  });
});

describe('validateExactLeaseSigners', () => {
  it('fails closed for no signers, invalid/duplicate IDs, and blank normalized identity fields', () => {
    assert.equal(validateExactLeaseSigners([]).valid, false);
    const result = validateExactLeaseSigners([
      { tenantId: 0, name: ' ', email: 'person@example.com' },
      { tenantId: 2, name: 'Person', email: ' ' },
      { tenantId: 2, name: 'Other', email: 'other@example.com' }
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('positive')));
    assert.ok(result.errors.some((error) => error.includes('unique')));
    assert.ok(result.errors.some((error) => error.includes('name')));
    assert.ok(result.errors.some((error) => error.includes('email')));
  });

  it('accepts a nonempty exact signer set', () => {
    assert.deepEqual(validateExactLeaseSigners([
      { tenantId: 2, name: ' Person ', email: ' PERSON@example.com ' }
    ]), { valid: true, errors: [] });
  });
});

describe('sortLeaseChecklistSteps', () => {
  it('places completed cards on the left, keeping the relative order within both groups', () => {
    const steps = [
      { key: 'tenants', status: 'pending' },
      { key: 'agreement', status: 'complete' },
      { key: 'signatures', status: 'unavailable' },
      { key: 'checklist', status: 'complete' },
      { key: 'move-out', status: 'pending' }
    ];
    assert.deepEqual(sortLeaseChecklistSteps(steps).map((step) => step.key),
      ['agreement', 'checklist', 'tenants', 'signatures', 'move-out']);
    assert.deepEqual(steps.map((step) => step.key),
      ['tenants', 'agreement', 'signatures', 'checklist', 'move-out']);
  });
});

describe('buildLeaseChecklistCards', () => {
  const now = new Date('2026-01-01T12:00:00');
  const readiness = { steps: [
    { key: 'tenants', status: 'complete', detail: '1 assigned' },
    { key: 'agreement', status: 'complete', detail: 'Agreement on file' },
    { key: 'signatures', status: 'pending', detail: 'Landlord signature required' },
    { key: 'rent-deposit', status: 'pending' },
    { key: 'condition-report', status: 'complete' },
    { key: 'checklist', status: 'unavailable', detail: 'Checklist records unavailable' }
  ] };
  const lease = { id: 136, endDate: '2026-04-02' };

  it('renders only the four requested cards and does not call unavailable evidence complete', () => {
    const result = buildLeaseChecklistCards({ readiness, lease, now });
    assert.deepEqual(result.steps.map((step) => step.label), [
      'Tenants on lease', 'Lease agreement created', 'Lease agreement signed', 'Move-in checklist complete'
    ]);
    assert.equal(result.completed, 2);
    assert.equal(result.totalTrackable, 4);
    assert.equal(result.progress, 50);
    assert.equal(result.steps[2].detail, 'Landlord signature required');
  });

  it('hides signatures until agreement creation is confirmed and excludes them from progress', () => {
    for (const status of ['pending', 'unavailable', undefined]) {
      const steps = readiness.steps.filter((step) => step.key !== 'agreement');
      if (status) steps.push({ key: 'agreement', status });
      // Stale signature completion must not expose a card without an agreement.
      const withoutAgreement = { steps: steps.map((step) => step.key === 'signatures' ? { ...step, status: 'complete' } : step) };
      const result = buildLeaseChecklistCards({ readiness: withoutAgreement, lease, now });
      assert.deepEqual(result.steps.map((step) => step.key), ['tenants', 'agreement', 'checklist']);
      assert.equal(result.completed, 1);
      assert.equal(result.totalTrackable, 3);
      assert.equal(result.progress, 1 / 3 * 100);
      assert.equal(result.ready, false);
    }
    assert.equal(buildLeaseChecklistCards({ lease, now }).steps.some((step) => step.key === 'signatures'), false);
  });

  it('shows completed signatures once an agreement exists', () => {
    const signed = { steps: readiness.steps.map((step) => step.key === 'signatures' ? { ...step, status: 'complete' } : step) };
    const result = buildLeaseChecklistCards({ readiness: signed, lease, now });
    assert.equal(result.steps.find((step) => step.key === 'signatures').status, 'complete');
    assert.equal(result.completed, 3);
    assert.equal(result.totalTrackable, 4);
    assert.equal(result.progress, 75);
  });

  it('hides move-out more than five days before the end, even with a completed record', () => {
    const result = buildLeaseChecklistCards({
      readiness, lease: { ...lease, endDate: '2026-01-07' }, now,
      checklists: [{ id: 4, leaseId: 136, checklistType: 41, isCompleted: true }]
    });
    assert.equal(result.steps.some((step) => step.key === 'move-out'), false);
    assert.equal(result.completed, 2);
    assert.equal(result.totalTrackable, 4);
    assert.equal(result.progress, 50);
  });

  it('shows move-out starting five days before the end and uses only completed records for this lease', () => {
    const atBoundary = { ...lease, endDate: '2026-01-06' };
    const records = [
      { id: 1, leaseId: 135, checklistType: 41, isCompleted: true },
      { id: 2, leaseId: 136, checklistType: 40, isCompleted: true },
      { id: 3, leaseId: 136, checklistType: 41, isCompleted: false }
    ];
    const result = buildLeaseChecklistCards({ readiness, lease: atBoundary, checklists: records, now });
    assert.equal(result.steps.at(-1).label, 'Move-out checklist complete');
    assert.equal(result.steps.at(-1).status, 'pending');
    assert.equal(result.totalTrackable, 5);
    assert.equal(buildLeaseChecklistCards({ readiness, lease: atBoundary, checklists: [...records, { id: 4, leaseId: 136, checklistType: 41, completedAt: '2026-03-31' }], now }).steps.at(-1).status, 'complete');
  });

  it('keeps move-out visible after expiration and unavailable when records fail to load', () => {
    const result = buildLeaseChecklistCards({ readiness, lease: { ...lease, endDate: '2025-12-31' }, now });
    assert.equal(result.steps.at(-1).status, 'unavailable');
    assert.equal(result.totalTrackable, 5);
    assert.equal(buildLeaseChecklistCards({ readiness, lease: { id: 136 }, checklists: [], now }).steps.length, 4);
  });
});

describe('buildLeaseMoveInReadiness', () => {
  const completeInput = {
    lease: {
      Id: 136,
      RentAmount: 1800,
      DepositAmount: 900,
      RentCollectionByPlatform: false,
      LandlordEmail: 'landlord@example.com',
      MoveInReportTemplateCompletedAt: '2026-08-01',
      LeaseAgreement: { LandlordSignedAt: '2026-08-02' }
    },
    tenants: [{ Id: 4, Firstname: 'Ada', Lastname: 'L', Email: 'ada@example.com', TenantSignedAt: '2026-08-03' }],
    leaseAgreement: { BlobUrl: 'https://example.test/lease.pdf' },
    checklists: [{ Id: 22, LeaseId: 136, ChecklistType: 40, IsCompleted: true, CompletedAt: '2026-08-04' }]
  };

  it('computes readiness only from authoritative lease state and real checklist records', () => {
    const result = buildLeaseMoveInReadiness(completeInput);
    assert.equal(result.steps.find((step) => step.key === 'tenants').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'agreement').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'signatures').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'rent-deposit').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'condition-report').status, 'complete');
    assert.equal(result.steps.some((step) => step.key === 'keys'), false);
    assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'complete');
    assert.equal(result.completed, 6);
    assert.equal(result.totalTrackable, 6);
  });

  it('does not call landlord-only or zero-tenant signing complete', () => {
    const noTenants = buildLeaseMoveInReadiness({ ...completeInput, tenants: [] });
    assert.equal(noTenants.steps.find((step) => step.key === 'signatures').status, 'pending');

    const tenantUnsigned = buildLeaseMoveInReadiness({
      ...completeInput,
      tenants: [{ Id: 4, Firstname: 'Ada', Email: 'ada@example.com' }]
    });
    assert.equal(tenantUnsigned.steps.find((step) => step.key === 'signatures').status, 'pending');
  });

  it('identifies exactly which party still needs to sign', () => {
    const unsigned = buildLeaseMoveInReadiness({ ...completeInput, lease: { ...completeInput.lease, LeaseAgreement: {} }, tenants: [{ Id: 4, Email: 'ada@example.com' }] });
    assert.equal(unsigned.steps.find((step) => step.key === 'signatures').detail, 'Landlord and tenant signatures required');
    const landlordOnly = buildLeaseMoveInReadiness({ ...completeInput, tenants: [{ Id: 4, Email: 'ada@example.com' }] });
    assert.equal(landlordOnly.steps.find((step) => step.key === 'signatures').detail, 'Tenant signature required');
    const tenantOnly = buildLeaseMoveInReadiness({ ...completeInput, lease: { ...completeInput.lease, LeaseAgreement: {} } });
    assert.equal(tenantOnly.steps.find((step) => step.key === 'signatures').detail, 'Landlord signature required');
  });

  it('requires exact completed signer evidence before trusting an overall completed envelope', () => {
    const withoutEvidence = buildLeaseMoveInReadiness({
      ...completeInput,
      tenants: [{ Id: 4, Firstname: 'Ada', Lastname: 'L', Email: 'ada@example.com' }],
      signatureStatus: { Status: 'completed' }
    });
    const needsReview = withoutEvidence.steps.find((step) => step.key === 'signatures');
    assert.equal(needsReview.status, 'pending');
    assert.equal(needsReview.detail, 'Completion recorded; verify current tenant signer set');

    const exactEvidence = buildLeaseMoveInReadiness({
      ...completeInput,
      tenants: [
        { Id: 4, Firstname: 'Ada', Lastname: 'L', Email: 'ada@example.com' },
        { Id: 5, Firstname: 'Grace', Lastname: 'H', Email: 'grace@example.com' }
      ],
      signatureStatus: {
        Status: 'completed',
        signerStatuses: {
          'landlord@example.com': { email: 'LANDLORD@example.com', status: 'completed' },
          'grace@example.com': { email: ' GRACE@example.com ', status: 'completed' },
          'ada@example.com': { email: 'ada@example.com', status: 'signed' }
        }
      }
    });
    assert.equal(exactEvidence.steps.find((step) => step.key === 'signatures').status, 'complete');

    const staleEvidence = buildLeaseMoveInReadiness({
      ...completeInput,
      tenants: [{ Id: 4, Firstname: 'Ada', Lastname: 'L', Email: 'ada@example.com' }],
      signatureStatus: {
        Status: 'completed',
        signerStatuses: [
          { email: 'ada@example.com', status: 'completed' },
          { email: 'former@example.com', status: 'completed' }
        ]
      }
    });
    assert.equal(staleEvidence.steps.find((step) => step.key === 'signatures').status, 'pending');
  });

  it('marks condition report setup complete when a move-in report exists for this lease, even before inspection completion', () => {
    const result = buildLeaseMoveInReadiness({
      lease: { id: 136 },
      checklists: [{ id: 42, leaseId: 136, checklistType: 40, isCompleted: false }]
    });
    assert.equal(result.steps.find((step) => step.key === 'condition-report').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'pending');
  });

  it('recognizes all inspected items even when the separate completion flag is false', () => {
    for (const condition of ['GOOD', 'NR', 'FAIR']) {
      const checklist = { id: 42, leaseId: 136, checklistType: 40, isCompleted: false,
        items: [{ condition: 'GOOD' }, { condition }, { isChecked: true }] };
      const readiness = buildLeaseMoveInReadiness({ lease: { id: 136 }, checklists: [checklist] });
      const step = readiness.steps.find((item) => item.key === 'checklist');
      assert.equal(step.status, 'complete');
      assert.equal(step.detail, 'Completed checklist on file');
      const cards = buildLeaseChecklistCards({ readiness, lease: { id: 136 }, checklists: [checklist] });
      assert.equal(cards.steps.find((item) => item.key === 'checklist').status, 'complete');
      assert.equal(cards.completed, 1);
    }
  });

  it('does not infer completion from empty, partial, missing, or unsaved item records', () => {
    for (const record of [
      { id: 42, items: [] },
      { id: 42, items: [{ condition: 'GOOD' }, {}] },
      { id: 42 },
      { items: [{ condition: 'GOOD' }] }
    ]) {
      const result = buildLeaseMoveInReadiness({ lease: { id: 136 },
        checklists: [{ leaseId: 136, checklistType: 40, ...record }] });
      assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'pending');
    }
  });

  it('keeps fully inspected items scoped to the exact lease and checklist type', () => {
    const result = buildLeaseMoveInReadiness({ lease: { id: 136 }, checklists: [
      { id: 43, leaseId: 136, checklistType: 41, items: [{ condition: 'GOOD' }] },
      { id: 44, leaseId: 135, checklistType: 40, items: [{ condition: 'GOOD' }] }
    ] });
    assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'pending');
  });

  it('recognizes item completion for move-out within its existing visibility window', () => {
    const result = buildLeaseChecklistCards({ lease: { id: 136, endDate: '2026-01-06' },
      now: new Date('2026-01-01T12:00:00'), checklists: [
        { id: 43, leaseId: 136, checklistType: 41, isCompleted: false, items: [{ condition: 'NR' }] }
      ] });
    assert.equal(result.steps.find((step) => step.key === 'move-out').status, 'complete');
  });

  it('does not use a move-out report or a report belonging to another lease', () => {
    const result = buildLeaseMoveInReadiness({
      lease: { id: 136 },
      checklists: [
        { id: 43, leaseId: 136, checklistType: 41, isCompleted: true },
        { id: 44, leaseId: 135, checklistType: 40, isCompleted: true }
      ]
    });
    assert.equal(result.steps.find((step) => step.key === 'condition-report').status, 'pending');
    assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'pending');
  });

  it('does not infer condition-report or checklist completion, and omits untracked keys', () => {
    const result = buildLeaseMoveInReadiness({
      lease: { rentAmount: 1200, depositAmount: 0, rentCollectionByPlatform: true },
      tenants: [{ id: 1, firstname: 'A', lastname: 'B', email: 'a@example.com' }],
      leaseAgreement: null
    });
    assert.equal(result.steps.find((step) => step.key === 'rent-deposit').status, 'pending');
    assert.equal(result.steps.find((step) => step.key === 'condition-report').status, 'pending');
    assert.equal(result.steps.some((step) => step.key === 'keys'), false);
    assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'unavailable');

    const emptyRecords = buildLeaseMoveInReadiness({ ...completeInput, checklists: [] });
    assert.equal(emptyRecords.steps.find((step) => step.key === 'checklist').status, 'pending');
  });
});
