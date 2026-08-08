const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

export const normalizeLeaseText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

const normalizeEmail = (value) => normalizeLeaseText(value).toLowerCase();

const tenantId = (tenant) => firstDefined(tenant?.tenantId, tenant?.TenantId, tenant?.id, tenant?.Id);
const tenantFirstName = (tenant) => firstDefined(tenant?.firstName, tenant?.firstname, tenant?.FirstName, tenant?.Firstname);
const tenantLastName = (tenant) => firstDefined(tenant?.lastName, tenant?.lastname, tenant?.LastName, tenant?.Lastname);
const tenantEmail = (tenant) => firstDefined(tenant?.email, tenant?.Email);

export function selectCurrentSignatureStatus(record, leaseId, envelopeId) {
  if (!record || leaseId == null || envelopeId == null) return null;
  return String(record.leaseId) === String(leaseId) &&
    String(record.envelopeId) === String(envelopeId)
    ? record.data ?? null
    : null;
}

export function deriveExactLeaseSigners(tenants = []) {
  if (!Array.isArray(tenants)) return [];

  return tenants.map((tenant, index) => ({
    tenantId: Number(tenantId(tenant)),
    name: normalizeLeaseText([tenantFirstName(tenant), tenantLastName(tenant)].filter((part) => normalizeLeaseText(part)).join(' ')),
    email: normalizeEmail(tenantEmail(tenant)),
    signingOrder: index + 1
  }));
}

export function validateExactLeaseSigners(signers) {
  const errors = [];
  if (!Array.isArray(signers) || signers.length === 0) {
    return { valid: false, errors: ['At least one current lease tenant is required.'] };
  }

  const ids = [];
  signers.forEach((signer, index) => {
    const id = Number(signer?.tenantId);
    if (!Number.isInteger(id) || id <= 0) errors.push(`Signer ${index + 1} must have a positive tenant ID.`);
    else ids.push(id);
    if (!normalizeLeaseText(signer?.name)) errors.push(`Signer ${index + 1} must have a name.`);
    if (!normalizeEmail(signer?.email)) errors.push(`Signer ${index + 1} must have an email.`);
  });

  if (new Set(ids).size !== ids.length) errors.push('Tenant IDs must be unique.');
  return { valid: errors.length === 0, errors };
}

const hasAgreementFile = (agreement) => Boolean(firstDefined(
  agreement?.blobUrl,
  agreement?.BlobUrl,
  agreement?.blobName,
  agreement?.BlobName
));

const isTenantSigned = (tenant) => Boolean(firstDefined(
  tenant?.tenantSignedAt,
  tenant?.TenantSignedAt,
  tenant?.signedAt,
  tenant?.SignedAt
));

const isChecklistComplete = (record) => {
  const id = firstDefined(record?.id, record?.Id, record?.checklistId, record?.ChecklistId);
  if (id === undefined || id === null) return false;
  const status = normalizeLeaseText(firstDefined(record?.status, record?.Status)).toLowerCase();
  return Boolean(firstDefined(record?.completedAt, record?.CompletedAt)) || status === 'completed' || status === 'complete';
};

