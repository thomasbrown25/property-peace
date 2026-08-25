import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ADVANCED_REPORTING_FEATURE,
  buildEntitlementCacheKey,
  deriveEntitlementState,
  getEntitlementPresentation,
  normalizeEntitlementDecision
} from '../utils/entitlements.js';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');
const detailSlugs = [
  'occupancy', 'revenue-per-unit', 'units-per-client', 'client-churn',
  'units-per-employee', 'closing-rate', 'median-dom', 'median-ttt',
  'nps-client', 'nps-tenant', 'financial', 'tax'
];

const allowedDecision = () => ({
  isAllowed: true,
  matrixVersion: '2026.09.v1',
  featureKey: ADVANCED_REPORTING_FEATURE,
  effectivePlan: 'premium',
  reasonCode: 'allowed',
  category: 'allowed',
  quota: null,
  requiredAddOns: [],
  readinessDependencies: []
});

test('normalizer accepts complete camelCase and PascalCase server decisions', () => {
  const camel = normalizeEntitlementDecision(allowedDecision());
  assert.equal(camel.isAllowed, true);
  assert.equal(camel.reasonCode, 'allowed');
  assert.equal(camel.matrixVersion, '2026.09.v1');
  assert.equal(getEntitlementPresentation(camel).canInvoke, true);

  const pascal = normalizeEntitlementDecision({
    IsAllowed: false, MatrixVersion: 'future-matrix', FeatureKey: 'advanced-reporting',
    EffectivePlan: null, ReasonCode: 'upgrade-required', Category: 'Upgrade',
    Quota: null, RequiredAddOns: ['analytics'], ReadinessDependencies: []
  });
  assert.equal(pascal.category, 'upgrade');
  assert.equal(pascal.matrixVersion, 'future-matrix');
  assert.equal(getEntitlementPresentation(pascal).kind, 'upgrade');
});

test('normalizer fails closed for wrong feature, unknown category, and contradictory allow', () => {
  for (const payload of [
    null,
    {},
    { ...allowedDecision(), featureKey: 'other-feature' },
    { ...allowedDecision(), category: 'future-category' },
    { ...allowedDecision(), isAllowed: false }
  ]) {
    const decision = normalizeEntitlementDecision(payload);
    assert.equal(decision.isAllowed, false);
    assert.equal(getEntitlementPresentation(decision).canInvoke, false);
    assert.equal(getEntitlementPresentation(decision).kind, 'unavailable');
  }
});

test('normalizer rejects every absent or invalid required field so malformed allows never invoke', () => {
  const invalidMutations = [
    ['isAllowed absent', (value) => delete value.isAllowed],
    ['isAllowed invalid', (value) => { value.isAllowed = 'true'; }],
    ['matrixVersion absent', (value) => delete value.matrixVersion],
    ['matrixVersion invalid', (value) => { value.matrixVersion = 11; }],
    ['featureKey absent', (value) => delete value.featureKey],
    ['featureKey invalid', (value) => { value.featureKey = 42; }],
    ['effectivePlan absent', (value) => delete value.effectivePlan],
    ['effectivePlan invalid', (value) => { value.effectivePlan = {}; }],
    ['reasonCode absent', (value) => delete value.reasonCode],
    ['reasonCode invalid', (value) => { value.reasonCode = null; }],
    ['category absent', (value) => delete value.category],
    ['category invalid', (value) => { value.category = 1; }],
    ['quota absent', (value) => delete value.quota],
    ['quota invalid', (value) => { value.quota = 'none'; }],
    ['requiredAddOns absent', (value) => delete value.requiredAddOns],
    ['requiredAddOns invalid', (value) => { value.requiredAddOns = 'analytics'; }],
    ['readinessDependencies absent', (value) => delete value.readinessDependencies],
    ['readinessDependencies invalid', (value) => { value.readinessDependencies = {}; }]
  ];

  for (const [label, mutate] of invalidMutations) {
    const payload = allowedDecision();
    mutate(payload);
    const decision = normalizeEntitlementDecision(payload);
    assert.equal(decision.isAllowed, false, label);
    assert.equal(decision.malformed, true, label);
    assert.equal(getEntitlementPresentation(decision).canInvoke, false, label);
  }
});

