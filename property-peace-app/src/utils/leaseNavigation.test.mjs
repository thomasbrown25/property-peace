import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryRouter } from 'react-router-dom';
import { openLeaseWithPropertyHistory } from './leaseNavigation.mjs';

const leasePath = '/landlord/leases/42';
const propertyPath = '/landlord/property/7';
const propertyLeasesPath = `${propertyPath}?tab=leases`;

for (const origin of ['/landlord/leases?view=renewals', propertyPath]) {
  test(`Back opens the property Leases tab after opening a lease from ${origin}`, async () => {
    const router = createMemoryRouter([{ path: '*' }], { initialEntries: [origin] });
    await openLeaseWithPropertyHistory(router.navigate, router.state.location, 7, leasePath);
    assert.equal(router.state.location.pathname, leasePath);

    await router.navigate(-1);
    assert.equal(router.state.location.pathname + router.state.location.search, propertyLeasesPath);

    await router.navigate(-1);
    assert.equal(router.state.location.pathname + router.state.location.search, origin);

    await router.navigate(2);
    assert.equal(router.state.location.pathname, leasePath);
  });
}

test('opening a lease from the property Leases tab reuses its history entry', async () => {
  const router = createMemoryRouter([{ path: '*' }], { initialEntries: [propertyPath, propertyLeasesPath] });
  await openLeaseWithPropertyHistory(router.navigate, router.state.location, 7, leasePath);

  await router.navigate(-1);
  assert.equal(router.state.location.search, '?tab=leases');
  await router.navigate(-1);
  assert.equal(router.state.location.search, '');
});
