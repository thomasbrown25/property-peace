import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('pipeline hook is tenant-scoped, resource-scoped, fail-closed, and uses canonical API routes', async () => {
  const [hook, api, utility] = await Promise.all([source('../hooks/useLeasingPipeline.js'), source('../api/leasingPipeline.js'), source('./leasingPipeline.js')]);
  assert.match(hook, /import \{ buildLeasingPipelineKey \} from 'utils\/leasingPipeline'/);
  assert.match(hook, /const cacheKey = buildLeasingPipelineKey\(\{[\s\S]*userId: userKey,[\s\S]*organizationId: organizationKey,[\s\S]*resourceType,[\s\S]*resourceId: numericResourceId,[\s\S]*unitId: numericUnitId/);
  assert.match(utility, /return \[LEASING_PIPELINE_CACHE_PREFIX, userId, organizationId, resourceType, numericResourceId, numericUnitId\]/);
  assert.match(hook, /error \? undefined : data/);
  assert.match(hook, /keepPreviousData: false/);
  assert.match(api, /\/api\/leasing-pipeline\/properties\/\$\{propertyId\}/);
  assert.match(api, /\/api\/leasing-pipeline\/listings\/\$\{listingId\}/);
  assert.match(api, /\/api\/leasing-pipeline\/applications\/\$\{applicationId\}/);
});

test('all three real detail surfaces mount the reusable panel with direct resource identity', async () => {
  const [property, overview, listing, applications] = await Promise.all([
    source('../pages/landlord/property.jsx'),
    source('../sections/landlord/property/PropertyOverview.jsx'),
    source('../pages/landlord/listing-detail.jsx'),
    source('../pages/landlord/applications.jsx')
  ]);
  assert.match(property, /<PropertyLeasingPipeline[\s\S]*propertyId=[\s\S]*units=/);
  assert.match(overview, /<PropertyLeasingPipeline[\s\S]*propertyId=[\s\S]*units=/);
  assert.match(listing, /<LeasingPipelinePanel resourceType="listing" resourceId=\{id\}/);
  assert.match(applications, /<LeasingPipelinePanel resourceType="application" resourceId=\{selectedApplication\?\.id \?\? selectedApplication\?\.Id\}/);
});

test('property page places leasing progress directly under the header overview on desktop and after the tenant summary on mobile', async () => {
  const [property, overview] = await Promise.all([
    source('../pages/landlord/property.jsx'),
    source('../sections/landlord/property/PropertyOverview.jsx')
  ]);
  const headerIndex = property.indexOf('<PropertyHeader');
  const desktopPipelineIndex = property.indexOf('<PropertyLeasingPipeline', headerIndex);
  const overviewColumnsIndex = property.indexOf('<PropertyOverview', headerIndex);
  const tenantIndex = overview.indexOf('<PropertyCurrentTenant');
  const mobilePipelineIndex = overview.indexOf('{isMobile && (', tenantIndex);
  const activeLeaseIndex = overview.indexOf('<PropertyActiveLease', tenantIndex);

  assert.ok(headerIndex >= 0, 'property header overview should be mounted');
  assert.ok(desktopPipelineIndex > headerIndex, 'desktop leasing progress should follow the header overview');
  assert.ok(overviewColumnsIndex > desktopPipelineIndex, 'overview columns should follow desktop leasing progress');
  assert.match(property.slice(desktopPipelineIndex - 100, desktopPipelineIndex), /display: \{ xs: 'none', sm: 'block' \}/);
  assert.ok(tenantIndex >= 0 && mobilePipelineIndex > tenantIndex, 'mobile leasing progress should follow the tenant summary');
  assert.match(overview.slice(mobilePipelineIndex, activeLeaseIndex), /<PropertyLeasingPipeline/);
  assert.ok(activeLeaseIndex > mobilePipelineIndex, 'active lease should follow mobile leasing progress');
});

test('property create-listing action opens the existing listing workflow drawer instead of navigating away', async () => {
  const [property, overview, propertyPipeline, panel] = await Promise.all([
    source('../pages/landlord/property.jsx'),
    source('../sections/landlord/property/PropertyOverview.jsx'),
    source('../components/leasing-pipeline/PropertyLeasingPipeline.jsx'),
    source('../components/leasing-pipeline/LeasingPipelinePanel.jsx')
  ]);

  assert.match(property, /import ListingAddWorkflowDrawer from 'components\/drawers\/ListingAddWorkflowDrawer'/);
  assert.match(property, /<PropertyOverview[\s\S]*onCreateListing=\{drawer\.openListingAddDrawer\}/);
  assert.match(property, /<ListingAddWorkflowDrawer \/>/);
  assert.match(overview, /<PropertyLeasingPipeline[\s\S]*onCreateListing=\{onCreateListing\}/);
  assert.match(propertyPipeline, /<LeasingPipelinePanel[\s\S]*onCreateListing=\{onCreateListing\}/);
  assert.match(panel, /pipeline\.primaryAction\?\.code === 'createListing'[\s\S]*onCreateListing\(\)/);
});

test('approved application create-lease action opens the real drawer with sanitized continuity', async () => {
  const [applications, panel, controls, leaseDrawer] = await Promise.all([
    source('../pages/landlord/applications.jsx'),
    source('../components/leasing-pipeline/LeasingPipelinePanel.jsx'),
    source('../hooks/useDrawerControls.js'),
    source('../components/drawers/LeaseAddDrawer.jsx')
  ]);
  assert.match(panel, /onCreateLease/);
  assert.match(panel, /runLeasingPrimaryAction/);
  assert.match(applications, /buildApprovedApplicationLeaseContext\(currentScopedApplication, scopedProperties\)/);
  assert.match(applications, /openLeaseAddDrawer\([\s\S]*handoff\.applicationContext\.unitId,[\s\S]*handoff\.property,[\s\S]*handoff\.applicationContext/);
  assert.match(applications, /<LeaseAddDrawer \/>/);
  assert.match(controls, /leaseAddApplicationContext/);
  assert.match(controls, /openLeaseAddDrawer: useCallback\(\(unitId = null, property = null, applicationContext = null\)/);
  assert.match(leaseDrawer, /context\.desiredMoveInDate/);
  assert.match(leaseDrawer, /context\.rentAmount/);
  assert.match(leaseDrawer, /no tenant is assigned automatically/);
  assert.match(leaseDrawer, /Assign the applicant as a tenant/);
  assert.match(leaseDrawer, /applicationId=\$\{applicationId\}/);
});

test('property integration requires a real unit selection for multi-unit and auto-selects only one unit', async () => {
  const panel = await source('../components/leasing-pipeline/PropertyLeasingPipeline.jsx');
  assert.match(panel, /units\.length === 1/);
  assert.match(panel, /units\.length > 1/);
  assert.match(panel, /selectedUnitId \? 'property' : null/);
  assert.match(panel, /Select a unit to view its leasing progress/);
  assert.match(panel, /<Select[\s\S]*labelId="leasing-pipeline-unit-label"/);
});

test('panel includes accessible states, retry, explicit semantics, and responsive overflow', async () => {
  const [panel, utility] = await Promise.all([
    source('../components/leasing-pipeline/LeasingPipelinePanel.jsx'),
    source('./leasingPipeline.js')
  ]);
  assert.match(panel, /aria-current=\{item\.state === 'current' \? 'step' : undefined\}/);
  assert.match(panel, /component="ol"/);
  assert.match(panel, /overflowX: 'auto'/);
  assert.match(panel, /role="region"/);
  assert.match(panel, /aria-label="Leasing lifecycle stages"/);
  assert.match(panel, /tabIndex=\{0\}/);
  assert.match(panel, /ArrowLeft/);
  assert.match(panel, /scrollBy/);
  assert.match(utility, /Showing scheduled/);
  assert.match(panel, /Retry/);
  assert.match(panel, /PipelineSkeleton/);
  assert.match(panel, /Leasing progress unavailable/);
});

test('panel renders bounded lease document, DocuSign provider, signer progress, and timing details', async () => {
  const [panel, utility] = await Promise.all([
    source('../components/leasing-pipeline/LeasingPipelinePanel.jsx'),
    source('./leasingPipeline.js')
  ]);
  assert.match(panel, /getSafeESignatureDetails\(pipeline\)/);
  assert.match(panel, /Document/);
  assert.match(panel, /Provider/);
  assert.match(panel, /Signatures/);
  assert.match(panel, /Sent/);
  assert.match(panel, /Expires/);
  assert.match(utility, /DocuSign/);
  assert.doesNotMatch(panel, /docuSignEnvelopeId|envelopeId|blobUrl|signingUrl/i);
});

test('application collection clears before fetch and deep links require the successful current generation', async () => {
  const applications = await source('../pages/landlord/applications.jsx');
  assert.match(applications, /requestGuardRef\.current\.begin\(loadScope\)/);
  const beginIndex = applications.indexOf('requestGuardRef.current.begin(loadScope)');
  const clearIndex = applications.indexOf('setApplications([])', beginIndex);
  const requestIndex = applications.indexOf('await applicationAPI.', clearIndex);
  assert.ok(beginIndex >= 0 && clearIndex > beginIndex && requestIndex > clearIndex, 'scope data must clear before transport starts');
  assert.match(applications, /requestGuardRef\.current\.isCurrent\(request, currentLoadScopeRef\.current\)/);
  assert.match(applications, /currentLoadScopeRef\.current = currentLoadScope/);
  assert.match(applications, /successfulLoad\?\.scopeKey !== currentLoadScope\.scopeKey/);
  assert.match(applications, /setSuccessfulLoad\(\{ generation: request\.generation, scopeKey: request\.scopeKey \}\)/);
  assert.match(applications, /setLoadError/);
});

test('application deep links and all lifecycle mutations invalidate every exact-tenant projection', async () => {
  const [applications, panel] = await Promise.all([
    source('../pages/landlord/applications.jsx'),
    source('../components/leasing-pipeline/LeasingPipelinePanel.jsx')
  ]);
  assert.match(applications, /useSearchParams/);
  assert.match(applications, /searchParams\.get\('applicationId'\)/);
  assert.match(applications, /getPositiveApplicationId\(requestedApplicationId\)/);
  assert.match(applications, /handleCreateLease = useCallback\(\(\) => \{[\s\S]*hasSuccessfulCurrentScope/);
  assert.match(applications, /scopedApplications\.find\([\s\S]*selectedApplicationId/);
  assert.match(applications, /buildApprovedApplicationLeaseContext\(currentScopedApplication, scopedProperties\)/);
  assert.match(applications, /applicationNotFound/);
  assert.doesNotMatch(applications, /pipelineRevalidationRef|revalidationRef|revalidateApplicationPipeline/);
  assert.doesNotMatch(panel, /revalidationRef|useEffect/);
  assert.match(applications, /const invalidateApplicationPipeline = useCallback\(async \(applicationId, \{ deleted = false \} = \{\}\) =>/);
  assert.match(applications, /isLeasingPipelineKeyForTenant\(key, userId, organizationId\)/);
  const clearIndex = applications.indexOf('await mutate(tenantKeyPredicate, undefined, { revalidate: false, populateCache: true })');
  const revalidateIndex = applications.indexOf('await mutate(revalidationPredicate)', clearIndex);
  assert.ok(clearIndex >= 0 && revalidateIndex > clearIndex, 'all scoped cache clears must precede scoped revalidation');
  assert.match(applications, /handleStatusUpdate = \(application\) => \{[\s\S]*setStatusApplicationId\(applicationId\)/);
  assert.match(applications, /handleSaveStatusUpdate = async \(\) => \{\s*const applicationId = Number\(statusApplicationId\)/);
  assert.match(applications, /handleRequestBackgroundCheck = async \(applicationIdValue\) => \{\s*const applicationId = Number\(applicationIdValue\)/);
  assert.match(applications, /handleApprove = async \(applicationIdValue\) => \{\s*const applicationId = Number\(applicationIdValue\)/);
  assert.match(applications, /updateApplicationStatus\([\s\S]*applicationId,[\s\S]*if \(response\.success\) \{[\s\S]*await invalidateApplicationPipeline\(applicationId\)/);
  assert.match(applications, /requestBackgroundCheck\(applicationId\)[\s\S]*await invalidateApplicationPipeline\(applicationId\)/);
  assert.match(applications, /deleteApplication\(applicationId\)[\s\S]*await invalidateApplicationPipeline\(applicationId, \{ deleted: true \}\)/);
  assert.match(applications, /resendApplicationInviteByApplicationId\(applicationId\)[\s\S]*await invalidateApplicationPipeline\(applicationId\)/);
  assert.doesNotMatch(applications, /invalidateApplicationPipeline\(selectedApplication/);
  assert.doesNotMatch(applications, /invalidateApplicationPipeline\(applicationToDelete/);
  assert.doesNotMatch(applications, /\/landlord\/applications\/\$\{/);
  assert.doesNotMatch(applications, /\/landlord\/screenings\/\$\{/);
});

test('pipeline hook exposes a stable fail-closed exact-key revalidation', async () => {
  const hook = await source('../hooks/useLeasingPipeline.js');
  assert.match(hook, /useCallback/);
  assert.match(hook, /mutate\(undefined, \{ revalidate: true \}\)/);
  assert.match(hook, /revalidate/);
});

test('lease detail wires authoritative signer status and labels only tracked completion', async () => {
  const [leasePage, detail] = await Promise.all([
    source('../pages/landlord/lease.jsx'),
    source('../sections/landlord/leases/LeaseDetailView.jsx')
  ]);
  assert.match(leasePage, /buildLeaseMoveInReadiness\(\{[\s\S]*signatureStatus/);
  assert.match(leasePage, /selectCurrentSignatureStatus\([\s\S]*signatureStatusRecord,[\s\S]*signatureLeaseId,[\s\S]*signatureEnvelopeId/);
  assert.match(leasePage, /const requestVersion = \+\+signatureStatusRequestRef\.current/);
  assert.match(leasePage, /signatureStatusRequestRef\.current !== requestVersion/);
  assert.match(leasePage, /setSignatureStatusRecord\(null\)/);
  assert.match(leasePage, /moveInReadiness=\{moveInReadiness\}/);
  assert.match(detail, /All tracked steps complete/);
  assert.match(detail, /Tracked steps complete/);
  assert.doesNotMatch(detail, /Move-in setup is ready/);
  assert.match(detail, /direction=\{\{ xs: 'column', sm: 'row' \}\}/);
});