test('normalizer strictly validates nested collections and quota without coercion', () => {
  const invalidMutations = [
    ['empty add-on', (value) => { value.requiredAddOns = ['']; }],
    ['blank add-on', (value) => { value.requiredAddOns = ['   ']; }],
    ['non-string add-on', (value) => { value.requiredAddOns = ['analytics', 1]; }],
    ['empty readiness dependency', (value) => { value.readinessDependencies = ['']; }],
    ['blank readiness dependency', (value) => { value.readinessDependencies = ['\t']; }],
    ['non-string readiness dependency', (value) => { value.readinessDependencies = [null]; }],
    ['quota array', (value) => { value.quota = []; }],
    ['quota missing unit', (value) => { value.quota = { limit: 1 }; }],
    ['quota blank unit', (value) => { value.quota = { unit: ' ', limit: 1 }; }],
    ['quota missing limit', (value) => { value.quota = { unit: 'reports' }; }],
    ['quota coerced limit', (value) => { value.quota = { unit: 'reports', limit: '1' }; }],
    ['quota fractional limit', (value) => { value.quota = { unit: 'reports', limit: 1.5 }; }],
    ['quota negative limit', (value) => { value.quota = { unit: 'reports', limit: -1 }; }],
    ['quota NaN limit', (value) => { value.quota = { unit: 'reports', limit: Number.NaN }; }],
    ['quota infinite limit', (value) => { value.quota = { unit: 'reports', limit: Number.POSITIVE_INFINITY }; }],
    ['quota extra field', (value) => { value.quota = { unit: 'reports', limit: 1, used: 0 }; }]
  ];

  for (const [label, mutate] of invalidMutations) {
    const payload = allowedDecision();
    mutate(payload);
    const decision = normalizeEntitlementDecision(payload);
    assert.equal(decision.malformed, true, label);
    assert.equal(getEntitlementPresentation(decision).canInvoke, false, label);
  }

  const camelQuota = normalizeEntitlementDecision({ ...allowedDecision(), quota: { unit: 'reports', limit: 0 } });
  assert.deepEqual(camelQuota.quota, { unit: 'reports', limit: 0 });
  assert.equal(getEntitlementPresentation(camelQuota).canInvoke, true);

  const pascalQuota = normalizeEntitlementDecision({
    IsAllowed: true, MatrixVersion: '2026.09.v1', FeatureKey: ADVANCED_REPORTING_FEATURE,
    EffectivePlan: 'premium', ReasonCode: 'allowed', Category: 'Allowed',
    Quota: { Unit: 'reports', Limit: 10 }, RequiredAddOns: [], ReadinessDependencies: []
  });
  assert.deepEqual(pascalQuota.quota, { unit: 'reports', limit: 10 });
  assert.equal(getEntitlementPresentation(pascalQuota).canInvoke, true);
});

test('hook state derivation ends failed initial loading and fails closed during cached revalidation', () => {
  const normalizedAllowed = normalizeEntitlementDecision(allowedDecision());

  const initialPending = deriveEntitlementState(null, {
    hasCacheKey: true, requestLoading: true, isValidating: true
  });
  assert.equal(initialPending.isLoading, true);
  assert.deepEqual(initialPending.presentation, { kind: 'loading', canInvoke: false });

  const initialFailure = deriveEntitlementState(null, {
    hasCacheKey: true, requestLoading: false, isValidating: false, error: new Error('network')
  });
  assert.equal(initialFailure.isLoading, false);
  assert.deepEqual(initialFailure.presentation, { kind: 'unavailable', canInvoke: false });

  const settledWithoutData = deriveEntitlementState(null, {
    hasCacheKey: true, requestLoading: false, isValidating: false
  });
  assert.equal(settledWithoutData.isLoading, false);
  assert.deepEqual(settledWithoutData.presentation, { kind: 'unavailable', canInvoke: false });

  const cachedRevalidation = deriveEntitlementState(normalizedAllowed, {
    hasCacheKey: true, requestLoading: false, isValidating: true
  });
  assert.equal(cachedRevalidation.isLoading, true);
  assert.equal(cachedRevalidation.presentation.canInvoke, false);

  const failedRevalidation = deriveEntitlementState(normalizedAllowed, {
    hasCacheKey: true, requestLoading: false, isValidating: false, error: new Error('refresh failed')
  });
  assert.equal(failedRevalidation.isLoading, false);
  assert.deepEqual(failedRevalidation.presentation, { kind: 'unavailable', canInvoke: false });

  const refreshed = deriveEntitlementState(normalizedAllowed, {
    hasCacheKey: true, requestLoading: false, isValidating: false
  });
  assert.equal(refreshed.isLoading, false);
  assert.deepEqual(refreshed.presentation, { kind: 'allowed', canInvoke: true });
});

test('presentation maps authoritative denied states plus loading without granting invoke', () => {
  assert.equal(getEntitlementPresentation(null, { isLoading: true }).kind, 'loading');
  for (const kind of ['upgrade', 'setup', 'unauthorized', 'unavailable']) {
    const decision = normalizeEntitlementDecision({
      ...allowedDecision(), isAllowed: false, category: kind, reasonCode: `${kind}-reason`
    });
    assert.equal(getEntitlementPresentation(decision).kind, kind);
    assert.equal(getEntitlementPresentation(decision).canInvoke, false);
  }
});

