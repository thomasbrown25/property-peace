import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

const tenantPaymentsPath = '../pages/tenant/payments.jsx';
const tenantDashboardPath = '../pages/tenant/dashboard.jsx';
const listingSetupPath = '../pages/landlord/listing-setup.jsx';
const pricingTablePath = '../components/subscription/PricingTable.jsx';
const planCardPath = '../components/subscription/PlanCard.jsx';
const comparisonPath = '../components/subscription/PlanComparisonTable.jsx';
const readinessHookPath = '../hooks/useFeatureReadiness.js';
const landlordRentCollectionPath = '../pages/landlord/rent-collection.jsx';
const landlordLeasePath = '../pages/landlord/lease.jsx';
const listingSetupApplicationPath = '../pages/landlord/listing-setup-application.jsx';
const listingAddWorkflowPath = '../pages/landlord/listing-add-workflow.jsx';
const paymentsSettingsPath = '../sections/landlord/settings/PaymentsSettings.jsx';
const landlordPropertyPath = '../pages/landlord/property.jsx';
const leaseChargesPath = '../pages/landlord/lease-charges.jsx';
const eSignDocumentPath = '../pages/landlord/e-sign-document.jsx';
const listingCreatePath = '../pages/landlord/listing-create.jsx';

test('tenant payments fail closed and never mount or open payment UI while rent collection is blocked', async () => {
  const text = await source(tenantPaymentsPath);
  assert.match(text, /useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
  assert.match(text, /if \(!canInvoke\) return;/);
  assert.match(text, /disabled=\{!canInvoke\}/);
  assert.match(text, /\{canInvoke && \(\s*<PaymentModal/s);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
});

test('tenant dashboard gates payment, payment-method setup, Stripe initialization, and providers', async () => {
  const text = await source(tenantDashboardPath);
  assert.match(text, /useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
  assert.match(text, /if \(!open \|\| !canInvoke\) return;/);
  assert.match(text, /disabled=\{!canInvoke \|\| !paymentAllocation \|\| totalAmountDue <= 0\}/);
  assert.match(text, /disabled=\{!canInvoke\}[\s\S]*Edit payment method/);
  assert.match(text, /\{canInvoke && paymentMethodModalOpen && \(\s*<TenantPaymentMethodModal/s);
  assert.match(text, /\{canInvoke && lease && \(\s*<PaymentModal/s);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
});

test('external syndication fails closed while hosted publication remains available', async () => {
  const text = await source(listingSetupPath);
  assert.match(text, /useFeatureReadiness\(FEATURE_KEYS\.listingSyndication\)/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*External listing syndication/);
  assert.match(text, /syndicateToListingWebsite: Boolean/);
  assert.match(text, /syndicateToFreeSites: syndicationCanInvoke && Boolean/);
  assert.match(text, /syndicateToPremiumSites: syndicationCanInvoke && Boolean/);
  assert.doesNotMatch(text, /if \(!syndicationCanInvoke\) return;[\s\S]*listingApi\.publishListing/);
  assert.match(text, /disabled=\{saving \|\| publishing\}/);
  assert.ok((text.match(/disabled=\{!syndicationCanInvoke\}/g) || []).length >= 2);
  assert.ok((text.match(/checked=\{syndicationCanInvoke && Boolean/g) || []).length >= 2);
  assert.match(text, /checked=\{Boolean\(formData\.syndicateToListingWebsite\)\}/);
});

test('landlord rent collection fails closed before checking Stripe or offering bank setup', async () => {
  const text = await source(landlordRentCollectionPath);
  assert.match(text, /canInvoke: rentCanInvoke/);
  assert.match(text, /if \(!rentCanInvoke\) \{\s*setAccountStatus\(null\);\s*setCheckingBankStatus\(false\);\s*return;\s*\}/s);
  assert.match(text, /if \(!rentCanInvoke \|\| \(!user\?\.id && !user\?\.Id\)\) return;/);
  assert.match(text, /\}, \[user, rentCanInvoke\]\);/);
  assert.match(text, /\{rentCanInvoke && !checkingBankStatus && !isBankConnected && \(/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
});

test('lease gates Stripe account onboarding with online rent readiness independently of e-signature', async () => {
  const text = await source(landlordLeasePath);
  assert.match(text, /useFeatureReadiness\(FEATURE_KEYS\.eSignature\)/);
  assert.match(text, /canInvoke: rentCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
  assert.match(text, /if \(!rentCanInvoke\) return;\s*setShowStripeOnboarding\(true\);/);
  assert.match(text, /disabled=\{!rentCanInvoke\}[\s\S]*Add New Bank Account/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
  assert.match(text, /\{rentCanInvoke && \(\s*<StripeConnectOnboardingDialog/s);
});

test('contact-details save preserves hosted publication but clears blocked external defaults', async () => {
  const text = await source(listingSetupApplicationPath);
  assert.match(text, /canInvoke: syndicationCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.listingSyndication\)/);
  assert.match(text, /syndicateToListingWebsite: Boolean\(listing\.syndicateToListingWebsite \?\? true\)/);
  assert.match(text, /syndicateToFreeSites: syndicationCanInvoke && Boolean\(listing\.syndicateToFreeSites \?\? false\)/);
  assert.match(text, /syndicateToPremiumSites: syndicationCanInvoke && Boolean\(listing\.syndicateToPremiumSites \?\? false\)/);
  assert.match(text, /syndicateToListingWebsite: Boolean\(formData\.syndicateToListingWebsite\)/);
  assert.match(text, /syndicateToFreeSites: syndicationCanInvoke && Boolean\(formData\.syndicateToFreeSites\)/);
  assert.match(text, /syndicateToPremiumSites: syndicationCanInvoke && Boolean\(formData\.syndicateToPremiumSites\)/);
});

test('active listing drawer fails closed for external writes without blocking hosted publication', async () => {
  const text = await source(listingAddWorkflowPath);
  assert.match(text, /canInvoke: syndicationCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.listingSyndication\)/);
  assert.match(text, /syndicateToListingWebsite: Boolean\(formData\.syndicateToListingWebsite\)/);
  assert.match(text, /syndicateToFreeSites: syndicationCanInvoke && Boolean\(formData\.syndicateToFreeSites\)/);
  assert.match(text, /syndicateToPremiumSites: syndicationCanInvoke && Boolean\(formData\.syndicateToPremiumSites\)/);
  assert.match(text, /if \(!draftListingId\) return;[\s\S]*dispatch\(publishListing/);
  assert.match(text, /disabled=\{isSavingStep\}/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*External listing syndication/);
});

test('e-signature promotional workflow is hidden when e-signature cannot be invoked', async () => {
  const text = await source(eSignDocumentPath);
  assert.match(text, /\{signatureReadiness\.canInvoke && \(\s*<Card/s);
});

test('listing setup fails closed for tenant screening controls and writes', async () => {
  const text = await source(listingSetupPath);
  assert.match(text, /canInvoke: screeningCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.tenantScreening\)/);
  assert.match(text, /requireScreening: screeningCanInvoke && Boolean/);
  assert.match(text, /requireIncomeVerification: screeningCanInvoke && Boolean/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Tenant screening/);
  assert.match(text, /checked=\{screeningCanInvoke && Boolean\(formData\.requireScreening\)\}/);
  assert.match(text, /checked=\{screeningCanInvoke && Boolean\(formData\.requireIncomeVerification\)\}/);
  assert.ok((text.match(/disabled=\{!screeningCanInvoke\}/g) || []).length >= 2);
});

test('listing workflow clears, hides, and serializes screening settings while tenant screening is blocked', async () => {
  const text = await source(listingAddWorkflowPath);
  assert.match(text, /canInvoke: screeningCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.tenantScreening\)/);
  assert.match(text, /requireScreening: screeningCanInvoke && Boolean/);
  assert.match(text, /requireIncomeVerification: screeningCanInvoke && Boolean/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Tenant screening/);
  assert.match(text, /\{screeningCanInvoke && \(\s*<>[\s\S]*Essential coverage \(\$40\.00\)/);
});

test('draft listing creation fails closed for tenant screening on the create page', async () => {
  const text = await source(listingCreatePath);
  assert.match(text, /canInvoke: screeningCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.tenantScreening\)/);
  assert.match(text, /requireScreening: screeningCanInvoke/);
  assert.match(text, /screeningType: screeningCanInvoke \? 'Essential' : null/);
  assert.match(text, /requireIncomeVerification: false/);
  assert.match(text, /incomeVerificationCost: screeningCanInvoke \? 12 : 0/);
});

test('property detail draft listing creation fails closed for tenant screening', async () => {
  const text = await source(landlordPropertyPath);
  assert.match(text, /canInvoke: screeningCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.tenantScreening\)/);
  assert.match(text, /requireScreening: screeningCanInvoke/);
  assert.match(text, /screeningType: screeningCanInvoke \? 'Essential' : null/);
  assert.match(text, /requireIncomeVerification: false/);
  assert.match(text, /incomeVerificationCost: screeningCanInvoke \? 12 : 0/);
});

test('contact-details save clears hidden tenant-screening settings while readiness is blocked', async () => {
  const text = await source(listingSetupApplicationPath);
  assert.match(text, /canInvoke: screeningCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.tenantScreening\)/);
  assert.match(text, /requireScreening: screeningCanInvoke && Boolean\(listing\.requireScreening \?\? true\)/);
  assert.match(text, /screeningType: screeningCanInvoke \? listing\.screeningType \?\? 'Essential' : null/);
  assert.match(text, /requireIncomeVerification: screeningCanInvoke && Boolean\(listing\.requireIncomeVerification \?\? false\)/);
  assert.match(text, /incomeVerificationCost: screeningCanInvoke \? listing\.incomeVerificationCost \?\? '12' : 0/);
  assert.match(text, /requireScreening: screeningCanInvoke && Boolean\(formData\.requireScreening\)/);
  assert.match(text, /screeningType: screeningCanInvoke \? formData\.screeningType : null/);
  assert.match(text, /requireIncomeVerification: screeningCanInvoke && Boolean\(formData\.requireIncomeVerification\)/);
  assert.match(text, /incomeVerificationCost:\s*screeningCanInvoke && formData\.requireIncomeVerification\s*\? parseFloat\(formData\.incomeVerificationCost\)\s*:\s*0/);
});

test('bank settings never call or mount Stripe provider setup while rent collection is blocked', async () => {
  const text = await source(paymentsSettingsPath);
  assert.match(text, /canInvoke: rentCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
  assert.match(text, /if \(isDemo \|\| rentReadinessLoading \|\| rentReadinessError \|\| !rentCanInvoke\) \{[\s\S]*setCheckingStatus\(false\);[\s\S]*setShowOnboarding\(false\);[\s\S]*setStripeConnectInstance\(null\);[\s\S]*return;/);
  assert.match(text, /if \(!rentCanInvoke\) \{[\s\S]*FeatureReadinessNotice[\s\S]*Online rent collection/);
  assert.ok(text.indexOf('if (!rentCanInvoke)') < text.indexOf('<Dialog'));
});

test('property banking fails closed before loading accounts and never mounts bank or Stripe dialogs while blocked', async () => {
  const text = await source(landlordPropertyPath);
  assert.match(text, /canInvoke: rentCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
  assert.match(text, /if \(!rentCanInvoke \|\| !property\?\.operatingAccountId\) \{[\s\S]*setOperatingAccount\(null\);[\s\S]*setLoadingAccount\(false\);[\s\S]*return;/);
  assert.match(text, /if \(!bankingModalOpen \|\| !rentCanInvoke\) \{[\s\S]*setLoadingBankAccounts\(false\);[\s\S]*return;/);
  assert.match(text, /if \(!rentCanInvoke \|\| !property\?\.id\) return;/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
  assert.match(text, /\{rentCanInvoke && bankingModalOpen && \(\s*<Dialog/s);
  assert.match(text, /\{rentCanInvoke && showStripeOnboarding && \(\s*<StripeConnectOnboardingDialog/s);
});

test('lease charges fail closed for online collection, account writes, bank APIs, and Stripe onboarding', async () => {
  const text = await source(leaseChargesPath);
  assert.match(text, /canInvoke: rentCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
  assert.match(text, /if \(!rentCanInvoke \|\| !leaseOperatingAccountId\) \{[\s\S]*setOperatingAccount\(null\);[\s\S]*setLoadingAccount\(false\);[\s\S]*return;/);
  assert.match(text, /if \(!bankingModalOpen \|\| !rentCanInvoke\) \{[\s\S]*setLoadingBankAccounts\(false\);[\s\S]*return;/);
  assert.match(text, /checked=\{rentCanInvoke && collectThroughPlatform\}/);
  assert.match(text, /disabled=\{!rentCanInvoke\}/);
  assert.match(text, /rentCollectionByPlatform: rentCanInvoke && collectThroughPlatform/);
  assert.match(text, /operatingAccountId: rentCanInvoke && collectThroughPlatform/);
  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
  assert.match(text, /\{rentCanInvoke && bankingModalOpen && \(\s*<Dialog/s);
  assert.match(text, /\{rentCanInvoke && showStripeOnboarding && \(\s*<StripeConnectOnboardingDialog/s);
});

test('pricing preserves plan entitlement and qualifies operational readiness', async () => {
  const [pricing, card, comparison] = await Promise.all([
    source(pricingTablePath),
    source(planCardPath),
    source(comparisonPath)
  ]);
  assert.match(pricing, /rentReadiness=\{rentReadiness\}/);
  assert.match(card, /rentReadiness/);
  assert.match(card, /isOnlineRentCollectionFeature/);
  assert.match(card, /rentReadiness\?\.canInvoke/);
  assert.match(card, /Operational status:/);
  assert.match(comparison, /if \(!hasFeature\(plan, feature\.check\)\)/);
  assert.match(comparison, /if \(feature\.check === 'online rent' && !rentReadiness\.canInvoke\)/);
  assert.match(comparison, /if \(feature\.check === 'external listing' && !syndicationReadiness\.canInvoke\)/);
  assert.match(comparison, /-15%/);
});

test('readiness SWR cache key is stable and scoped by authenticated user and organization', async () => {
  const text = await source(readinessHookPath);
  assert.match(text, /\['\/api\/feature-readiness', userKey, organizationKey\]/);
  assert.match(text, /user\?\.id \?\? user\?\.Id/);
  assert.match(text, /currentOrganization\?\.id \?\? currentOrganization\?\.Id/);
  assert.doesNotMatch(text, /useFeatureReadiness\([^)]*\)\s*\?/);
});
