// Operational lease fields only. Agreement clauses and completion flags belong to the agreement builder.
export const readSetup = (object, key) => object?.[key] ?? object?.[key[0].toUpperCase() + key.slice(1)];
export const setupId = (object) => Number(readSetup(object, 'id')) || null;
export const setupDefaults = () => ({
  name: '', propertyId: '', unitId: '', startDate: '', endDate: '', termType: 'fixed',
  rentFrequency: 'Monthly', rentAmount: '', rentDueDay: 1, depositAmount: '', petDepositAmount: '',
  proratedRentDue: false, prorationMethod: 'calculated', proratedRentAmount: '',
  autoRenewLease: false, autoRenewLeaseLength: 12, autoRenewRentIncrement: false,
  autoRenewRentIncrementType: 'percentage', autoRenewRentIncrementValue: '',
  rentCollectionByPlatform: false, rentCollectionOther: false, rentCollectionOtherOptions: {}, rentCollectionOtherSpecify: '',
  fees: [], leaseDeposits: [], leaseLandlords: [], leaseCoSigners: [], leaseAdditionalSigners: [], leaseOccupants: [],
  addTenantsLater: false, tenantMailingAddressDiffers: false, tenantMailingStreetAddress: '', tenantMailingUnit: '',
  tenantMailingCity: '', tenantMailingState: '', tenantMailingZipCode: '', markPastPaymentsAsPaid: false
});
export function setupFromLease(lease) {
  const values = setupDefaults();
  for (const key of Object.keys(values)) values[key] = readSetup(lease, key) ?? values[key];
  values.startDate = values.startDate?.slice(0, 10) || '';
  values.endDate = values.endDate?.slice(0, 10) || '';
  values.termType = Number(readSetup(lease, 'leaseLength')) === -1 || !values.endDate ? 'monthly' : 'fixed';
  for (const key of ['fees', 'leaseDeposits', 'leaseLandlords', 'leaseCoSigners', 'leaseAdditionalSigners', 'leaseOccupants']) {
    values[key] = values[key].map((item) => Object.fromEntries(Object.entries(item).map(([k, v]) => [k[0].toLowerCase() + k.slice(1), v])));
  }
  try { if (typeof values.rentCollectionOtherOptions === 'string') values.rentCollectionOtherOptions = JSON.parse(values.rentCollectionOtherOptions); }
  catch { values.rentCollectionOtherOptions = {}; }
  return values;
}
const numeric = (value) => value === '' || value == null ? null : Number(value);
export function setupPayload(values, existing = null, organizationId = null) {
  // Preserve unrelated operational fields on edit, but never send agreement state/navigation projections.
  const preserved = {};
  for (const key of ['organizationId', 'operatingAccountId', 'isActive', 'isScreeningComplete', 'overdueAmount',
    'rentIncreaseType', 'rentIncreaseValue', 'rentIncreaseInterval', 'createChecklistOnStartDate',
    'petsAllowed', 'smokingAllowed', 'pets', 'parking', 'hasSharedUtilities', 'sharedUtilitiesDisclosure',
    'maintenanceNotificationMethods', 'utilityServiceResponsibilities', 'maintenanceResponsibilities', 'leaseKeys',
    'includeEarlyTerminationClause', 'earlyTerminationClauseText', 'additionalTerms', 'builtBefore1978',
    'awareOfLeadPaint', 'leadPaintExplanation', 'hasLeadPaintRecords', 'leadPaintRecordsExplanation']) {
    const value = readSetup(existing, key);
    if (value !== undefined) preserved[key] = value;
  }
  const { termType, ...fields } = values;
  const fixed = termType === 'fixed';
  const start = new Date(`${values.startDate}T00:00:00Z`);
  const end = fixed ? new Date(`${values.endDate}T00:00:00Z`) : null;
  const autoRenew = fixed && values.autoRenewLease;
  const payload = {
    ...preserved, ...fields, id: setupId(existing) || 0,
    organizationId: readSetup(existing, 'organizationId') ?? organizationId,
    propertyId: Number(values.propertyId), unitId: Number(values.unitId), name: values.name.trim() || null,
    startDate: `${values.startDate}T00:00:00`, endDate: fixed ? `${values.endDate}T00:00:00` : null,
    leaseLength: fixed ? Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()) : -1,
    customDateSelected: fixed, isActive: readSetup(existing, 'isActive') ?? true,
    rentAmount: numeric(values.rentAmount), rentDueDay: Number(values.rentDueDay),
    depositAmount: numeric(values.depositAmount), petDepositAmount: numeric(values.petDepositAmount),
    proratedRentAmount: values.proratedRentDue ? numeric(values.proratedRentAmount) : null,
    isProratedRent: values.proratedRentDue,
    autoRenewLease: autoRenew, autoRenewLeaseLength: autoRenew ? Number(values.autoRenewLeaseLength) : null,
    autoRenewRentIncrement: autoRenew && values.autoRenewRentIncrement,
    autoRenewRentIncrementType: autoRenew && values.autoRenewRentIncrement ? values.autoRenewRentIncrementType : null,
    autoRenewRentIncrementValue: autoRenew && values.autoRenewRentIncrement ? numeric(values.autoRenewRentIncrementValue) : null,
    rentCollectionOtherOptions: JSON.stringify(values.rentCollectionOtherOptions),
    fees: values.fees.map((fee) => ({ ...fee, id: fee.id || 0, leaseId: setupId(existing) || 0,
      amount: Number(fee.amount || 0), dueDate: fee.dueDate || `${values.startDate}T00:00:00` })),
    leaseDeposits: values.leaseDeposits.map((deposit, index) => ({ ...deposit, amount: Number(deposit.amount),
      dueDate: deposit.dueDate || `${values.startDate}T00:00:00`, sortOrder: index }))
  };
  return payload;
}
export function requireSetupSuccess(response, fallback) {
  if (!response || response.success !== true) throw new Error(response?.message || fallback);
  return response.data;
}
// The checkpoint is updated immediately after each successful server operation. Retrying only links
// outstanding tenants; it never repeats the lease POST or successful links after a partial failure.
export async function persistLeaseSetup({ payload, tenants, checkpoint, saveLease, linkTenant, unlinkTenant, onCheckpoint }) {
  if (checkpoint.saveUncertain) throw new Error('The server saved a lease without returning its ID. Check your leases before starting another lease.');
  if (!checkpoint.leaseId) {
    const saved = requireSetupSuccess(await saveLease(payload), 'Could not save the lease.');
    const id = setupId(saved);
    if (!id) {
      checkpoint.saveUncertain = true;
      throw new Error('The server did not return a saved lease ID. Check your leases before trying again.');
    }
    checkpoint.leaseId = id;
    checkpoint.propertyId = payload.propertyId;
    checkpoint.unitId = payload.unitId;
    onCheckpoint?.({ ...checkpoint });
  }
  const selectedIds = new Set(tenants.map(setupId));
  for (const id of checkpoint.linked) {
    if (selectedIds.has(id)) continue;
    requireSetupSuccess(await unlinkTenant(checkpoint.leaseId, id), 'Lease saved, but a tenant could not be removed. Retry to finish.');
    checkpoint.linked.delete(id);
  }
  for (const tenant of tenants) {
    const id = setupId(tenant);
    if (!id) throw new Error('A selected tenant has no valid ID.');
    if (checkpoint.linked.has(id)) continue;
    requireSetupSuccess(await linkTenant(checkpoint.leaseId, id), 'Lease saved, but a tenant could not be linked. Retry to finish.');
    checkpoint.linked.add(id);
  }
  return { id: checkpoint.leaseId, propertyId: checkpoint.propertyId, unitId: checkpoint.unitId };
}
export function setupDestinations(saved) {
  if (!saved?.id || !saved.propertyId || !saved.unitId) throw new Error('Saved lease context is required.');
  return { view: `/landlord/leases/${saved.id}`,
    agreement: `/landlord/leases/build-lease-agreement?leaseId=${saved.id}&propertyId=${saved.propertyId}&unitId=${saved.unitId}` };
}
