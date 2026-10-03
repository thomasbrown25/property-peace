// Preserve the unit's current projection for the rest of the detail page while
// selecting the actual contract requested by the route, including successors.
export function leaseById(properties, leaseId) {
  if (leaseId == null) return undefined;
  for (const property of properties ?? []) {
    for (const unit of property.units ?? property.Units ?? []) {
      const current = unit.lease ?? unit.Lease ?? unit.activeLease ?? unit.ActiveLease;
      const contracts = unit.leases ?? unit.Leases ?? [];
      const match = [current, ...contracts].find((item) => item && String(item.id ?? item.Id) === String(leaseId));
      if (match) return { ...match, unit, propertyName: property.name ?? property.Name };
    }
  }
  return undefined;
}
