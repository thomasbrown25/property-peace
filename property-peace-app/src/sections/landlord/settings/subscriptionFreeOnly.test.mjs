import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('subscription settings presents Free without a checkout or plan comparison and retains paid billing and organization switching', async () => {
  const page = await read('./SubscriptionSettings.jsx');
  assert.match(page, /bgcolor: theme\.palette\.brand\.forest/);
  assert.match(page, /Free plan/);
  assert.match(page, /Some features require setup or provider availability/);
  assert.doesNotMatch(page, /PlanComparisonTable|useSubscriptionPlans|handlePlanSelected|upgradeSubscription|downgradeSubscription|Confirm Subscription Upgrade/);
  assert.match(page, /canManagePaidBilling\(subscription\)/);
  assert.match(page, /createCustomerPortalSession/);
  assert.match(page, /<Billing\b/);
  assert.match(page, /switchOrganization\(orgId\)/);
  assert.match(page, /organizations \|\| \[\]\)\.map/);
  assert.match(page, /<OrphanedSubscriptionModal\b/);
  assert.match(page, /const handleFixOrphanedSubscription = \(\) => \{[\s\S]*?navigate\('\/landlord\/support\/ticket'\);/);
  assert.doesNotMatch(page, /createCheckoutSession\(/);
});

test('orphaned legacy paid subscriptions route to support, never checkout, from both entry points', async () => {
  const modal = await read('../../../components/subscription/OrphanedSubscriptionModal.jsx');
  const dashboard = await read('../../../pages/landlord/dashboard-overview.jsx');
  assert.match(modal, /Self-service checkout is not available for legacy paid plans/);
  assert.match(modal, /Your payment details have not been updated/);
  assert.match(modal, /onClick=\{onFix\}[\s\S]*?Contact support/);
  assert.doesNotMatch(modal, /Update Payment Information|fully activated|payment setup process/);
  assert.match(dashboard, /<OrphanedSubscriptionModal\b/);
  assert.match(dashboard, /const handleFixOrphanedSubscription = \(\) => \{[\s\S]*?navigate\('\/landlord\/support\/ticket'\);/);
  assert.doesNotMatch(dashboard, /createCheckoutSession\(/);
});

test('navigation and rent estimate consumers do not infer access from plan names', async () => {
  const files = [
    '../../../layout/Dashboard/BottomNavBar/index.jsx',
    '../../../layout/Dashboard/Drawer/DrawerContent/SidebarBottomSection.jsx',
    '../../../pages/landlord/unit.jsx',
    '../../../pages/landlord/listing-setup.jsx',
    '../../../pages/landlord/build-lease-agreement/rent-deposit-fees.jsx',
    '../property/OverviewTab.jsx'
  ];
  for (const path of files) {
    const source = await read(path);
    assert.doesNotMatch(source, /isPremium|showUpgrade|Upgrade to Premium|isLifetime/, path);
  }
  const estimate = await read('../../../components/RentEstimateCard.jsx');
  assert.match(estimate, /useEntitlement\(RENT_ESTIMATE_FEATURE\)/);
  assert.match(estimate, /if \(!propertyId \|\| !canInvoke\) return/);
});
