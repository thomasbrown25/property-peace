// Keep desktop overflow organization separate from the shared drawer/mobile menu.
export function groupLandlordMoreNavigation(groups) {
  const propertyItemIds = new Set(['properties-page', 'leases', 'tenants']);
  const propertyItems = groups.flatMap((group) => group.children.filter((item) => propertyItemIds.has(item.id)));

  return groups.map((group) => ({
    ...group,
    children: group.id === 'group-property-operations'
      ? [...propertyItems, ...group.children.filter((item) => !propertyItemIds.has(item.id))]
      : group.children.filter((item) => !propertyItemIds.has(item.id))
  })).filter((group) => group.children.length);
}
