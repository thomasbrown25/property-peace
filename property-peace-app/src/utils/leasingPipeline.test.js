import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEASING_STAGE_ORDER,
  getPipelineStages,
  validatePipelineContract,
  getSafePrimaryAction,
  getSafeBlockerMessage,
  isSafeLeasingRoute,
  buildLeasingPipelineKey,
  isLeasingPipelineKeyForTenant,
  buildApprovedApplicationLeaseContext,
  runLeasingPrimaryAction
} from './leasingPipeline.js';

const descriptors = LEASING_STAGE_ORDER.map((stage, order) => ({
  stage,
  order,
  isComplete: order < 4,
  isCurrent: order === 4
}));

test('builds one tenant-scoped canonical SWR key and fails closed without exact identity', () => {
  assert.deepEqual(buildLeasingPipelineKey({
    userId: 7,
    organizationId: 9,
    resourceType: 'application',
    resourceId: '42'
  }), ['/api/leasing-pipeline', 7, 9, 'application', 42, null]);
  assert.equal(buildLeasingPipelineKey({ userId: 7, resourceType: 'application', resourceId: 42 }), null);
  assert.equal(buildLeasingPipelineKey({ userId: 7, organizationId: 9, resourceType: 'application', resourceId: -1 }), null);
});

test('matches only canonical leasing-pipeline keys for the exact tenant', () => {
  const application = ['/api/leasing-pipeline', 7, 9, 'application', 42, null];
  const property = ['/api/leasing-pipeline', 7, 9, 'property', 10, 11];
  assert.equal(isLeasingPipelineKeyForTenant(application, 7, 9), true);
  assert.equal(isLeasingPipelineKeyForTenant(property, 7, 9), true);
  assert.equal(isLeasingPipelineKeyForTenant(application, 8, 9), false);
  assert.equal(isLeasingPipelineKeyForTenant(application, 7, 10), false);
  assert.equal(isLeasingPipelineKeyForTenant(['/api/other', 7, 9, 'application', 42, null], 7, 9), false);
  for (const malformed of [
    null,
    ['/api/leasing-pipeline', 7, 9, 'application', 42],
    ['/api/leasing-pipeline', 7, 9, 'lease', 42, null],
    ['/api/leasing-pipeline', 7, 9, 'application', -1, null],
    ['/api/leasing-pipeline', 7, 9, 'property', 10, null],
    ['/api/leasing-pipeline', 7, 9, 'listing', 10, 'unsafe']
  ]) assert.equal(isLeasingPipelineKeyForTenant(malformed, 7, 9), false);
  assert.equal(isLeasingPipelineKeyForTenant(application, null, 9), false);
  assert.equal(isLeasingPipelineKeyForTenant(application, 7, ''), false);
});

test('uses the exact ordered 11-stage lifecycle and explicit backend state only', () => {
  assert.deepEqual(LEASING_STAGE_ORDER, [
    'vacant', 'listed', 'lead', 'showingScheduled', 'applied', 'screening',
    'approved', 'leaseDraft', 'signaturePending', 'moveInReady', 'occupied'
  ]);
  assert.deepEqual(getPipelineStages({ currentStage: 'applied', stages: descriptors }).map(({ label, state }) => [label, state]), [
    ['Vacant', 'complete'], ['Listed', 'complete'], ['Lead', 'complete'], ['Showing scheduled', 'complete'],
    ['Applied', 'current'], ['Screening', 'future'], ['Approved', 'future'], ['Lease draft', 'future'],
    ['Signature pending', 'future'], ['Move-in ready', 'future'], ['Occupied', 'future']
  ]);
  const contradictoryCompletion = getPipelineStages({
    currentStage: 'approved',
    stages: descriptors.map((item) => ({ ...item, isComplete: false, isCurrent: item.stage === 'approved' }))
  });
  assert.equal(contradictoryCompletion, null);
});

