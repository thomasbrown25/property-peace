export function buildLegacyFinancesRedirect(search, { tab, propertyId } = {}) {
  const searchParams = new URLSearchParams(search);

  if (propertyId) searchParams.set('propertyId', propertyId);
  searchParams.set('tab', tab);

  return '/landlord/finances?' + searchParams.toString();
}
