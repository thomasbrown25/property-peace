export const ACTIVATION_STEP_KEYS = Object.freeze([
  'account',
  'organization',
  'property-unit',
  'listing-application',
  'lease',
  'tenant-invite',
  'rent-readiness',
  'communication'
]);

const STATUSES = new Set(['complete', 'incomplete', 'notApplicable', 'waiting', 'blocked']);
const ROLES = new Set(['Owner', 'Manager', 'Viewer']);
const MODES = new Set(['vacant', 'occupied', 'import']);
const CONTEXT_KEYS = Object.freeze(['propertyId', 'unitId', 'listingId', 'applicationId', 'leaseId', 'tenantId']);
const EVIDENCE_KEYS = new Set([
  'identityPresent',
  'activeMembership',
  'hasProperty',
  'hasUnit',
  'hasListing',
  'hasSubmittedApplication',
  'occupiedPath',
  'hasLease',
  'leaseConfigured',
  'tenantAssigned',
  'inviteSent',
  'inviteAccepted',
  'rentScheduleConfigured',
  'manualTrackingConfigured',
  'paymentSetupCompleted',
  'currentlyReady',
  'hasCommunication'
]);
const STATUS_LABELS = {
  complete: 'Complete',
  incomplete: 'Needs attention',
  notApplicable: 'Not applicable',
  waiting: 'Waiting',
  blocked: 'Blocked',
  unavailable: 'Unavailable'
};
const STEP_CONTENT = {
  account: { label: 'Complete your account', description: 'Confirm the profile and settings used for your work.' },
  organization: { label: 'Set up your organization', description: 'Add the organization details your team needs.' },
  'property-unit': { label: 'Add a property and unit', description: 'Create the property and unit you will operate.' },
  'listing-application': { label: 'Set up leasing', description: 'Create a listing or continue with applications.' },
  lease: { label: 'Create the lease', description: 'Select a property and build its lease.' },
  'tenant-invite': { label: 'Add or invite tenant', description: 'Add the tenant to the correct lease or send a portal invitation.' },
  'rent-readiness': { label: 'Prepare rent collection', description: 'Review rent collection and payment settings.' },
  communication: { label: 'Start communicating', description: 'Open messages for your organization.' }
};
const PRIORITY = {
  vacant: ACTIVATION_STEP_KEYS,
  occupied: ['account', 'organization', 'property-unit', 'lease', 'tenant-invite', 'rent-readiness', 'communication', 'listing-application'],
  import: ['account', 'organization', 'property-unit', 'lease', 'tenant-invite', 'rent-readiness', 'communication', 'listing-application']
};
const MODE_DESCRIPTION = {
  vacant: 'Set up a vacant unit, market it, and continue through leasing and operations.',
  occupied: 'Set up the existing tenancy without pretending a listing is required.',
  import: 'The current importer covers properties and basic units only. Leases, tenants, rent, and communications remain real operational steps after import.'
};

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const safePositiveId = (value) => Number.isSafeInteger(value) && value > 0;
const validEvidence = (value) => {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([key, evidence]) => EVIDENCE_KEYS.has(key) && typeof evidence === 'boolean');
};
const validContext = (value) => {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Object.keys(value);
  if (keys.length !== CONTEXT_KEYS.length || keys.some((key) => !CONTEXT_KEYS.includes(key))) return false;
  return CONTEXT_KEYS.every((key) => owns(value, key) && (value[key] === null || safePositiveId(value[key])));
};

function validProgress(progress) {
  if (!isRecord(progress)) return false;
  return ['completed', 'total'].every((key) =>
    owns(progress, key) && Number.isSafeInteger(progress[key]) && progress[key] >= 0) &&
    progress.completed <= progress.total && progress.total === ACTIVATION_STEP_KEYS.length;
}