test('shows one sanitized structured blocker and never leaks unknown backend content', () => {
  assert.equal(getSafeBlockerMessage({ code: 'screeningUnavailable', message: 'Tenant screening is not currently ready.' }), 'Tenant screening isn’t ready yet.');
  assert.equal(getSafeBlockerMessage({ code: 'eSignatureUnavailable', message: 'raw URL https://secret.test/report' }), 'Electronic signature isn’t ready yet.');
  assert.equal(getSafeBlockerMessage({ code: 'unknown', message: 'SSN 123 secret reason' }), null);
});

test('strictly rejects malformed lifecycle contracts instead of synthesizing stages', () => {
  const valid = { currentStage: 'applied', stages: descriptors };
  assert.equal(validatePipelineContract(valid), true);
  const invalid = [
    { ...valid, stages: descriptors.slice(1) },
    { ...valid, stages: [...descriptors.slice(0, 2), descriptors[1], ...descriptors.slice(3)] },
    { ...valid, stages: descriptors.map((item, index) => index === 2 ? { ...item, stage: 'unknown' } : item) },
    { ...valid, stages: [descriptors[1], descriptors[0], ...descriptors.slice(2)] },
    { ...valid, stages: descriptors.map((item, index) => ({ ...item, isCurrent: index === 4 || index === 5 })) },
    { ...valid, stages: descriptors.map((item) => ({ ...item, isCurrent: false })) },
    { ...valid, currentStage: 'approved' },
    { ...valid, stages: descriptors.map((item, index) => index === 0 ? { ...item, isComplete: false } : item) }
  ];
  invalid.forEach((pipeline) => {
    assert.equal(validatePipelineContract(pipeline), false);
    assert.equal(getPipelineStages(pipeline), null);
  });
});

test('allowlists every projector action into truthful routes using validated IDs only', () => {
  const refs = { listingId: 31, applicationId: 42, leaseId: 53 };
  const cases = [
    ['createListing', {}, 'Create listing', '/landlord/listings/add'],
    ['inviteApplicant', {}, 'Review listing', '/landlord/listings/31'],
    ['scheduleShowing', {}, 'Review listing', '/landlord/listings/31'],
    ['manageShowing', {}, 'Review listing', '/landlord/listings/31'],
    ['requestScreening', { applicationId: 42 }, 'Review application', '/landlord/applications?applicationId=42'],
    ['reviewApplication', {}, 'Review application', '/landlord/applications?applicationId=42'],
    ['createLease', {}, 'Create lease', '/landlord/leases/selection'],
    ['sendForSignature', { leaseId: 53 }, 'Review lease', '/landlord/leases/53'],
    ['reviewLease', {}, 'Review lease', '/landlord/leases/53'],
    ['trackSignatures', {}, 'Review lease', '/landlord/leases/53'],
    ['prepareMoveIn', {}, 'Review lease', '/landlord/leases/53']
  ];
  cases.forEach(([code, data, label, route]) => assert.deepEqual(
    getSafePrimaryAction({ code, data }, code === 'createListing' ? 'vacant' : 'applied', refs),
    { label, route }
  ));
  assert.equal(getSafePrimaryAction({ code: 'reviewApplication', data: { applicationId: -1 } }, 'applied', {}), null);
  assert.equal(getSafePrimaryAction({ code: 'reviewApplication', data: { applicationId: '42' } }, 'applied', {}), null);
  assert.equal(getSafePrimaryAction({ code: 'unknown', data: { route: 'javascript:alert(1)' }, label: 'Pwn' }, 'applied', refs), null);
  assert.equal(getSafePrimaryAction({ code: 'reviewLease', data: { leaseId: 53 }, route: 'https://evil.test' }, 'occupied', refs), null);
});

