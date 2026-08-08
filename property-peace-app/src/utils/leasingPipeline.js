export const LEASING_STAGE_ORDER = Object.freeze([
  'vacant',
  'listed',
  'lead',
  'showingScheduled',
  'applied',
  'screening',
  'approved',
  'leaseDraft',
  'signaturePending',
  'moveInReady',
  'occupied'
]);

const LEASING_PIPELINE_CACHE_PREFIX = '/api/leasing-pipeline';
const LEASING_RESOURCE_TYPES = Object.freeze(['property', 'listing', 'application']);

const isCanonicalIdentity = (value) => (
  (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
  || (typeof value === 'string' && value.trim().length > 0)
);
const isPositiveSafeInteger = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function isLeasingPipelineKeyForTenant(key, userId, organizationId) {
  if (!isCanonicalIdentity(userId) || !isCanonicalIdentity(organizationId)) return false;
  if (!Array.isArray(key) || key.length !== 6) return false;
  const [namespace, keyUserId, keyOrganizationId, resourceType, resourceId, unitId] = key;
  if (namespace !== LEASING_PIPELINE_CACHE_PREFIX || keyUserId !== userId || keyOrganizationId !== organizationId) return false;
  if (!LEASING_RESOURCE_TYPES.includes(resourceType) || !isPositiveSafeInteger(resourceId)) return false;
  if (unitId !== null && !isPositiveSafeInteger(unitId)) return false;
  return resourceType !== 'property' || isPositiveSafeInteger(unitId);
}

export function buildLeasingPipelineKey({ userId, organizationId, resourceType, resourceId, unitId = null }) {
  const numericResourceId = Number(resourceId);
  const numericUnitId = unitId == null || unitId === '' ? null : Number(unitId);
  const resourceReady = ['property', 'listing', 'application'].includes(resourceType)
    && Number.isSafeInteger(numericResourceId)
    && numericResourceId > 0;
  const unitReady = resourceType !== 'property'
    || (Number.isSafeInteger(numericUnitId) && numericUnitId > 0);

  if (!userId || !organizationId || !resourceReady || !unitReady) return null;
  return [LEASING_PIPELINE_CACHE_PREFIX, userId, organizationId, resourceType, numericResourceId, numericUnitId];
}

const STAGE_LABELS = Object.freeze({
  vacant: 'Vacant',
  listed: 'Listed',
  lead: 'Lead',
  showingScheduled: 'Showing scheduled',
  applied: 'Applied',
  screening: 'Screening',
  approved: 'Approved',
  leaseDraft: 'Lease draft',
  signaturePending: 'Signature pending',
  moveInReady: 'Move-in ready',
  occupied: 'Occupied'
});

export function validatePipelineContract(pipeline) {
  if (!pipeline || !LEASING_STAGE_ORDER.includes(pipeline.currentStage) || !Array.isArray(pipeline.stages) || pipeline.stages.length !== LEASING_STAGE_ORDER.length) return false;

  const currentIndex = LEASING_STAGE_ORDER.indexOf(pipeline.currentStage);
  let currentCount = 0;
  for (let index = 0; index < LEASING_STAGE_ORDER.length; index += 1) {
    const descriptor = pipeline.stages[index];
    if (!descriptor || descriptor.stage !== LEASING_STAGE_ORDER[index] || descriptor.order !== index) return false;
    if (typeof descriptor.isCurrent !== 'boolean' || typeof descriptor.isComplete !== 'boolean') return false;
    if (descriptor.isCurrent) currentCount += 1;
    if (descriptor.isCurrent !== (index === currentIndex) || descriptor.isComplete !== (index < currentIndex)) return false;
  }
  return currentCount === 1;
}

export function getPipelineStages(pipeline) {
  if (!validatePipelineContract(pipeline)) return null;
  return pipeline.stages.map((descriptor) => ({
    stage: descriptor.stage,
    label: STAGE_LABELS[descriptor.stage],
    order: descriptor.order,
    state: descriptor.isCurrent ? 'current' : descriptor.isComplete ? 'complete' : 'future'
  }));
}

const BLOCKER_COPY = Object.freeze({
  screeningUnavailable: 'Tenant screening isn’t ready yet.',
  eSignatureUnavailable: 'Electronic signature isn’t ready yet.',
  signatureTerminal: 'The prior signature request ended. Review the lease before continuing.'
});

export function getSafeBlockerMessage(blocker) {
  return typeof blocker?.code === 'string' ? BLOCKER_COPY[blocker.code] ?? null : null;
}

const SAFE_ROUTES = [
  /^\/landlord\/property\/[1-9]\d*$/,
  /^\/landlord\/listings\/add$/,
  /^\/landlord\/listings\/[1-9]\d*$/,
  /^\/landlord\/applications\?applicationId=[1-9]\d*$/,
  /^\/landlord\/leases\/selection$/,
  /^\/landlord\/leases\/[1-9]\d*$/
];

export function isSafeLeasingRoute(route) {
  return typeof route === 'string' && SAFE_ROUTES.some((pattern) => pattern.test(route));
}

const safeTrimmedText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= maxLength ? normalized : null;
};

