import test from 'node:test';
import assert from 'node:assert/strict';

const renterWorkspace = await import('./renterWorkspace.js').catch(() => ({}));

const call = (name, ...args) => {
  const fn = renterWorkspace[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
};

test('Leases workspace tab is selected from the canonical tab query value', () => {
  assert.equal(call('leasesWorkspaceTabFromSearch', '?tab=tenants'), 'tenants');
  assert.equal(call('leasesWorkspaceTabFromSearch', new URLSearchParams('tab=agreements')), 'agreements');
  assert.equal(call('leasesWorkspaceTabFromSearch', '?tab=unknown'), 'leases');
  assert.equal(call('leasesWorkspaceTabFromSearch', '?view=history'), 'leases');
});

test('changing Leases workspace tabs keeps only query state that belongs to the destination', () => {
  assert.equal(call('leasesWorkspaceSearch', 'tenants', '?view=history&search=oak'), '?tab=tenants');
  assert.equal(call('leasesWorkspaceSearch', 'agreements', '?view=history'), '?tab=agreements');
  assert.equal(call('leasesWorkspaceSearch', 'leases', '?tab=tenants&view=history'), '?view=history');
  assert.equal(call('leasesWorkspaceSearch', 'leases', '?tab=tenants'), '');
});

test('renter profile tab accepts only the six supported URL keys', () => {
  for (const key of ['profile', 'leases', 'transactions', 'insurance', 'applications', 'requests']) {
    assert.equal(call('renterProfileTabFromSearch', `?tab=${key}`), key);
  }
  assert.equal(call('renterProfileTabFromSearch', '?tab=messages'), 'profile');
  assert.equal(call('renterProfileTabFromSearch', ''), 'profile');
});

test('tenant-directory and renter-profile links use their canonical destinations', () => {
  assert.equal(call('tenantDirectoryRoute'), '/landlord/leases?tab=tenants');
  assert.equal(call('renterProfileRoute', 78), '/landlord/renters/78');
  assert.equal(call('renterProfileRoute', '78'), '/landlord/renters/78');
  assert.equal(call('renterProfileRoute', 0), null);
  assert.equal(call('renterProfileRoute', 'not-an-id'), null);
});

test('applications use exact converted renter identity and only unconverted exact-email legacy fallback', () => {
  const renter = { id: 78, email: ' renter@example.com ' };
  const applications = [
    { id: 1, convertedToTenantId: 78, email: 'old@example.com' },
    { id: 2, ConvertedToTenantId: null, email: 'RENTER@example.com' },
    { id: 3, convertedToTenantId: 99, email: 'renter@example.com' },
    { id: 4, convertedToTenantId: null, email: 'someone@example.com' }
  ];

  assert.deepEqual(call('applicationsForRenter', applications, renter).map((item) => item.id), [1, 2]);
});

test('maintenance requests require exact submitter renter identity and never match by shared unit', () => {
  const requests = [
    { id: 1, submittedByTenantId: 78, unitId: 5 },
    { id: 2, SubmittedByTenantId: 78, unitId: 6 },
    { id: 3, submittedByTenantId: 99, unitId: 5 },
    { id: 4, submittedByTenantId: null, unitId: 5 }
  ];

  assert.deepEqual(call('requestsForRenter', requests, 78).map((item) => item.id), [1, 2]);
});

test('insurance documents include only renter and liability insurance types', () => {
  const documents = [
    { id: 1, documentType: 20 },
    { id: 2, DocumentType: 21 },
    { id: 3, documentType: 'RenterInsurance' },
    { id: 4, documentType: 'Liability Insurance' },
    { id: 5, documentType: 1 },
    { id: 6, documentType: 'Lease Agreement' }
  ];

  assert.deepEqual(call('insuranceDocumentsForRenter', documents).map((item) => item.id), [1, 2, 3, 4]);
});

test('renter leases are deduplicated and ordered active, draft, then recent history', () => {
  const leases = [
    { id: 3, isActive: false, endDate: '2024-01-01' },
    { Id: 2, IsDrafted: true, StartDate: '2026-09-01' },
    { id: 1, isActive: true, startDate: '2026-01-01' },
    { Id: 3, IsActive: false, EndDate: '2025-01-01' }
  ];

  const result = call('dedupeAndOrderRenterLeases', leases);
  assert.deepEqual(result.map((item) => item.id ?? item.Id), [1, 2, 3]);
  assert.equal(result[2].EndDate, '2025-01-01');
});
