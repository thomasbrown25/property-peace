import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('landlord lead workspace source is preserved but hidden from navigation and routing', async () => {
  const [routes, menu, workspace] = await Promise.all([
    source('../routes/MainRoutes.jsx'), source('../menu-items/pages.js'), source('../pages/landlord/leads.jsx')
  ]);
  assert.doesNotMatch(routes, /pages\/landlord\/leads|path: 'landlord\/leads'/);
  assert.doesNotMatch(menu, /id: 'leads'|title: 'Leads & Showings'|url: '\/landlord\/leads'/);
  assert.match(workspace, /LeadFilters/);
  assert.match(workspace, /LeadTable/);
  assert.match(workspace, /ShowingsPanel/);
  assert.match(workspace, /No leads match these filters|No inquiries yet/);
  assert.match(workspace, /Lead workspace unavailable/);
});

test('lead API adapter uses the implemented controller routes and concurrency contracts', async () => {
  const api = await source('../api/leads.js');
  for (const route of [
    '/api/leads', '/notes', '/tasks', '/complete', '/convert-to-application',
    '/showing-availability', '/api/leads/showings', '/reschedule', '/cancel'
  ]) assert.ok(api.includes(route), route);
  assert.match(api, /headers: \{ 'If-Match': concurrencyToken \}/);
  assert.match(api, /\/api\/public\/listings\/\$\{id\(listingId, 'listing id'\)\}\/leads\/inquiries/);
  assert.match(api, /normalizeInquiryResult/);
  assert.doesNotMatch(api, /console\.(log|debug|info)/);
});

test('public listing offers inquiry before application and does not render raw credentials', async () => {
  const [listing, inquiry, api] = await Promise.all([
    source('../pages/public/listing/[listingNumber].jsx'), source('../components/lead-crm/PublicInquiryDialog.jsx'),
    source('../api/leads.js')
  ]);
  assert.match(listing, /PublicInquiryDialog/);
  assert.match(listing, /Ask about this home/);
  assert.match(inquiry, /contact verification entry code/);
  assert.match(inquiry, /Inquiry receipt/);
  assert.match(inquiry, /Manage a showing/);
  for (const adapter of ['authenticatePublicShowing', 'cancelPublicShowing', 'reschedulePublicShowing'])
    assert.match(inquiry, new RegExp(`await ${adapter}\\(`));
  assert.match(inquiry, /type="password" label="Management code"/);
  assert.match(inquiry, /setManagementCode\(''\)/);
  assert.match(inquiry, /setShowingReference\(''\)/);
  assert.doesNotMatch(inquiry, /localStorage|sessionStorage|URLSearchParams/);
  assert.match(api, /showings\/\$\{id\(showingId, 'showing id'\)\}\/manage/);
  assert.match(api, /\{ session, concurrencyToken \}/);
  assert.match(inquiry, /verifyLeadContact/);
  assert.match(inquiry, /bookPublicShowing/);
  assert.match(inquiry, /Verification entry code/);
  assert.match(inquiry, /Book showing/);
  assert.doesNotMatch(inquiry, /result\.(token|accessToken|managementToken)/);
  assert.doesNotMatch(inquiry, /console\.(log|debug|info)/);
});

test('core lead detail exposes only supported notes, tasks, status, showing, configuration, and conversion actions', async () => {
  const detail = await source('../components/lead-crm/LeadDetailDrawer.jsx');
  assert.match(detail, /Contact verified|Verification pending/);
  assert.match(detail, /Pre-screen answers/);
  assert.match(detail, /lead\.preScreenResponse/);
  assert.match(detail, /Activity is based on saved lead, note, task, and showing records/);
  assert.match(detail, /addLeadNote/);
  assert.match(detail, /addLeadTask/);
  assert.match(detail, /completeLeadTask/);
  assert.match(detail, /convertLeadToApplication/);
  assert.match(detail, /updateLead/);
});
