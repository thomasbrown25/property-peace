import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { currentCycleCompletionAttachmentIds, displayStatus, emergencyGuidance, extractRoles, findPendingCompletion, isClosedStatus, isEmergency, maintenanceAudience, normalizeMaintenanceMediaFileName, SAFE_STEPS, validateMaintenanceMedia } from '../src/features/maintenance/maintenanceModel.ts';
import { visibleMainTabsForAudience } from '../src/navigation/mainTabModel.ts';

const root=resolve(import.meta.dirname,'..');const read=(p)=>readFileSync(resolve(root,p),'utf8');
const api=read('src/api/maintenanceAPI.ts');const nav=read('src/navigation/MainNavigator.tsx');const intake=read('src/screens/tenant/TenantMaintenanceIntakeScreen.tsx');const detail=read('src/screens/tenant/TenantMaintenanceDetailScreen.tsx');const receipt=read('src/screens/tenant/TenantMaintenanceReceiptScreen.tsx');const emergency=read('src/screens/tenant/MaintenanceEmergencyScreen.tsx');
const landlordList=read('src/screens/landlord/MaintenanceScreen.tsx');const landlordDetail=read('src/screens/landlord/LandlordMaintenanceDetailScreen.tsx');
const model=read('src/features/maintenance/maintenanceModel.ts');

test('all Milestone 8 mutation requests carry required idempotency keys',()=>{assert.match(api,/import \* as Crypto from 'expo-crypto'/);assert.match(api,/'Idempotency-Key': idempotencyKey/);assert.match(api,/newIdempotencyKey = \(\) => Crypto\.randomUUID\(\)/);});

