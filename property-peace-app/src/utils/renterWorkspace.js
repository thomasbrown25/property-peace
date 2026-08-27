export const TENANT_DIRECTORY_ROUTE = '/landlord/leases?tab=tenants';

export const RENTER_PROFILE_TABS = Object.freeze([
  'profile',
  'leases',
  'transactions',
  'insurance',
  'applications',
  'requests'
]);

const LEASES_WORKSPACE_TABS = new Set(['leases', 'tenants', 'agreements']);
const LEASE_VIEW_FILTERS = new Set(['renewals', 'history', 'overdue', 'notStarted', 'active']);
const RENTER_PROFILE_TAB_SET = new Set(RENTER_PROFILE_TABS);

const searchParamsFrom = (search) => {
  if (search instanceof URLSearchParams) return new URLSearchParams(search);
  const value = typeof search === 'string' && search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(typeof value === 'string' ? value : '');
};

const valueFrom = (record, camelKey, pascalKey) => record?.[camelKey] ?? record?.[pascalKey];

const positiveId = (value) => {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export function leasesWorkspaceTabFromSearch(search) {
  const requested = searchParamsFrom(search).get('tab');
  return LEASES_WORKSPACE_TABS.has(requested) ? requested : 'leases';
}

export function leasesWorkspaceSearch(tab, currentSearch = '') {
  const destination = LEASES_WORKSPACE_TABS.has(tab) ? tab : 'leases';
  if (destination === 'tenants' || destination === 'agreements') return `?tab=${destination}`;

  const current = searchParamsFrom(currentSearch);
  const view = current.get('view');
  return view && LEASE_VIEW_FILTERS.has(view) ? `?view=${view}` : '';
}

export function renterProfileTabFromSearch(search) {
  const requested = searchParamsFrom(search).get('tab');
  return RENTER_PROFILE_TAB_SET.has(requested) ? requested : 'profile';
}

export function tenantDirectoryRoute() {
  return TENANT_DIRECTORY_ROUTE;
}

export function renterProfileRoute(renterId) {
  const id = positiveId(renterId);
  return id ? `/landlord/renters/${id}` : null;
}

export function applicationsForRenter(applications, renter) {
  if (!Array.isArray(applications)) return [];
  const renterId = positiveId(valueFrom(renter, 'id', 'Id'));
  if (!renterId) return [];
  const renterEmail = String(valueFrom(renter, 'email', 'Email') || '').trim().toLowerCase();

  return applications.filter((application) => {
    const convertedId = positiveId(valueFrom(application, 'convertedToTenantId', 'ConvertedToTenantId'));
    if (convertedId) return convertedId === renterId;
    const applicationEmail = String(valueFrom(application, 'email', 'Email') || '').trim().toLowerCase();
    return Boolean(renterEmail) && applicationEmail === renterEmail;
  });
}

export function requestsForRenter(requests, renterId) {
  if (!Array.isArray(requests)) return [];
  const id = positiveId(renterId);
  if (!id) return [];
  return requests.filter((request) => positiveId(valueFrom(request, 'submittedByTenantId', 'SubmittedByTenantId')) === id);
}

export function insuranceDocumentsForRenter(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.filter((document) => {
    const type = valueFrom(document, 'documentType', 'DocumentType');
    if (type === 20 || type === 21 || type === '20' || type === '21') return true;
    const normalized = String(type || '').replace(/[^a-z]/gi, '').toLowerCase();
    return normalized === 'renterinsurance' || normalized === 'liabilityinsurance';
  });
}

const leaseRank = (lease) => {
  const drafted = valueFrom(lease, 'isDrafted', 'IsDrafted') === true;
  if (drafted) return 1;
  return valueFrom(lease, 'isActive', 'IsActive') === false ? 2 : 0;
};

const leaseSortDate = (lease, rank) => {
  const value = rank === 2
    ? valueFrom(lease, 'endDate', 'EndDate')
    : valueFrom(lease, 'startDate', 'StartDate');
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export function dedupeAndOrderRenterLeases(leases) {
  if (!Array.isArray(leases)) return [];
  const byId = new Map();
  const withoutId = [];

  leases.forEach((lease) => {
    const id = positiveId(valueFrom(lease, 'id', 'Id'));
    if (id) byId.set(id, lease);
    else withoutId.push(lease);
  });

  return [...byId.values(), ...withoutId].sort((left, right) => {
    const leftRank = leaseRank(left);
    const rightRank = leaseRank(right);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return leaseSortDate(right, rightRank) - leaseSortDate(left, leftRank);
  });
}
