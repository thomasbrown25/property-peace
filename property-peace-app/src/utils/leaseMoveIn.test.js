import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveExactLeaseSigners,
  selectCurrentSignatureStatus,
  validateExactLeaseSigners,
  buildLeaseMoveInReadiness
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

describe('buildLeaseMoveInReadiness', () => {
  const completeInput = {
    lease: {
      RentAmount: 1800,
      DepositAmount: 900,
      RentCollectionByPlatform: false,
      LandlordEmail: 'landlord@example.com',
      MoveInReportTemplateCompletedAt: '2026-08-01',
      LeaseAgreement: { LandlordSignedAt: '2026-08-02' }
    },
    tenants: [{ Id: 4, Firstname: 'Ada', Lastname: 'L', Email: 'ada@example.com', TenantSignedAt: '2026-08-03' }],
    leaseAgreement: { BlobUrl: 'https://example.test/lease.pdf' },
    checklists: [{ Id: 22, Status: 'Completed', CompletedAt: '2026-08-04' }]
  };

  it('computes readiness only from authoritative lease state and real checklist records', () => {
    const result = buildLeaseMoveInReadiness(completeInput);
    assert.equal(result.steps.find((step) => step.key === 'tenants').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'agreement').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'signatures').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'rent-deposit').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'condition-report').status, 'complete');
    assert.equal(result.steps.find((step) => step.key === 'keys').status, 'unavailable');
    assert.equal(result.steps.find((step) => step.key === 'keys').detail, 'Not tracked yet');
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

  it('never infers condition-report, keys, or checklist completion', () => {
    const result = buildLeaseMoveInReadiness({
      lease: { rentAmount: 1200, depositAmount: 0, rentCollectionByPlatform: true },
      tenants: [{ id: 1, firstname: 'A', lastname: 'B', email: 'a@example.com' }],
      leaseAgreement: null
    });
    assert.equal(result.steps.find((step) => step.key === 'rent-deposit').status, 'pending');
    assert.equal(result.steps.find((step) => step.key === 'condition-report').status, 'pending');
    assert.equal(result.steps.find((step) => step.key === 'keys').detail, 'Not tracked yet');
    assert.equal(result.steps.find((step) => step.key === 'checklist').status, 'unavailable');

    const emptyRecords = buildLeaseMoveInReadiness({ ...completeInput, checklists: [] });
    assert.equal(emptyRecords.steps.find((step) => step.key === 'checklist').status, 'pending');
  });
});
