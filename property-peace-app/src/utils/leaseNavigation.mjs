export function getPropertyLeasesPath(propertyId) {
  return propertyId ? `/landlord/property/${propertyId}?tab=leases` : undefined;
}

export async function openLeaseWithPropertyHistory(navigate, location, propertyId, leasePath) {
  const propertyLeasesPath = getPropertyLeasesPath(propertyId);
  const onPropertyLeasesTab = location.pathname === `/landlord/property/${propertyId}`
    && new URLSearchParams(location.search).get('tab') === 'leases';

  if (propertyLeasesPath && !onPropertyLeasesTab) {
    await navigate(propertyLeasesPath);
  }

  await navigate(leasePath);
}