function validStepState(item) {
  switch (item.status) {
    case 'complete':
    case 'waiting':
    case 'notApplicable':
      return item.complete === true && item.actionable === false && item.ownerActionRequired === false;
    case 'incomplete':
      return item.complete === false && item.actionable === true && item.ownerActionRequired === false;
    case 'blocked':
      return item.complete === false && item.actionable === false && item.ownerActionRequired === true;
    default:
      return false;
  }
}

function validPayload(input) {
  if (!isRecord(input) || !Number.isSafeInteger(input.organizationId) || input.organizationId <= 0 ||
      !ROLES.has(input.role) || typeof input.evaluatedAt !== 'string' ||
      Number.isNaN(Date.parse(input.evaluatedAt)) || !validProgress(input.progress) || !validContext(input.context) ||
      !Array.isArray(input.steps) || input.steps.length !== ACTIVATION_STEP_KEYS.length) return false;

  return input.steps.every((item, index) => {
    if (!isRecord(item) || item.key !== ACTIVATION_STEP_KEYS[index] || !STATUSES.has(item.status)) return false;
    if (typeof item.complete !== 'boolean' || typeof item.actionable !== 'boolean' ||
        typeof item.ownerActionRequired !== 'boolean' || !owns(item, 'evidence') || !validEvidence(item.evidence)) return false;
    // Enforce the exact server state machine. Contradictory status/action tuples must
    // fail closed rather than exposing an action the server did not authorize.
    return validStepState(item);
  });
}

export function activationModeFromInput(input) {
  let requested;
  if (typeof input === 'string') requested = new URLSearchParams(input.startsWith('?') ? input.slice(1) : input).get('mode');
  else if (typeof URLSearchParams !== 'undefined' && input instanceof URLSearchParams) requested = input.get('mode');
  else if (isRecord(input)) requested = input.mode;
  return MODES.has(requested) ? requested : 'vacant';
}

function routeDescriptor(key, context, mode = 'vacant') {
  const { propertyId, unitId, listingId, applicationId, leaseId, tenantId } = context;
  const suffix = [propertyId && `propertyId=${propertyId}`, unitId && `unitId=${unitId}`].filter(Boolean).join('&');
  const routes = {
    account: ['/landlord/settings?tab=profile', 'Open profile settings'],
    organization: ['/landlord/admin-members', 'Open organization settings'],
    'property-unit': [propertyId ? `/landlord/property/${propertyId}/add-units${mode === 'import' ? '/import' : ''}` : mode === 'import' ? '/landlord/properties/import' : '/landlord/properties/add', mode === 'import' ? 'Import properties or units' : 'Add property or unit'],
    'listing-application': [listingId ? `/landlord/listings/${listingId}/setup` : applicationId ? `/landlord/applications?applicationId=${applicationId}` : `/landlord/listings/add${suffix ? `?${suffix}` : ''}`, listingId ? 'Continue listing' : applicationId ? 'Continue application' : 'Create listing'],
    lease: [leaseId ? `/landlord/leases/${leaseId}/builder` : `/landlord/leases/selection${suffix ? `?${suffix}` : ''}`, leaseId ? 'Continue lease' : 'Select lease property'],
    'tenant-invite': [leaseId ? `/landlord/leases/${leaseId}/add-tenant${tenantId ? `?tenantId=${tenantId}` : ''}` : tenantId ? `/landlord/renters/${tenantId}` : '/landlord/leases', leaseId ? 'Add or invite tenant' : tenantId ? 'Open renter' : 'Choose a lease'],
    'rent-readiness': [leaseId ? `/landlord/rent-collection/${leaseId}` : '/landlord/leases', leaseId ? 'Open lease rent tracking' : 'Choose a configured lease'],
    communication: ['/landlord/messages', 'Open messages']
  };
  const [route, label] = routes[key];
  return { route, label };
}

export function projectActivationEnhancements(input) {
  if (!isRecord(input)) return [];
  const sms = input.dedicatedSms;
  if (!isRecord(sms) || sms.ready !== true) return [];
  return [{
    key: 'dedicated-sms',
    label: 'Dedicated SMS',
    ready: true,
    detail: typeof sms.phoneNumber === 'string' && sms.phoneNumber.trim() ? sms.phoneNumber.trim() : null,
    blocking: false
  }];
}