test('entitlement API is allow-listed and sends only the encoded path', async () => {
  const source = await read('../api/entitlements.js');
  assert.match(source, /axiosServices\.get\(`\/api\/entitlements\/\$\{encodeURIComponent\(feature\)\}`\)/);
  assert.doesNotMatch(source, /organizationId|params:|\?org/i);
  assert.match(source, /isSupportedEntitlementFeature/);
});

test('cache key varies by feature, authenticated subject, and selected organization', async () => {
  const a = buildEntitlementCacheKey({ feature: ADVANCED_REPORTING_FEATURE, subject: 'user-1', organizationId: 10 });
  const b = buildEntitlementCacheKey({ feature: ADVANCED_REPORTING_FEATURE, subject: 'user-1', organizationId: 11 });
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, ['entitlement', ADVANCED_REPORTING_FEATURE, 'user-1', '10']);
  assert.equal(buildEntitlementCacheKey({ feature: ADVANCED_REPORTING_FEATURE, subject: null, organizationId: 10 }), null);
  assert.equal(buildEntitlementCacheKey({ feature: ADVANCED_REPORTING_FEATURE, subject: 'user-1', organizationId: null }), null);

  const hook = await read('../hooks/useEntitlement.js');
  assert.match(hook, /keepPreviousData: false/);
  assert.match(hook, /data\.cacheKey === serializedCacheKey/);
  assert.match(hook, /const refresh = \(\) => mutate\(\)/);
  assert.doesNotMatch(hook, /refresh: mutate/);
});

test('all advanced report routes are gated while the dashboard stays visible and discoverable', async () => {
  const routes = await read('./MainRoutes.jsx');
  const menu = await read('../menu-items/pages.js');
  assert.match(routes, /const ReportsDashboard = Loadable\(lazy\(\(\) => import\('pages\/landlord\/reports'\)\)\)/);
  assert.match(routes, /path: 'landlord\/reports'[\s\S]{0,120}element: <ReportsDashboard \/>/);
  assert.match(menu, /title: 'Reports & Analytics'[\s\S]{0,100}url: '\/landlord\/reports'/);
  for (const slug of detailSlugs) {
    const route = new RegExp(`path: 'landlord\\/reports\\/${slug}'[\\s\\S]{0,260}<EntitlementGate`);
    assert.match(routes, route, `missing centralized gate for ${slug}`);
  }
  assert.match(routes, /path: 'landlord\/reports\/tax'[\s\S]{0,160}<EntitlementGate><TaxReports \/><\/EntitlementGate>/);
  assert.match(routes, /path: 'landlord\/money\/tax-center'[\s\S]{0,160}<EntitlementGate><TaxReports \/><\/EntitlementGate>/);
  assert.doesNotMatch(routes, /path: 'landlord\/reports(?:\/tax)?'[\s\S]{0,120}<Navigate/);
});

test('reports dashboard maps each entitlement state without local plan authorization', async () => {
  const dashboard = await read('../pages/landlord/reports/index.jsx');
  assert.match(dashboard, /useEntitlement\(ADVANCED_REPORTING_FEATURE\)/);
  assert.doesNotMatch(dashboard, /useSubscription|planName|hasPremiumAccess|includes\('lifetime'\)/);
  assert.match(dashboard, /presentation\.kind === 'upgrade'/);
  assert.match(dashboard, /presentation\.kind === 'setup'/);
  assert.match(dashboard, /presentation\.kind === 'unauthorized'/);
  assert.match(dashboard, /presentation\.kind === 'unavailable'/);
  assert.match(dashboard, /onClick={refresh}/);
  assert.match(dashboard, /to="\/landlord\/setup"/);
  assert.match(dashboard, /Ask an organization owner or administrator/);
  assert.match(dashboard, /Reporting access cannot be confirmed/);
  assert.doesNotMatch(dashboard, /locked \? 'Premium workspace'/);
});

test('reports dashboard locked cards and controls preserve accessible behavior', async () => {
  const dashboard = await read('../pages/landlord/reports/index.jsx');
  assert.match(dashboard, /aria-disabled={locked}/);
  assert.doesNotMatch(dashboard, /role="link"/);
  assert.match(dashboard, /placeholder="Search reports"[\s\S]{0,220}minHeight: 44/);
  assert.match(dashboard, /clickable[\s\S]{0,240}minHeight: 44/);
  assert.match(dashboard, /setFilter\('All reports'\); }} sx={{ mt: 1\.5, minHeight: 44 }}>Clear filters<\/Button>/);
});

test('detail report pages contain no duplicated plan authorization', async () => {
  for (const slug of detailSlugs) {
    const detail = await read(`../pages/landlord/reports/${slug}.jsx`);
    assert.doesNotMatch(detail, /useSubscription|subscriptionLoading|hasPremiumAccess|planName|premium subscription/i, slug);
  }
});

