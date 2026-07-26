export const ACTIVE_LEASE_BUILDER_PATH = '/landlord/leases/build-lease-agreement';

export const LEGACY_LEASE_BUILDER_PATHS = [
  '/landlord/lease-agreement-builder',
  '/landlord/create-lease-agreement',
  '/landlord/leases/builder',
  '/landlord/lease-builder'
];

export const buildLeaseBuilderRedirect = (search = '') =>
  `${ACTIVE_LEASE_BUILDER_PATH}${search && !search.startsWith('?') ? `?${search}` : search}`;