function unavailableProjection(mode, enhancements) {
  return {
    available: false,
    organizationId: null,
    role: 'Unknown',
    evaluatedAt: null,
    mode,
    modeDescription: MODE_DESCRIPTION[mode],
    readOnly: true,
    progressPressure: false,
    waitingForOwner: false,
    progress: { completed: 0, total: ACTIVATION_STEP_KEYS.length, percentage: 0 },
    progressLabel: 'Activation progress unavailable',
    steps: ACTIVATION_STEP_KEYS.map((key) => ({
      key, ...STEP_CONTENT[key], status: 'unavailable', statusLabel: 'Unavailable', isComplete: false, satisfiesCore: false,
      actionable: false, ownerActionRequired: false, evidence: null, link: null
    })),
    nextRequiredStep: null,
    enhancements
  };
}

export function projectActivationLifecycle(input, options = {}) {
  const mode = activationModeFromInput(options.mode ? { mode: options.mode } : options.search);
  const enhancements = projectActivationEnhancements(options.enhancements);
  if (!validPayload(input) || input.progress.completed !== input.steps.filter((item) => item.complete).length) {
    return unavailableProjection(mode, enhancements);
  }

  const readOnly = input.role === 'Viewer';
  const steps = input.steps.map((item) => ({
    key: item.key,
    ...STEP_CONTENT[item.key],
    status: item.status,
    statusLabel: STATUS_LABELS[item.status],
    isComplete: item.status === 'complete' && item.complete === true,
    satisfiesCore: item.complete === true,
    actionable: item.actionable,
    ownerActionRequired: item.ownerActionRequired,
    evidence: item.evidence,
    link: readOnly || !item.actionable ? null : routeDescriptor(item.key, input.context, mode)
  }));
  const rentEvidence = steps.find((item) => item.key === 'rent-readiness')?.evidence;
  const paymentVisible = isRecord(rentEvidence)
    && owns(rentEvidence, 'paymentSetupCompleted')
    && owns(rentEvidence, 'currentlyReady');
  const paymentEnhancements = paymentVisible ? [{
    key: 'online-payments',
    label: 'Online payments',
    ready: rentEvidence.currentlyReady === true,
    detail: rentEvidence.currentlyReady
      ? 'Approved and currently ready.'
      : rentEvidence.paymentSetupCompleted
        ? 'Connected, but not currently ready. Keep tracking rent manually.'
        : 'Not connected. Manual rent tracking remains available.',
    blocking: false
  }] : [];
  const completed = steps.filter((item) => item.satisfiesCore).length;
  const total = steps.length;
  const percentage = total === 0 ? 100 : Math.round((completed / total) * 100);

  let nextRequiredStep = null;
  let waitingForOwner = false;
  if (!readOnly) {
    const candidates = PRIORITY[mode].map((key) => steps.find((item) => item.key === key));
    const next = candidates.find((item) => !item.satisfiesCore && (item.actionable || item.ownerActionRequired));
    if (next) {
      waitingForOwner = input.role === 'Manager' && next.ownerActionRequired;
      nextRequiredStep = waitingForOwner
        ? { ...next, label: 'Waiting for an Owner', description: 'An organization Owner must complete this step.', link: null }
        : next;
    }
  }

  return {
    available: true,
    organizationId: input.organizationId,
    role: input.role,
    evaluatedAt: input.evaluatedAt,
    context: { ...input.context },
    mode,
    modeDescription: MODE_DESCRIPTION[mode],
    readOnly,
    progressPressure: !readOnly,
    waitingForOwner,
    progress: { completed, total, percentage },
    progressLabel: `${completed} of ${total} core steps complete`,
    steps,
    nextRequiredStep,
    enhancements: [...paymentEnhancements, ...enhancements]
  };
}
