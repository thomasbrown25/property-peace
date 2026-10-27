// Only the authorized property list can determine navigation capability. A missing mode
// is a legacy long-term unit; an empty or unavailable list is not short-term-only.
export const isShortTermOnlyPortfolio = ({ properties, loadedOrganizationId, organizationId, loadedAt }) => {
  if (organizationId == null || loadedOrganizationId == null || String(organizationId) !== String(loadedOrganizationId) || !loadedAt || !Array.isArray(properties)) return false;
  const units = properties.flatMap((property) => property?.units ?? property?.Units ?? []);
  return units.length > 0 && units.every((unit) => (unit?.rentalMode ?? unit?.RentalMode ?? 'longTerm') === 'shortTerm');
};

// Filter navigation only. Historical leases/listings still work via their direct routes.
export const landlordPagesForInventory = (pages, shortTermOnly) =>
  shortTermOnly
    ? pages.map((group) => ({
        ...group,
        children: group.children?.filter((item) => item.id !== 'leases' && item.id !== 'listings')
      }))
    : pages;
