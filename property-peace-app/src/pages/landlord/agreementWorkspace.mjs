import { loadAgreementLeaseOptions } from './build-lease-agreement/leaseSelection.mjs';

const field = (value, name) => value?.[name] ?? value?.[name[0].toUpperCase() + name.slice(1)];
const steps = ['isPeopleOnLeaseComplete', 'isPetsSmokingOtherComplete', 'isUtilitiesMaintenanceKeysComplete', 'isProvisionsAttachmentsComplete'];

export function agreementWorkspaceStatus(lease) {
  if (lease.isAgreementDraft) return 'draft';
  if (!lease.hasAgreement) return 'incomplete';
  const landlordSigned = !!field(lease, 'landlordSignedAt');
  const tenants = field(lease, 'tenants') || [];
  return landlordSigned && tenants.every((tenant) => !!field(tenant, 'tenantSignedAt')) ? 'complete' : 'need_to_be_signed';
}

async function optional(get, absentStatuses) {
  try { return await get(); } catch (error) {
    // axiosServices rejects normalized errors with a top-level status; raw Axios errors
    // can still occur in callers/tests. Expected absence must not fail the portfolio.
    if (absentStatuses.includes(error?.status ?? error?.response?.status)) return null;
    throw error;
  }
}

export async function loadWorkspaceAgreements(properties, get, getDocument) {
  const leases = await loadAgreementLeaseOptions(properties, get);
  const rows = await Promise.all(leases.map(async (option) => {
    // The portfolio endpoint is intentionally a lightweight projection (no people/signatures).
    const leaseResponse = (await get(`/api/Lease/by-id/${option.id}`)).data;
    if (leaseResponse?.success !== true || Number(field(leaseResponse.data, 'id')) !== option.id) {
      throw new Error('Could not load the saved lease. Please retry.');
    }
    const lease = { ...option, ...leaseResponse.data, id: option.id };
    const [progressResponse, documentResponse] = await Promise.all([
      optional(() => get(`/api/Lease/${lease.id}/agreement`), [404]),
      optional(() => getDocument(lease.id), [400, 404])
    ]);
    const progressEnvelope = progressResponse?.data;
    if (progressResponse && (progressEnvelope?.success !== true || !progressEnvelope.data)) {
      throw new Error('Could not load agreement progress. Please retry.');
    }
    if (documentResponse && documentResponse.success !== true) {
      throw new Error('Could not load agreement documents. Please retry.');
    }
    const progress = progressEnvelope?.data;
    const agreement = documentResponse?.data || null;
    const started = steps.some((step) => field(progress, step) === true);
    // Supplemental progress, never the legacy lease IsDrafted flag, classifies agreement drafts.
    const isAgreementDraft = field(progress, 'isFinalized') !== true && field(progress, 'isDraft') === true &&
      field(progress, 'canResume') === true && started;
    const property = properties.find((item) => Number(field(item, 'id')) === Number(field(lease, 'propertyId')));
    return {
      ...lease,
      propertyId: Number(field(lease, 'propertyId')),
      unitId: Number(field(lease, 'unitId')),
      propertyType: field(property, 'propertyType'),
      propertyStreetAddress: field(property, 'streetAddress'),
      tenants: field(lease, 'tenants') || [],
      landlordSignedAt: field(lease, 'landlordSignedAt') ?? field(field(lease, 'leaseAgreement'), 'landlordSignedAt'),
      startDate: field(lease, 'startDate'),
      endDate: field(lease, 'endDate'),
      isActive: field(lease, 'isActive'),
      agreementProgress: progress,
      agreement,
      isAgreementDraft,
      hasAgreement: !!agreement && !isAgreementDraft,
      hasStartedAgreement: !!agreement || isAgreementDraft
    };
  }));
  return rows.filter((row) => row.hasStartedAgreement);
}

// Cancellation gates successes, errors and loading completion, including organization switches.
export function startWorkspaceAgreementLoad(load, { onSuccess, onError, onFinally }) {
  let cancelled = false;
  const done = Promise.resolve().then(load).then(
    (rows) => { if (!cancelled) onSuccess(rows); },
    (error) => { if (!cancelled) onError(error); }
  ).finally(() => { if (!cancelled) onFinally(); });
  return { cancel: () => { cancelled = true; }, done };
}
