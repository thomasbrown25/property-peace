import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('duplicate header and wrapper onboarding surfaces are passive', async () => {
  const header = await source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const wrapper = await source('../components/onboarding/OnboardingWrapper.jsx');

  assert.doesNotMatch(header, /FinishSetup|useLandlordSetupSteps|finishSetupOpen/);
  assert.doesNotMatch(wrapper, /OnboardingDialog|HasSeenTutorial|hasSeenTutorial|setTimeout/);
});

test('activation recovery routes and actions stay canonical and resumable', async () => {
  const routes = await source('./MainRoutes.jsx');
  const lifecycle = await source('../utils/activationLifecycle.js');
  const leaseTenant = await source('../pages/landlord/lease-add-tenant.jsx');

  const organizationRecoveryRoute = routes.match(/path:\s*['"]landlord\/admin-members['"][\s\S]*?\n\s*},/i)?.[0] || '';
  assert.doesNotMatch(
    organizationRecoveryRoute,
    /SubscriptionPausedGuard/,
    'organization selection and access recovery must remain reachable when billing is paused'
  );
  assert.match(lifecycle, /organization:\s*\['\/landlord\/admin-members'/);
  assert.match(leaseTenant, /tenantInviteAPI\.createTenantInvite/);
  assert.match(leaseTenant, /Send portal invite/);
  assert.match(leaseTenant, /Add email/);
  assert.match(leaseTenant, /inviteFailed/);
  assert.match(leaseTenant, /Unable to open this lease/);
  assert.match(leaseTenant, /\bAlert\b/);
  assert.match(leaseTenant, /propertiesRefetch/);
  assert.match(leaseTenant, /onClick=\{propertiesRefetch\}/);
  assert.doesNotMatch(leaseTenant, /dispatch\(getProperties\(\)\)/);
  assert.match(leaseTenant, /component="h1"/);
  assert.match(leaseTenant, /aria-current=\{Number\(id\) === targetTenantId/);
  assert.match(leaseTenant, /aria-label=\{`Send portal invite to \$\{name\}`\}/);
  assert.match(leaseTenant, /aria-label=\{`Add email for \$\{name\}`\}/);
  assert.match(leaseTenant, /tenantLoadError/);
  assert.match(leaseTenant, /Unable to load tenants/);
  assert.match(leaseTenant, /retryTenantLoad/);
  assert.match(lifecycle, /\?tenantId=\$\{tenantId\}/);
});

test('rent detail routes never put a property id in the lease-id path', async () => {
  const rentCard = await source('../components/cards/RentCard.jsx');
  const urgent = await source('../pages/landlord/urgent-messages.jsx');
  const lease = await source('../pages/landlord/lease.jsx');
  const notifications = await source('../pages/landlord/notifications.jsx');
  const rentCollection = await source('../pages/landlord/rent-collection.jsx');
  const propertySelect = await source('../components/PropertySelect.jsx');
  const propertyHook = await source('../hooks/useFetchProperties.js');
  const propertyActions = await source('../store/property/property.action.js');
  const leaseTenant = await source('../pages/landlord/lease-add-tenant.jsx');

  assert.doesNotMatch(rentCard, /rent-collection\/\$\{rent\.propertyId\}/);
  assert.match(rentCard, /rent-collection\?propertyId=\$\{rent\.propertyId\}/);
  assert.doesNotMatch(urgent, /rent-collection\/\$\{message\.propertyId\}/);
  assert.match(urgent, /rent-collection\?propertyId=\$\{message\.propertyId\}/);
  assert.doesNotMatch(lease, /rent-collection\/\$\{propertyId\}/);
  assert.match(lease, /rent-collection\/\$\{leaseId\}/);
  assert.doesNotMatch(notifications, /rent-collection\/\$\{propertyId\}/);
  assert.match(notifications, /rent-collection\?propertyId=\$\{propertyId\}/);
  assert.match(rentCollection, /requestedPropertyId=\{searchParams\.get\('propertyId'\)\}/);
  assert.match(propertySelect, /properties\?\.find\(\(property\) => String\(property\.id\) === requestedKey\)/);
  assert.match(propertySelect, /dispatch\(setProperty\(requestedProperty\)\)/);
  assert.match(propertySelect, /requestedPropertyAppliedRef/);
  assert.doesNotMatch(propertySelect, /propertiesLoadedAt[^\]]*selectedProperty\?\.id/);
  assert.match(propertyHook, /propertiesError/);
  assert.match(propertyActions, /return \{ success: false/);
  assert.match(leaseTenant, /propertiesError/);
  assert.match(leaseTenant, /Unable to load properties/);
  assert.match(rentCollection, /<PropertySelect width="100%"/);
  assert.match(rentCard, />\s*Record Payment\s*</);
  assert.doesNotMatch(rentCard, />\s*Make Payment\s*</);
  assert.match(rentCard, /flexWrap:\s*['"]wrap['"]/);
});
