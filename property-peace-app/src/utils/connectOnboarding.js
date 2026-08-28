const SAFE_OPERATING_TYPES = new Set(['individual', 'business']);
const SAFE_AUTHORITY_RELATIONSHIPS = new Set(['owner', 'property-manager', 'authorized-representative']);

function readFirstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function createConnectOnboardingDraft({ user = null, savedPreparation = null } = {}) {
  const companyName = readFirstValue(user, ['companyName', 'CompanyName', 'organizationName', 'OrganizationName']);
  const firstName = readFirstValue(user, ['firstName', 'FirstName']);
  const lastName = readFirstValue(user, ['lastName', 'LastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const savedOperatingType = SAFE_OPERATING_TYPES.has(savedPreparation?.operatingType) ? savedPreparation.operatingType : null;
  const savedAuthority = SAFE_AUTHORITY_RELATIONSHIPS.has(savedPreparation?.authorityRelationship)
    ? savedPreparation.authorityRelationship
    : '';
  const savedPropertyIds = Array.isArray(savedPreparation?.propertyIds)
    ? [
        ...new Set(
          savedPreparation.propertyIds
            .map((propertyId) => Number(propertyId))
            .filter((propertyId) => Number.isSafeInteger(propertyId) && propertyId > 0)
            .map(String)
        )
      ]
    : [];

  return {
    operatingType: savedOperatingType || (companyName ? 'business' : 'individual'),
    displayName: readFirstValue(savedPreparation, ['displayName']) || companyName || fullName,
    propertyIds: savedPropertyIds,
    authorityRelationship: savedAuthority,
    authorityAttested: false
  };
}

export function validateConnectOnboardingStep(step, draft = {}) {
  const errors = {};

  if (step === 0 && !String(draft.displayName || '').trim()) {
    errors.displayName = 'Enter the landlord or business name that tenants recognize.';
  }

  if (step === 1) {
    if (!Array.isArray(draft.propertyIds) || draft.propertyIds.length === 0) {
      errors.propertyIds = 'Select at least one property that will use online rent payments.';
    }
    if (!SAFE_AUTHORITY_RELATIONSHIPS.has(draft.authorityRelationship)) {
      errors.authorityRelationship = 'Choose how you are authorized to manage rent for these properties.';
    }
    if (draft.authorityAttested !== true) {
      errors.authorityAttested = 'Confirm that you are authorized to manage rent collection for the selected properties.';
    }
  }

  return errors;
}

export function buildConnectOnboardingContext(draft = {}) {
  const operatingType = SAFE_OPERATING_TYPES.has(draft.operatingType) ? draft.operatingType : 'individual';
  const authorityRelationship = SAFE_AUTHORITY_RELATIONSHIPS.has(draft.authorityRelationship)
    ? draft.authorityRelationship
    : '';
  const propertyIds = Array.isArray(draft.propertyIds)
    ? [
        ...new Set(
          draft.propertyIds
            .map((propertyId) => Number(propertyId))
            .filter((propertyId) => Number.isSafeInteger(propertyId) && propertyId > 0)
        )
      ]
    : [];

  return {
    operatingType,
    displayName: String(draft.displayName || '').trim(),
    propertyIds,
    authorityRelationship,
    authorityAttested: draft.authorityAttested === true
  };
}

export function validateConnectOnboardingContext(context = {}, knownPropertyIds = null) {
  const errors = {};
  const knownIds = new Set((knownPropertyIds || []).map((propertyId) => String(propertyId)));

  if (!SAFE_OPERATING_TYPES.has(context.operatingType)) errors.operatingType = 'Choose a valid operating type.';
  if (!String(context.displayName || '').trim()) errors.displayName = 'Enter a landlord or business name.';
  if (!Array.isArray(context.propertyIds) || context.propertyIds.length === 0) {
    errors.propertyIds = 'Select at least one property.';
  } else if (Array.isArray(knownPropertyIds) && context.propertyIds.some((propertyId) => !knownIds.has(String(propertyId)))) {
    errors.propertyIds = 'One or more selected properties are not available in this account.';
  }
  if (!SAFE_AUTHORITY_RELATIONSHIPS.has(context.authorityRelationship)) {
    errors.authorityRelationship = 'Choose a valid authority relationship.';
  }
  if (context.authorityAttested !== true) errors.authorityAttested = 'Property authority must be confirmed.';

  return errors;
}

export function deriveConnectOnboardingStage(accountStatus) {
  const accountId = accountStatus?.AccountId || accountStatus?.accountId;
  const isReady = accountStatus?.IsAccountReadyForRentTransfers ?? accountStatus?.isAccountReadyForRentTransfers;
  const detailsSubmitted = accountStatus?.DetailsSubmitted ?? accountStatus?.detailsSubmitted;

  if (!accountId) return 'property-peace';
  if (isReady === true) return 'ready';
  if (detailsSubmitted === true) return 'review';
  return 'stripe';
}
