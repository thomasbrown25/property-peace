import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('staff workflow uses server quote options, idempotency, criteria/report revisions, notices, and access revocation', async () => {
  const page = await source('../pages/landlord/screenings.jsx');
  const api = await source('../api/screening.js');
  assert.match(page, /screeningApi\.quoteOptions\(id\)/);
  assert.match(page, /getPayerLabel\(item\)/);
  assert.match(page, /Authoritative fee breakdown/);
  assert.match(page, /criteriaVersion, reportRevisionId: latestReportId, reasonCodes/);
  assert.match(page, /screeningApi\.adverseAction/);
  assert.match(page, /screeningApi\.retryAdverseAction/);
  assert.match(page, /screeningApi\.revokeAccess/);
  assert.match(page, /screeningApi\.reportAccess/);
  assert.match(page, /getSafeNavigationUrl\(response\.data\?\.data \?\? response\.data, exchangeMetadata\(response\)\)/);
  assert.match(page, /navigateTopLevel\(destination\)/);
  assert.match(api, /'Idempotency-Key': idempotencyKey/);
});

test('applicant workflow handles terminal access states and only navigates after validated exchanges', async () => {
  const page = await source('../pages/apply/ApplicantScreeningPage.jsx');
  const api = await source('../api/screening.js');
  assert.match(page, /screeningErrorState\(error\.status\)/);
  assert.match(page, /getSafeNavigationUrl\(body, exchangeMetadata\(response\)\)/);
  assert.ok(page.indexOf('getSafeNavigationUrl(body, exchangeMetadata(response))') < page.indexOf('navigateTopLevel(destination)'));
  assert.match(api, /cache: 'no-store'/);
  assert.match(api, /'X-Screening-Access': token/);
  assert.match(api, /reportAccess: \(token\).*'\/report-access'/s);
  assert.match(page, /rentalCriteriaStatement/);
  assert.match(page, /reasonCodes/);
  assert.match(page, /applicantScreeningApi\.adverseAction\(token\)/);
  assert.match(page, /immutableNoticeContent/);
  assert.match(page, /disputeRightsStatement/);
});

test('applicant page does not render provider URLs, quote references, normalized facts, or report references', async () => {
  const page = await source('../pages/apply/ApplicantScreeningPage.jsx');
  assert.doesNotMatch(page, /providerUrl|providerReference|continuationUrl\}/i);
  assert.doesNotMatch(page, /normalizedFacts|facts\.map|reportReference/i);
  assert.doesNotMatch(page, />\s*\{value\(invitation, 'quoteReference'\)\}/);
});

test('staff option selection does not pretend unquoted fees are authoritative', async () => {
  const page = await source('../pages/landlord/screenings.jsx');
  assert.match(page, /Exact fees are locked by the server when the\s+order is created/);
  assert.doesNotMatch(page, /<QuoteBreakdown quote=\{optionQuote\}/);
});

test('public applicant token route is outside authenticated dashboard routes', async () => {
  const routes = await source('../routes/LoginRoutes.jsx');
  assert.match(routes, /element: <SecureApplicantLayout \/>[\s\S]*path: ':token', element: <ApplicantScreeningPage \/>/);
  assert.ok(routes.indexOf('element: <SecureApplicantLayout />') < routes.indexOf('element: <AuthLayout />'));
  assert.match(routes, /path: 'screening'[\s\S]*index: true, element: <ApplicantScreeningPage \/>/);
  assert.doesNotMatch(routes, /path: 'screening'[\s\S]{0,300}GuestGuard/);
});

test('capability bootstrap exchanges and scrubs the URL before rendering providers', async () => {
  const entry = await source('../index.jsx');
  const html = await source('../../index.html');
  assert.match(entry, /Referrer-Policy/);
  assert.match(entry, /no-referrer/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /!\/\^\\\/screening/);
  assert.doesNotMatch(html, /<script async src="https:\/\/www\.googletagmanager\.com/);
  assert.match(entry, /robots/);
  assert.match(entry, /noindex, nofollow/);
  assert.match(entry, /isApplicantScreeningRoute/);
  assert.ok(entry.indexOf("setMeta(null, 'robots', 'noindex, nofollow')") < entry.indexOf('if (!match) return'));
  assert.match(entry, /applicant\/session/);
  assert.match(entry, /history\.replaceState\(null, '', '\/screening'\)/);
  assert.ok(entry.indexOf("fetch('/api/screenings/applicant/session'") < entry.indexOf('root.render('));
});

test('applicant can submit a coded dispute bound to the latest report revision', async () => {
  const page = await source('../pages/apply/ApplicantScreeningPage.jsx');
  const api = await source('../api/screening.js');
  assert.match(api, /dispute: \(token, payload\).*'\/disputes'/s);
  assert.match(page, /reportRevisionId: latestReportRevision/);
  assert.match(page, /issueCodes/);
  assert.match(page, /disputeNarrative/);
  assert.match(page, /Submit report dispute/);
});

test('staff decisions show frozen criteria and accept authoritative select-only reason codes', async () => {
  const page = await source('../pages/landlord/screenings.jsx');
  assert.match(page, /rentalCriteriaStatement/);
  assert.match(page, /reasonCodeOptions/);
  assert.match(page, /multiple/);
  assert.doesNotMatch(page, /label="Reason codes"[\s\S]{0,200}TextField/);
  assert.match(page, /labelId="decision-label"/);
  assert.match(page, /labelId="reason-codes-label"/);
  assert.match(page, /setDetail\(await screeningApi\.detail\(id\)\);[\s\S]*setReasonCodes\(\[\]\)/);
  assert.match(page, /labelId="notice-stage-label"/);
  assert.match(page, /labelId="delivery-channel-label"/);
});

test('both authorized staff roles can discover the guarded screening workspace', async () => {
  const landlordMenu = await source('../menu-items/pages.js');
  const adminMenu = await source('../menu-items/admin-pages.js');
  const guard = await source('../components/auth/ScreeningStaffRoute.jsx');
  assert.match(landlordMenu, /title: 'Screenings'[\s\S]{0,120}url: '\/landlord\/screenings'/);
  assert.match(adminMenu, /title: 'Screenings'[\s\S]{0,120}url: '\/landlord\/screenings'/);
  assert.match(guard, /role === 'landlord' \|\| role === 'admin'/);
});