test('only permits real internal Property Peace action routes', () => {
  assert.equal(isSafeLeasingRoute('/landlord/applications?applicationId=42'), true);
  assert.equal(isSafeLeasingRoute('/landlord/leases/42'), true);
  assert.equal(isSafeLeasingRoute('/landlord/listings/42'), true);
  for (const route of ['https://evil.test', '//evil.test', 'javascript:alert(1)', '/admin/users', '/arbitrary/place', '/landlord/applications/42?token=secret']) {
    assert.equal(isSafeLeasingRoute(route), false, route);
  }
  assert.equal(isSafeLeasingRoute('/landlord/applications/42'), false);
  assert.equal(isSafeLeasingRoute('/landlord/screenings/42'), false);
});

test('builds only a scoped, approved application lease context from real safe fields', () => {
  const property = {
    id: 10,
    name: 'Maple House',
    monthlyRent: 1450,
    units: [{ id: 11, name: 'A', advertisedRent: 1500 }]
  };
  const application = {
    id: 42,
    status: 'Approved',
    propertyId: 10,
    unitId: 11,
    firstName: '  Ada ',
    lastName: ' Lovelace  ',
    email: ' ada@example.test ',
    desiredMoveInDate: '2027-02-03T00:00:00Z',
    secret: 'must not pass through'
  };

  assert.deepEqual(buildApprovedApplicationLeaseContext(application, [property]), {
    property,
    applicationContext: {
      applicationId: 42,
      propertyId: 10,
      unitId: 11,
      applicantName: 'Ada Lovelace',
      applicantEmail: 'ada@example.test',
      desiredMoveInDate: '2027-02-03',
      rentAmount: 1500
    }
  });
  assert.equal(buildApprovedApplicationLeaseContext({ ...application, status: 'Submitted' }, [property]), null);
  assert.equal(buildApprovedApplicationLeaseContext({ ...application, id: '42' }, [property]), null);
  assert.equal(buildApprovedApplicationLeaseContext({ ...application, unitId: 99 }, [property]), null);
  assert.equal(buildApprovedApplicationLeaseContext(application, [{ ...property, id: 99 }]), null);
  assert.deepEqual(
    buildApprovedApplicationLeaseContext(application, [{ id: 10, monthlyRent: 1400 }])?.applicationContext,
    { applicationId: 42, propertyId: 10, unitId: 11, applicantName: 'Ada Lovelace', applicantEmail: 'ada@example.test', desiredMoveInDate: '2027-02-03', rentAmount: 1400 }
  );
});

test('application lease prefill omits invalid dates, rent, and optional applicant fields', () => {
  const property = { id: 10, units: [{ id: 11, advertisedRent: 0 }] };
  assert.deepEqual(buildApprovedApplicationLeaseContext({
    id: 42, status: 3, propertyId: 10, unitId: 11, desiredMoveInDate: 'not-a-date'
  }, [property]), {
    property,
    applicationContext: {
      applicationId: 42,
      propertyId: 10,
      unitId: 11
    }
  });
});

test('routes create actions through provided callbacks while preserving navigation fallback', () => {
  const calls = [];
  const callbacks = {
    onCreateListing: () => calls.push('listing'),
    onCreateLease: () => calls.push('lease'),
    navigate: (route) => calls.push(route)
  };
  assert.equal(runLeasingPrimaryAction('createLease', callbacks, '/landlord/leases/selection'), true);
  assert.equal(runLeasingPrimaryAction('createListing', callbacks, '/landlord/listings/add'), true);
  assert.equal(runLeasingPrimaryAction('reviewLease', callbacks, '/landlord/leases/53'), true);
  assert.deepEqual(calls, ['lease', 'listing', '/landlord/leases/53']);
  assert.equal(runLeasingPrimaryAction('createLease', { navigate: callbacks.navigate }, '/landlord/leases/selection'), true);
  assert.equal(calls.at(-1), '/landlord/leases/selection');
  assert.equal(runLeasingPrimaryAction('reviewLease', callbacks, 'javascript:alert(1)'), false);
});