const safeInputDate = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}`
    : null;
};

const firstPositiveMoney = (...values) => values.find((value) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
)) ?? null;

export function buildApprovedApplicationLeaseContext(application, properties) {
  if (!application || !Array.isArray(properties)) return null;
  const status = application.status ?? application.Status;
  if (!(status === 3 || (typeof status === 'string' && status.trim().toLowerCase() === 'approved'))) return null;

  const applicationId = positiveId(application.id ?? application.Id);
  const propertyId = positiveId(application.propertyId ?? application.PropertyId);
  const unitId = positiveId(application.unitId ?? application.UnitId);
  if (!applicationId || !propertyId || !unitId) return null;

  const property = properties.find((item) => positiveId(item?.id ?? item?.Id) === propertyId);
  if (!property) return null;
  const units = property.units ?? property.Units;
  const hasScopedUnits = Array.isArray(units) && units.length > 0;
  const unit = hasScopedUnits
    ? units.find((item) => positiveId(item?.id ?? item?.Id) === unitId)
    : null;
  if (hasScopedUnits && !unit) return null;

  const applicationContext = { applicationId, propertyId, unitId };
  const firstName = safeTrimmedText(application.firstName ?? application.FirstName, 100);
  const lastName = safeTrimmedText(application.lastName ?? application.LastName, 100);
  const applicantName = [firstName, lastName].filter(Boolean).join(' ');
  if (applicantName) applicationContext.applicantName = applicantName;
  const applicantEmail = safeTrimmedText(application.email ?? application.Email, 254);
  if (applicantEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) applicationContext.applicantEmail = applicantEmail;
  const desiredMoveInDate = safeInputDate(application.desiredMoveInDate ?? application.DesiredMoveInDate);
  if (desiredMoveInDate) applicationContext.desiredMoveInDate = desiredMoveInDate;
  const rentAmount = firstPositiveMoney(
    application.advertisedRent, application.AdvertisedRent, application.monthlyRent, application.MonthlyRent,
    unit?.advertisedRent, unit?.AdvertisedRent, unit?.monthlyRent, unit?.MonthlyRent,
    property.advertisedRent, property.AdvertisedRent, property.monthlyRent, property.MonthlyRent
  );
  if (rentAmount != null) applicationContext.rentAmount = rentAmount;

  return { property, applicationContext };
}

export function runLeasingPrimaryAction(actionCode, { onCreateListing, onCreateLease, navigate } = {}, route) {
  if (actionCode === 'createListing' && typeof onCreateListing === 'function') {
    onCreateListing();
    return true;
  }
  if (actionCode === 'createLease' && typeof onCreateLease === 'function') {
    onCreateLease();
    return true;
  }
  if (typeof navigate !== 'function' || !isSafeLeasingRoute(route)) return false;
  navigate(route);
  return true;
}

const positiveId = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
const actionId = (action, references, name) => positiveId(action?.data?.[name]) ?? positiveId(references?.[name]);

export function getSafePrimaryAction(action, currentStage, references = {}) {
  if (currentStage === 'occupied' || !action || typeof action.code !== 'string' || !action.data || typeof action.data !== 'object' || Array.isArray(action.data)) return null;

  const propertyId = actionId(action, references, 'propertyId');
  const listingId = actionId(action, references, 'listingId');
  const applicationId = actionId(action, references, 'applicationId');
  const leaseId = actionId(action, references, 'leaseId');
  let result = null;

  switch (action.code) {
    case 'createListing':
      result = { label: 'Create listing', route: '/landlord/listings/add' };
      break;
    case 'inviteApplicant':
    case 'scheduleShowing':
    case 'manageShowing':
      if (listingId) result = { label: 'Review listing', route: `/landlord/listings/${listingId}` };
      else if (propertyId) result = { label: 'Review property', route: `/landlord/property/${propertyId}` };
      break;
    case 'requestScreening':
    case 'reviewApplication':
      if (applicationId) result = { label: 'Review application', route: `/landlord/applications?applicationId=${applicationId}` };
      break;
    case 'createLease':
      result = { label: 'Create lease', route: '/landlord/leases/selection' };
      break;
    case 'sendForSignature':
    case 'reviewLease':
    case 'trackSignatures':
    case 'prepareMoveIn':
      if (leaseId) result = { label: 'Review lease', route: `/landlord/leases/${leaseId}` };
      break;
    default:
      return null;
  }

  return result && isSafeLeasingRoute(result.route) ? result : null;
}