test('canonical plural Milestone 8 API is used for all tenant maintenance reads and writes',()=>{
 assert.match(api,/get[^\n]+\('\/api\/maintenance-requests'/);assert.match(api,/post\('\/api\/maintenance-requests', request, mutationConfig\(idempotencyKey\)\)/);assert.match(api,/\/api\/maintenance-requests\/\$\{id\}/);assert.match(api,/\/attachments/);assert.match(api,/percy\/troubleshooting/);assert.match(api,/completions\/\$\{completion\.id\}\/confirm/);assert.match(api,/completions\/\$\{completion\.id\}\/reopen/);
 assert.doesNotMatch(api,/maintenance-request\/tenant\/(current|history)/);assert.match(api,/\/api\/Lease\/tenant\/my-leases/);
});
test('canonical camelCase enum values split current and history correctly',()=>{assert.equal(displayStatus('awaitingTenant'),'Awaiting your confirmation');assert.equal(displayStatus('inProgress'),'In Progress');assert.equal(isClosedStatus('resolved'),true);assert.equal(isClosedStatus('cancelled'),true);assert.equal(isClosedStatus('assigned'),false);assert.equal(isClosedStatus('awaitingTenant'),false);});
test('emergency routing is deterministic and independent of AI',()=>{assert.equal(isEmergency(['GasOdor']),true);assert.equal(isEmergency(['NoRunningWater']),false);assert.match(emergencyGuidance(['ActiveFire']),/Leave the building immediately/);assert.match(emergency,/Call 911/);assert.doesNotMatch(emergency,/Percy|openai|anthropic|chat completion/i);assert.match(intake,/deterministic checklist—not AI/);});
test('media picker enforces API-compatible types, limits, previews and permissions',()=>{assert.match(model,/image\/jpeg/);assert.match(model,/video\/quicktime/);assert.match(model,/10 \* 1024 \* 1024/);assert.match(model,/100 \* 1024 \* 1024/);assert.match(intake,/validateMaintenanceMedia/);assert.match(intake,/launchImageLibraryAsync/);assert.match(intake,/launchCameraAsync/);assert.match(intake,/<Image source=/);assert.match(api,/FormData/);});
test('tenant role detection accepts the real camelCase auth payload',()=>{assert.deepEqual(extractRoles({roles:['Tenant']}),['tenant']);assert.deepEqual(extractRoles({currentOrganizationRole:'Tenant'}),['tenant']);assert.equal(maintenanceAudience({currentOrganizationRole:'Tenant'}),'tenant');assert.match(nav,/TenantMaintenanceNavigator/);assert.deepEqual(visibleMainTabsForAudience('tenant').map((tab)=>tab.name),['Maintenance','Messages','Settings']);});
test('timeline comes from the detail response without a duplicate detail or legacy activity route',()=>{assert.doesNotMatch(api,/async getEvents/);assert.match(detail,/activityEvents/);assert.doesNotMatch(api,/maintenance-requests\/\$\{id\}\/events|maintenance-request\/.*activit/i);});
test('partial detail data failures are visible rather than silently swallowed',()=>{assert.match(detail,/partialWarning/);assert.match(detail,/Some evidence could not be loaded/);assert.doesNotMatch(detail,/getAttachments\(requestId\)\.catch\(\(\)=>\[\]\)/);});
test('troubleshooting is allowlisted, bounded and has explicit tenant outcome actions',()=>{assert.equal(SAFE_STEPS.length,3);assert.match(detail,/steps\.length<3/);assert.match(detail,/Three-step safety limit reached/);assert.match(detail,/read-only for tenants/);assert.match(detail,/recordOutcome/);assert.match(detail,/>Worked</);assert.match(detail,/>Did not work</);assert.match(detail,/>Skip</);assert.doesNotMatch(detail,/Assign vendor|Approve estimate|Issue work order/);});
test('failed intake uploads have a real retry path and reopen accepts retryable evidence',()=>{assert.match(intake,/failedMedia/);assert.match(receipt,/retryUploads/);assert.match(receipt,/uploadAttachment\(id,'Intake'/);assert.match(detail,/uploadAttachment\(requestId,'Reopen'/);assert.match(detail,/reopenMedia/);assert.match(detail,/Retry evidence upload/);});
test('private evidence is fetched through the authenticated content endpoint and can be viewed or exported',()=>{assert.match(api,/attachments\/\$\{attachment\.id\}\/content/);assert.match(api,/downloadAsync/);assert.match(detail,/openEvidence/);assert.match(detail,/View or save/);assert.match(detail,/Sharing\.shareAsync/);});
test('completion supports confirm and reasoned reopen',()=>{assert.match(detail,/confirmCompletion/);assert.match(detail,/reopenCompletion/);assert.match(detail,/completionReopenReason\.trim\(\)\.length<10/);assert.match(detail,/tenantConfirmationDueAtUtc/);});

test('landlord has a reachable canonical detail workflow instead of unsafe legacy create',()=>{
 assert.match(nav,/LandlordMaintenanceDetail/);assert.match(landlordList,/navigate\('LandlordMaintenanceDetail'/);assert.doesNotMatch(nav,/AddMaintenance/);assert.doesNotMatch(api,/['"]\/api\/maintenance-request['"]/);assert.doesNotMatch(landlordList,/maintenance AI agent/i);
 for(const marker of ['assignRequest','submitEstimate','approveEstimate','rejectEstimate','issueWorkOrder','proposeAppointment','cancelAppointment','startWork','cancelWorkOrder','submitCompletion','staffCloseCompletion']) assert.match(landlordDetail,new RegExp(marker));
 assert.match(landlordDetail,/activityEvents/);assert.match(landlordDetail,/openEvidence/);
});

test('landlord canonical workflow endpoints and DTO fields match the API contract',()=>{
 for(const route of ['/assign','/estimates','/approve','/reject','/work-orders','/appointments','/confirm','/start','/completions','/staff-close']) assert.ok(api.includes(route),`missing ${route}`);
 for(const field of ['assignedToType','assignedToUserId','vendorId','estimateRequired','expectedVersion','authorizedAmount','startsAtUtc','endsAtUtc','resolutionNotes','completionEvidenceReference','finalCost']) assert.ok(api.includes(field),`missing ${field}`);
});

test('reopen evidence uses the same MIME, size, and count policy as intake',()=>{
 assert.equal(validateMaintenanceMedia({mimeType:'image/jpeg',fileSize:10*1024*1024,type:'image'},0),null);
 assert.match(validateMaintenanceMedia({mimeType:'image/gif',fileSize:100,type:'image'},0),/JPEG, PNG, WebP, MP4, or QuickTime/);
 assert.match(validateMaintenanceMedia({mimeType:'video/mp4',fileSize:100*1024*1024+1,type:'video'},0),/100 MB/);
 assert.match(validateMaintenanceMedia({mimeType:'image/png',fileSize:1,type:'image'},10),/Up to 10/);
 assert.match(intake,/validateMaintenanceMedia/);assert.match(detail,/validateMaintenanceMedia/);
});

test('private evidence downloads to an authenticated local file without JS base64 or data URIs',()=>{
 assert.match(api,/downloadAsync/);assert.match(api,/Authorization/);assert.match(api,/X-Organization-Id/);assert.match(api,/documentDirectory|cacheDirectory/);
 assert.match(detail,/Sharing\.shareAsync/);assert.match(landlordDetail,/Sharing\.shareAsync/);assert.doesNotMatch(detail,/base64|data:/);assert.doesNotMatch(api,/arraybuffer/);
});

test('idempotency keys are supplied by logical actions and retained for retry',()=>{
 assert.match(api,/idempotencyKey: string/);assert.match(api,/mutationConfig\(idempotencyKey\)/);assert.doesNotMatch(api,/mutationConfig = \(\) =>/);
 assert.match(intake,/useRef\(newIdempotencyKey\(\)\)/);assert.match(detail,/actionKeys/);assert.match(landlordDetail,/actionKeys/);assert.match(api,/media\.idempotencyKey/);
});

test('completion evidence is validated, uploaded first, and its real attachment reference is submitted',()=>{
 assert.match(landlordDetail,/pickCompletionEvidence/);assert.match(landlordDetail,/validateMaintenanceMedia/);assert.match(landlordDetail,/uploadAttachment\(requestId,\s*'Completion'/);assert.match(landlordDetail,/uploadedCompletionAttachmentIds/);assert.match(landlordDetail,/attachments:\$\{allUploadedIds\.join/);assert.match(landlordDetail,/retry only the failed evidence/);assert.doesNotMatch(landlordDetail,/completionEvidenceReference:\s*null/);
});
test('tenant owns appointment confirmation and both authorized views can cancel appointments',()=>{
 assert.match(detail,/confirmAppointment/);assert.match(detail,/cancelAppointment/);assert.doesNotMatch(landlordDetail,/confirmAppointment/);assert.match(landlordDetail,/cancelAppointment/);assert.match(api,/cancelAppointment/);assert.match(api,/appointments\/\$\{appointmentId\}\/cancel/);
});
test('role routing is active-context aware and never sends vendors to landlord screens',()=>{
 const tenantAudience=maintenanceAudience({roles:['Landlord','Tenant'],currentOrganizationRole:'Tenant'});
 const landlordAudience=maintenanceAudience({currentOrganizationRole:'Landlord'});
 const vendorAudience=maintenanceAudience({currentOrganizationRole:'Vendor'});
 assert.equal(tenantAudience,'tenant');assert.deepEqual(visibleMainTabsForAudience(tenantAudience).map((tab)=>tab.name),['Maintenance','Messages','Settings']);
 assert.equal(landlordAudience,'landlord');assert.deepEqual(visibleMainTabsForAudience(landlordAudience).map((tab)=>tab.name),['Dashboard','Properties','Checklists','Maintenance','Messages']);
 assert.equal(vendorAudience,'unsupported');assert.deepEqual(visibleMainTabsForAudience(vendorAudience).map((tab)=>tab.name),['Maintenance','Settings']);
});
test('pending completion lookup never falls back to decided completions',()=>{
 assert.equal(findPendingCompletion({completions:[{id:1,status:'Accepted'},{id:2,status:'Disputed'}]}),undefined);assert.deepEqual(findPendingCompletion({completions:[{id:3,status:'Submitted'}]}),{id:3,status:'Submitted'});assert.match(api,/return findPendingCompletion<MaintenanceCompletion>\(item\)/);
});
test('multi-lease intake requires an explicit affected-home selection',()=>{assert.match(intake,/leases\.map/);assert.match(intake,/Select the affected home/);assert.match(intake,/setScope/);assert.doesNotMatch(intake,/\|\| leases\[0\]/);});
test('acknowledgement, cancellation and workflow actions are state gated',()=>{
 assert.match(landlordDetail,/acknowledge/);assert.match(landlordDetail,/cancelWorkOrder/);assert.match(landlordDetail,/cancelAppointment/);assert.match(landlordDetail,/canAcknowledge/);assert.match(landlordDetail,/canSubmitEstimate/);assert.match(landlordDetail,/canIssueWorkOrder/);assert.match(landlordDetail,/confirmationDue/);
});
test('reopen happens before reopen-purpose upload and stale retries are explained',()=>{
 const decideStart=detail.indexOf('const decide=');const decideEnd=detail.indexOf('const openEvidence=',decideStart);const body=detail.slice(decideStart,decideEnd);assert.ok(body.indexOf('reopenCompletion')<body.indexOf('uploadReopenEvidence'));
 assert.match(receipt,/getDetail/);assert.match(receipt,/Evidence can only be added while the report is still newly reported/);assert.match(receipt,/retryStage/);
});
test('landlord list offers current/history and visible retryable load errors',()=>{assert.match(landlordList,/getHistory/);assert.match(landlordList,/Current/);assert.match(landlordList,/History/);assert.match(landlordList,/setError/);assert.match(landlordList,/Retry/);});
test('private evidence uses anonymous temporary names and is cleaned after share/view',()=>{assert.match(api,/Crypto\.randomUUID\(\)/);assert.match(api,/deleteDownloadedAttachment/);assert.doesNotMatch(api,/attachment\.fileName\)}`/);assert.match(detail,/finally\s*\{[^}]*deleteDownloadedAttachment/s);assert.match(landlordDetail,/finally\s*\{[^}]*deleteDownloadedAttachment/s);});
test('iPhone HEIC assets request a compatible representation with a clear fallback',()=>{assert.match(intake,/preferredAssetRepresentationMode/);assert.match(detail,/preferredAssetRepresentationMode/);assert.match(landlordDetail,/preferredAssetRepresentationMode/);assert.match(model,/HEIC|HEIF/);});

test('active Owner context receives landlord maintenance but Vendor never does',()=>{assert.equal(maintenanceAudience({currentOrganizationRole:'Owner',roles:['Vendor']}),'landlord');assert.equal(maintenanceAudience({currentOrganizationRole:'Vendor',roles:['Landlord']}),'unsupported');});
test('compatible picker filenames are normalized to the actual MIME extension',()=>{assert.equal(normalizeMaintenanceMediaFileName('repair.heic','image/jpeg'),'repair.jpg');assert.equal(normalizeMaintenanceMediaFileName('repair.HEIF','image/jpeg'),'repair.jpg');assert.equal(normalizeMaintenanceMediaFileName('clip.mp4','video/quicktime'),'clip.mov');for(const screen of [intake,detail,landlordDetail])assert.match(screen,/normalizeMaintenanceMediaFileName/);});
test('completion uploads replace retry state from active current-cycle detail and count toward the cap',()=>{
 const detailWithCycles={resolutionCycle:2,attachments:[{id:1,purpose:'Completion',resolutionCycle:1},{id:2,purpose:'Completion',resolutionCycle:2},{id:3,purpose:'Reopen',resolutionCycle:2},{id:4,purpose:2,resolutionCycle:2},{id:5,purpose:'Completion',resolutionCycle:2,lifecycleState:'PendingDeletion'}]};
 assert.deepEqual(currentCycleCompletionAttachmentIds(detailWithCycles),[2,4]);
 assert.deepEqual(currentCycleCompletionAttachmentIds({...detailWithCycles,resolutionCycle:3}),[],'advancing the cycle must remove prior-cycle retry evidence');
 assert.equal(currentCycleCompletionAttachmentIds({resolutionCycle:4,attachments:Array.from({length:10},(_,index)=>({id:index+10,purpose:'Completion',resolutionCycle:4}))}).length,10);
 assert.match(landlordDetail,/setUploadedCompletionAttachmentIds\(currentCycleCompletionAttachmentIds\(detail\)\)/);
 assert.doesNotMatch(landlordDetail,/setUploadedCompletionAttachmentIds\(previous/);
 assert.match(landlordDetail,/evidenceCount>=10/);
});
test('tenant list clears stale tab results when loading fails',()=>{assert.match(read('src/screens/tenant/TenantMaintenanceScreen.tsx'),/catch[^}]*setItems\(\[\]\)/s);});
test('receipt keeps unknown network status distinct from a closed evidence stage',()=>{assert.match(receipt,/unknown/);assert.match(receipt,/Refresh status/);assert.match(receipt,/Retry upload anyway/);assert.doesNotMatch(receipt,/catch\s*\{\s*return false/);});
test('assignment uses API-backed named directories instead of raw IDs',()=>{assert.match(api,/\/api\/vendor\?landlordId=/);assert.match(api,/\/api\/organization\/members\//);assert.match(landlordDetail,/assignmentOptions/);assert.doesNotMatch(landlordDetail,/placeholder=\{`\$\{assigneeType.*ID/);});
test('destructive reasons and appointment/completion notes are not shared',()=>{for(const name of ['estimateRejectReason','appointmentCancelReason','workOrderCancelReason','staffCloseReason','appointmentNotes','resolutionNotes'])assert.match(landlordDetail,new RegExp(name));assert.doesNotMatch(landlordDetail,/const \[reason,/);assert.doesNotMatch(landlordDetail,/Appointment \/ resolution notes/);});
test('appointment input requires explicit ISO date-times with timezone',()=>{assert.match(landlordDetail,/ISO_DATE_TIME_WITH_ZONE/);assert.match(landlordDetail,/2026-08-10T09:00:00-04:00/);assert.match(landlordDetail,/textContentType="none"/);});
test('tenant appointment cancellation and completion reopen use isolated reason state',()=>{
 for(const name of ['appointmentCancelReason','completionReopenReason'])assert.match(detail,new RegExp(name));
 assert.doesNotMatch(detail,/const \[reason,/);
 assert.match(detail,/cancelAppointment[^\n]+appointmentCancelReason\.trim\(\)/);
 assert.match(detail,/reopenCompletion\([^\n]+completionReopenReason\.trim\(\)/);
});
test('assignment directory reports member and vendor partial failures without claiming an empty directory',()=>{
 assert.match(api,/MaintenanceAssignmentDirectory/);
 assert.match(api,/failedSources/);
 assert.match(api,/memberResult\.status === 'rejected'/);
 assert.match(api,/vendorResult\.status === 'rejected'/);
 assert.match(landlordDetail,/Retry assignment directory/);
 assert.match(landlordDetail,/Some assignment options could not be loaded/);
 assert.match(landlordDetail,/directoryFailedSources/);
});
