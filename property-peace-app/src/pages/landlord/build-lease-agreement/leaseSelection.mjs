import { readAgreement } from './agreementWorkflow.mjs';

export const agreementBuilderPath = (leaseId) => {
  const id = Number(leaseId);
  return `/landlord/leases/build-lease-agreement${Number.isSafeInteger(id) && id > 0 ? `?leaseId=${id}` : ''}`;
};

// Use all saved leases, not just each unit's current active lease projection.
export async function loadAgreementLeaseOptions(properties, get) {
  const lists = await Promise.all(properties.map(async (property) => {
    const propertyId = readAgreement(property, 'id');
    const response = (await get(`/api/lease/property/${propertyId}/all`)).data;
    if (response?.success !== true || !Array.isArray(response.data)) {
      throw new Error('Could not load saved leases. Please retry.');
    }
    return response.data.filter((lease) => readAgreement(lease, 'isDeleted') !== true).map((lease) => ({
      ...lease,
      id: Number(readAgreement(lease, 'id')),
      unitName: readAgreement(lease, 'unitName') || readAgreement((readAgreement(property, 'units') || [])
        .find((unit) => Number(readAgreement(unit, 'id')) === Number(readAgreement(lease, 'unitId'))), 'name'),
      propertyName: readAgreement(property, 'name') || readAgreement(property, 'streetAddress') || readAgreement(lease, 'propertyName') || `Property #${propertyId}`
    }));
  }));
  return [...new Map(lists.flat().filter((lease) => Number.isSafeInteger(lease.id) && lease.id > 0)
    .map((lease) => [lease.id, lease])).values()];
}