export function buildLeaseMoveInReadiness({
  lease = {},
  tenants = [],
  leaseAgreement = null,
  rentRecord = null,
  property = null,
  signatureStatus = null,
  checklists
} = {}) {
  const currentTenants = Array.isArray(tenants) ? tenants : [];
  const agreement = firstDefined(lease?.leaseAgreement, lease?.LeaseAgreement, leaseAgreement) || {};
  const agreementGenerated = hasAgreementFile(leaseAgreement) || hasAgreementFile(agreement);
  const landlordSigned = Boolean(firstDefined(agreement?.landlordSignedAt, agreement?.LandlordSignedAt, lease?.landlordSignedAt, lease?.LandlordSignedAt));
  const persistedSignatureStatus = firstDefined(
    signatureStatus?.status,
    signatureStatus?.Status,
    agreement?.signatureStatus,
    agreement?.SignatureStatus,
    lease?.signatureStatus,
    lease?.SignatureStatus
  );
  const normalizedSignatureStatus = normalizeLeaseText(persistedSignatureStatus).toLowerCase();
  const envelopeCompleted = persistedSignatureStatus === 4 || normalizedSignatureStatus === '4' || normalizedSignatureStatus === 'completed';
  const signerStatuses = firstDefined(signatureStatus?.signerStatuses, signatureStatus?.SignerStatuses);
  const currentTenantEmails = currentTenants.map((tenant) => normalizeEmail(tenantEmail(tenant)));
  const landlordEmail = normalizeEmail(firstDefined(lease?.landlordEmail, lease?.LandlordEmail));
  const rawSignerStatuses = Array.isArray(signerStatuses)
    ? signerStatuses
    : signerStatuses && typeof signerStatuses === 'object'
      ? Object.entries(signerStatuses).map(([email, signer]) => ({ email, ...signer }))
      : [];
  const normalizedSignerStatuses = rawSignerStatuses.map((signer) => ({
    email: normalizeEmail(firstDefined(signer?.email, signer?.Email)),
    status: normalizeLeaseText(firstDefined(signer?.status, signer?.Status)).toLowerCase()
  }));
  const signedEnvelopeEmails = new Set(
    normalizedSignerStatuses
      .filter((signer) => signer.email && ['signed', 'completed'].includes(signer.status))
      .map((signer) => signer.email)
  );
  const expectedEnvelopeEmails = [...currentTenantEmails, landlordEmail];
  const exactEnvelopeTenantEvidence = envelopeCompleted &&
    landlordEmail &&
    currentTenantEmails.length > 0 &&
    expectedEnvelopeEmails.every(Boolean) &&
    new Set(expectedEnvelopeEmails).size === expectedEnvelopeEmails.length &&
    signedEnvelopeEmails.size === expectedEnvelopeEmails.length &&
    expectedEnvelopeEmails.every((email) => signedEnvelopeEmails.has(email));
  const savedTenantEvidence = currentTenants.length > 0 && currentTenants.every(isTenantSigned);
  const allSignaturesComplete = landlordSigned && (exactEnvelopeTenantEvidence || savedTenantEvidence);
  const envelopeNeedsSignerReview = envelopeCompleted && currentTenants.length > 0 && !allSignaturesComplete;

  const rentAmount = Number(firstDefined(rentRecord?.rentAmount, rentRecord?.RentAmount, lease?.rentAmount, lease?.RentAmount));
  const rawDeposit = firstDefined(lease?.depositAmount, lease?.DepositAmount);
  const depositAmount = Number(rawDeposit);
  const collectionByPlatform = firstDefined(lease?.rentCollectionByPlatform, lease?.RentCollectionByPlatform);
  const operatingAccountId = firstDefined(
    lease?.operatingAccountId,
    lease?.OperatingAccountId,
    property?.operatingAccountId,
    property?.OperatingAccountId
  );
  const rentConfigured = Number.isFinite(rentAmount) && rentAmount > 0;
  const depositConfigured = rawDeposit !== undefined && rawDeposit !== null && Number.isFinite(depositAmount) && depositAmount >= 0;
  const collectionConfigured = collectionByPlatform === false || (collectionByPlatform === true && Boolean(operatingAccountId));
  const rentDepositComplete = rentConfigured && depositConfigured && collectionConfigured;

  const conditionReportComplete = Boolean(firstDefined(
    lease?.moveInReportTemplateCompletedAt,
    lease?.MoveInReportTemplateCompletedAt
  ));
  const checklistRecordsAvailable = Array.isArray(checklists);
  const checklistComplete = checklistRecordsAvailable && checklists.length > 0 && checklists.some(isChecklistComplete);

  const steps = [
    {
      key: 'tenants',
      label: 'Tenants assigned',
      status: currentTenants.length > 0 ? 'complete' : 'pending',
      detail: currentTenants.length > 0 ? `${currentTenants.length} assigned` : 'Assign at least one tenant'
    },
    {
      key: 'agreement',
      label: 'Agreement generated',
      status: agreementGenerated ? 'complete' : 'pending',
      detail: agreementGenerated ? 'Agreement on file' : 'Build or upload an agreement'
    },
    {
      key: 'signatures',
      label: 'All signatures complete',
      status: allSignaturesComplete ? 'complete' : 'pending',
      detail: allSignaturesComplete
        ? 'Landlord and every tenant signed'
        : envelopeNeedsSignerReview ? 'Completion recorded; verify current tenant signer set'
          : currentTenants.length === 0 ? 'Requires assigned tenants' : landlordSigned ? 'Waiting for tenant signatures' : 'Landlord signature required'
    },
    {
      key: 'rent-deposit',
      label: 'Rent & deposit setup',
      status: rentDepositComplete ? 'complete' : 'pending',
      detail: rentDepositComplete ? 'Amounts and collection method configured' : 'Confirm rent, deposit, and collection method'
    },
    {
      key: 'condition-report',
      label: 'Condition report setup',
      status: conditionReportComplete ? 'complete' : 'pending',
      detail: conditionReportComplete ? 'Customized for this lease' : 'Customize the move-in report'
    },
    {
      key: 'keys',
      label: 'Keys',
      status: 'unavailable',
      detail: 'Not tracked yet'
    },
    {
      key: 'checklist',
      label: 'Move-in checklist',
      status: checklistComplete ? 'complete' : checklistRecordsAvailable ? 'pending' : 'unavailable',
      detail: checklistComplete ? 'Completed checklist on file' : checklistRecordsAvailable ? 'No completed checklist on file' : 'Checklist records unavailable'
    }
  ];

  const trackable = steps.filter((step) => step.status !== 'unavailable');
  const completed = trackable.filter((step) => step.status === 'complete').length;
  return {
    steps,
    completed,
    totalTrackable: trackable.length,
    progress: trackable.length ? (completed / trackable.length) * 100 : 0,
    ready: trackable.length > 0 && completed === trackable.length
  };
}
