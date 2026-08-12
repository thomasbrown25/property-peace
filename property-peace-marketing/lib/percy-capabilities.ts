import capabilityContract from './percy-capabilities.json';

export const PERCY_CAPABILITY_STATUSES = [
  'available',
  'pilot',
  'prepareOnly',
  'planned',
  'unavailable',
] as const;

export type PercyCapabilityStatus = (typeof PERCY_CAPABILITY_STATUSES)[number];

export const PERCY_CAPABILITY_IDS = [
  'portfolioBriefings',
  'propertyQuestions',
  'sourceLinkedAnswers',
  'tenantCommunicationSummaries',
  'tenantCommunicationDrafts',
  'maintenanceTriage',
  'maintenanceDrafts',
  'leaseDeadlines',
  'leaseRenewals',
  'financialExplanations',
  'imports',
  'notifications',
  'actionApprovalAndExecution',
  'providerDependentActions',
] as const;

export type PercyCapabilityKey = (typeof PERCY_CAPABILITY_IDS)[number];

export type PercyMarketingCapability = {
  status: PercyCapabilityStatus;
  publicLanguage: string;
  prohibitedImplications: readonly string[];
};

/**
 * Typed application view of the machine-readable Percy marketing claim boundary.
 * The claim-check script validates the JSON contract's exact IDs, statuses, qualifiers,
 * safe language, prohibited implications, and forbidden homepage claim patterns.
 * Marketing pages are protected by that Node regression check; they intentionally avoid
 * rendering directly from JSON so the contract never becomes a client-side import.
 */
export const PERCY_CAPABILITIES = Object.fromEntries(
  capabilityContract.capabilities.map(({ id, status, publicLanguage, prohibitedImplications }) => [
    id,
    { status, publicLanguage, prohibitedImplications },
  ]),
) as unknown as Record<PercyCapabilityKey, PercyMarketingCapability>;
