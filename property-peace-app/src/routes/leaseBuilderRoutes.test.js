import { describe, expect, it } from 'vitest';
import { ACTIVE_LEASE_BUILDER_PATH, LEGACY_LEASE_BUILDER_PATHS, buildLeaseBuilderRedirect } from './leaseBuilderRoutes';

describe('legacy lease builder routes', () => {
  it('consolidates every legacy builder path on the active builder', () => {
    expect(ACTIVE_LEASE_BUILDER_PATH).toBe('/landlord/leases/build-lease-agreement');
    expect(LEGACY_LEASE_BUILDER_PATHS).toEqual([
      '/landlord/lease-agreement-builder',
      '/landlord/create-lease-agreement',
      '/landlord/leases/builder',
      '/landlord/lease-builder'
    ]);
  });

  it('preserves lease, property, unit, and other query state', () => {
    expect(buildLeaseBuilderRedirect('?leaseId=7&propertyId=8&unitId=9&step=pets')).toBe(
      '/landlord/leases/build-lease-agreement?leaseId=7&propertyId=8&unitId=9&step=pets'
    );
  });
});