test('gate state and CTA contracts are accessible and honest', async () => {
  const gate = await read('../components/entitlements/EntitlementGate.jsx');
  assert.match(gate, /aria-live="polite"/);
  assert.match(gate, /Skeleton|CircularProgress/);
  assert.match(gate, /\/landlord\/settings\?tab=subscription/);
  assert.match(gate, /showUpgrade/);
  assert.match(gate, /presentation\.kind === 'unauthorized'/);
  assert.match(gate, /presentation\.kind === 'setup'/);
  assert.match(gate, /onClick={refresh}/);
  assert.match(gate, /minHeight: 44/);
});

test('axios normalization retains structured payload at top-level and attaches HTTP status', async () => {
  const axios = await read('../utils/axios.js');
  assert.match(axios, /normalizeAxiosError/);
  assert.match(axios, /\.\.\.payload/);
  assert.match(axios, /status: error\.response\?\.status/);
  assert.match(axios, /statusText: error\.response\?\.statusText/);
  assert.match(axios, /ensureActiveAccessToken/);
});

test('Milestone 11 public offer copy uses the free tier instead of a stale trial', async () => {
  const [register, seo, metadata, trialBanner, planCard] = await Promise.all([
    read('../sections/auth/jwt/AuthRegister.jsx'),
    read('../components/SEO/SEOHead.jsx'),
    read('../../index.html'),
    read('../components/subscription/TrialBanner.jsx'),
    read('../components/subscription/PlanCard.jsx')
  ]);
  assert.match(register, /Start Free/);
  assert.match(register, /Free for up to 5 units/);
  assert.doesNotMatch(register, /30-day trial/i);
  assert.match(seo, /Start Free/);
  assert.match(seo, /free for up to 5 units/i);
  assert.match(seo, /online rent payments are included in Free after organization approval and setup/i);
  assert.doesNotMatch(seo, /30-day trial/i);
  assert.match(metadata, /Start Free/i);
  assert.match(metadata, /Free (?:for )?up to 5 units/i);
  assert.match(metadata, /online rent payments are included in Free after organization approval and setup/i);
  assert.doesNotMatch(metadata, /(?:free )?30-day trial|30-day free trial|start free trial/i);
  assert.match(trialBanner, /Start Free/);
  assert.match(trialBanner, /Free (?:for )?up to 5 units/i);
  assert.doesNotMatch(trialBanner, /trial/i);
  assert.match(planCard, /Start Free/);
  assert.doesNotMatch(planCard, /(?:free )?trial|trialDays/i);
});

test('Milestone 11 SMS copy describes the included number and activation requirements without inventing capabilities', async () => {
  const settings = await read('../sections/landlord/settings/SmsNumberSettings.jsx');
  assert.match(settings, /Premium and Lifetime/i);
  assert.match(settings, /one dedicated (?:organization )?SMS number/i);
  assert.match(settings, /no additional add-on charge/i);
  assert.match(settings, /activation and configuration are required/i);
  assert.doesNotMatch(settings, /Inbox routing|voice|MMS/i);
  assert.doesNotMatch(settings, /useSubscription|hasPremiumSubscription/);
  assert.match(settings, /useEntitlement\(DEDICATED_SMS_NUMBER_SETUP_FEATURE\)/);
});

test('LeaseShield and Rent Estimate use centralized entitlement state without local plan authorization', async () => {
  const leaseShield = await read('../pages/landlord/lease-shield.jsx');
  assert.match(leaseShield, /useEntitlement\(LEASE_SHIELD_READ_FEATURE\)/);
  assert.match(leaseShield, /useEntitlement\(LEASE_SHIELD_MANAGE_FEATURE\)/);
  assert.doesNotMatch(leaseShield, /isPremium|subscriptionLoading|useSubscription|planName|includes\('lifetime'\)/);
  assert.match(leaseShield, /if \(!canManage\) return/);

  const rentEstimate = await read('../components/RentEstimateCard.jsx');
  assert.match(rentEstimate, /useEntitlement\(RENT_ESTIMATE_FEATURE\)/);
  assert.doesNotMatch(rentEstimate, /isPremium|useSubscription|planName|includes\('lifetime'\)/);
  assert.match(rentEstimate, /if \(!propertyId \|\| !canInvoke\) return/);
});

test('plan comparison derives feature cells from supplied feature data and readiness', async () => {
  const comparison = await read('../components/subscription/PlanComparisonTable.jsx');
  assert.match(comparison, /const features = plan\._expanded \?\? parseFeatures\(plan\)/);
  assert.match(comparison, /features\.some/);
  assert.doesNotMatch(comparison, /isAllIncludedPlan|FREE_INCLUDED_FEATURES/);
  assert.doesNotMatch(comparison, /name\.includes\('premium'\).*return true|name\.includes\('lifetime'\).*return true/s);
});
