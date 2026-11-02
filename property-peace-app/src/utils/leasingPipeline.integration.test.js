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

test('listing and application detail surfaces still mount the reusable leasing panel', async () => {
  const [listing, applications] = await Promise.all([
    source('../pages/landlord/listing-detail.jsx'),
    source('../pages/landlord/applications.jsx')
  ]);
  assert.match(listing, /<LeasingPipelinePanel resourceType="listing" resourceId=\{id\}/);
  assert.match(
    applications,
    /<LeasingPipelinePanel[\s\S]*resourceType="application"[\s\S]*resourceId=\{selectedApplication\?\.id \?\? selectedApplication\?\.Id\}/
  );
});

test('property detail places tenant, lease, and actions in three columns above full-width activity', async () => {
  const [property, overview, lease] = await Promise.all([
    source('../pages/landlord/property.jsx'),
    source('../sections/landlord/property/PropertyOverview.jsx'),
    source('../sections/landlord/property/PropertyActiveLease.jsx')
  ]);
  assert.match(property, /<PropertyOverview[\s\S]*rentRecords=\{rentRecords\}/);
  assert.doesNotMatch(property, /<PropertyActiveLease/);
  assert.doesNotMatch(property, /<PropertyLeasingPipeline/);
  const tenantIndex = overview.indexOf('<PropertyCurrentTenant');
  const leaseIndex = overview.indexOf('<PropertyActiveLease');
  const actionsIndex = overview.indexOf('<PropertyQuickActionsPanel');
  const activityIndex = overview.indexOf('<PropertyStory');
  assert.ok(tenantIndex > 0 && leaseIndex > tenantIndex && actionsIndex > leaseIndex && activityIndex > actionsIndex);
  assert.match(overview, /longTermUnits\.length > 0 && \([\s\S]*<Grid size=\{\{ xs: 12, md: 4 \}\} sx=\{\{ '& > \.MuiCard-root': \{ height: '100%' \} \}\}>[\s\S]*<PropertyCurrentTenant/);
  assert.match(overview, /longTermUnits\.length > 0 && \([\s\S]*<Grid size=\{\{ xs: 12, md: 4 \}\} sx=\{\{ '& > \.MuiCard-root': \{ height: '100%' \} \}\}>\s*<PropertyActiveLease property=\{leaseProperty\}/);
  assert.match(overview, /<Grid size=\{\{ xs: 12, md: 4 \}\}>\s*<PropertyQuickActionsPanel/);
  assert.match(overview, /<Grid size=\{12\}>\s*<PropertyStory/);
  assert.doesNotMatch(overview, /PropertyMarketRent|PropertyLeasingPipeline/);
  assert.match(lease, /No active lease on this property\./);
  assert.match(lease, /justifyContent="space-between"[\s\S]*variant="contained"[\s\S]*bgcolor: '#061E35'[\s\S]*Create a lease/);
});

test('property page retains its listing onboarding drawer without rendering leasing progress', async () => {
  const [property, propertyPipeline, panel] = await Promise.all([
    source('../pages/landlord/property.jsx'),
    source('../components/leasing-pipeline/PropertyLeasingPipeline.jsx'),
    source('../components/leasing-pipeline/LeasingPipelinePanel.jsx')
  ]);

  assert.match(property, /import ListingAddWorkflowDrawer from 'components\/drawers\/ListingAddWorkflowDrawer'/);
  assert.doesNotMatch(property, /<PropertyLeasingPipeline/);
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
  assert.match(
    applications,
    /const invalidateApplicationPipeline = useCallback\([\s\S]*async \(applicationId, \{ deleted = false \} = \{\}\) =>/
  );
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

test('lease detail wires authoritative signer status and only requested checklist completion', async () => {
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
  assert.match(leasePage, /getChecklistsByLease\(leaseId\)/);
  assert.match(leasePage, /checklists: leaseChecklists/);
  assert.match(detail, /agreement: \{ label: hasAgreement \? 'View agreement' : 'Build agreement'/);
  assert.match(detail, /const cardAction = \(step\.key === 'checklist' \|\| step\.key === 'move-out'\)/);
  assert.doesNotMatch(detail, /signatureAgreementAction/);
  assert.match(detail, /action\?\.onClick && !\(step\.key === 'signatures' && complete\)/);
  assert.match(detail, /onClick=\{cardAction\}/);
  assert.match(detail, /onKeyDown=\{\(event\) => \{/);
  assert.match(detail, /event\.stopPropagation\(\)/);
  assert.match(detail, /label: 'Open signatures', onClick: onOpenSignature/);
  assert.match(leasePage, /onOpenSignature=\{handleOpenSignatures\}/);
  assert.match(leasePage, /const handleOpenSignatures = async \(\) => \{/);
  assert.match(leasePage, /await handleSignLandlord\(\)/);
  assert.doesNotMatch(leasePage, /Enter your email address to receive a signing link/);
  assert.doesNotMatch(leasePage, /setSendSignatureDialogOpen\(true\)/);
  assert.doesNotMatch(detail, /label: 'Keys'/);
  assert.match(detail, /Lease checklist/);
  assert.match(detail, /buildLeaseChecklistCards\(\{ readiness, lease, checklists \}\)/);
  assert.match(leasePage, /leaseChecklists=\{leaseChecklists\}/);
  assert.doesNotMatch(detail, /Setup in progress|Tracked steps complete/);
  assert.doesNotMatch(detail, /Move-in setup is ready/);
  assert.match(detail, /direction=\{\{ xs: 'column', sm: 'row' \}\}/);
});
