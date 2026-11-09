export const agreementSections = [
  { id: 'pets-smoking-other', title: 'Pets, smoking, & parking', description: 'Set pet and smoking policies and parking rules.', flag: 'isPetsSmokingOtherComplete' },
  { id: 'utilities-maintenance-keys', title: 'Utilities, maintenance, & keys', description: 'Assign responsibilities and specify the keys provided.', flag: 'isUtilitiesMaintenanceKeysComplete' },
  { id: 'provisions-attachments', title: 'Provisions & disclosures', description: 'Add early termination, additional terms, and lead-paint disclosures.', flag: 'isProvisionsAttachmentsComplete' }
];
export const readAgreement = (object, key) => object?.[key] ?? object?.[key[0].toUpperCase() + key.slice(1)];
export const agreementMoney = (value) => value == null || value === '' ? 'Not set' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
export const agreementDate = (value) => {
  if (!value) return 'Not set';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : 'Not set';
};
export const agreementPerson = (person) => readAgreement(person, 'companyName') ||
  [readAgreement(person, 'firstName') || person?.firstname, readAgreement(person, 'lastName') || person?.lastname].filter(Boolean).join(' ') || readAgreement(person, 'email') || 'Unnamed person';
export function agreementLocked(lease, instances = []) {
  const agreement = readAgreement(lease, 'leaseAgreement');
  // IsDrafted describes the legacy lease setup state, not document immutability.
  return Boolean(readAgreement(agreement, 'landlordSignedAt') || readAgreement(agreement, 'signatureCompletedAt') ||
    readAgreement(agreement, 'docuSignEnvelopeId') || readAgreement(agreement, 'signedDocumentBlobUrl') ||
    instances.some((instance) => readAgreement(instance, 'isFinalized') === true));
}
export function requireAgreementData(response, fallback) {
  if (!response || response.success !== true || response.data == null) throw new Error(response?.message || fallback);
  return response.data;
}
export async function loadAgreementContext(leaseId, get) {
  if (!Number.isSafeInteger(leaseId) || leaseId <= 0) throw new Error('Choose a saved lease before building an agreement.');
  const lease = requireAgreementData((await get(`/api/Lease/${leaseId}`)).data, 'Could not load the saved lease.');
  if (Number(readAgreement(lease, 'id')) !== leaseId) throw new Error('The requested lease could not be found.');
  const instances = requireAgreementData((await get(`/api/LeaseGeneration/lease/${leaseId}/instances`)).data, 'Could not check agreement status.');
  if (!Array.isArray(instances)) throw new Error('Could not check agreement status.');
  return { lease, instances, locked: agreementLocked(lease, instances) };
}
export function agreementLeaseFacts(lease) {
  const read = (key) => readAgreement(lease, key);
  const names = (key) => (read(key) || []).map(agreementPerson).join(', ') || 'None';
  const monthly = Number(read('leaseLength')) === -1;
  return [
    ['Property', read('propertyName') || `Property #${read('propertyId')}`],
    ['Unit', read('unitName') || `Unit #${read('unitId')}`],
    ['Lease term', monthly ? 'Month-to-month' : 'Fixed term'],
    ['Start date', agreementDate(read('startDate'))],
    ['End date', monthly ? 'No fixed end date' : agreementDate(read('endDate'))],
    [`Rent (${read('rentFrequency') || 'Monthly'})`, agreementMoney(read('rentAmount'))],
    ['Rent due day', read('rentDueDay') ?? 'Not set'],
    ['Security deposit', agreementMoney(read('depositAmount'))],
    ['Pet deposit', agreementMoney(read('petDepositAmount'))],
    ['Tenants', names('tenants')],
    ['Landlords', names('leaseLandlords') === 'None' ? read('landlordName') || 'Not set' : names('leaseLandlords')],
    ['Cosigners', names('leaseCoSigners')], ['Additional signers', names('leaseAdditionalSigners')], ['Other occupants', names('leaseOccupants')],
    ['Other deposits', (read('leaseDeposits') || []).map((item) => `${readAgreement(item, 'name')}: ${agreementMoney(readAgreement(item, 'amount'))}`).join('; ') || 'None'],
    ['Fees', (read('fees') || []).map((fee) => `${readAgreement(fee, 'name')}: ${String(readAgreement(fee, 'feeType') || '').startsWith('Percent') ? `${readAgreement(fee, 'percentValue') ?? readAgreement(fee, 'amount')}%` : agreementMoney(readAgreement(fee, 'amount'))}`).join('; ') || 'None']
  ];
}
