import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('setup hook has one server-owned, organization-aware, abortable lifecycle', async () => {
  const hook = await source('../hooks/useLandlordSetupSteps.js');

  assert.match(hook, /fetchActivation/);
  assert.match(hook, /projectActivationLifecycle/);
  assert.match(hook, /useOrganization/);
  assert.match(hook, /currentOrganization/);
  assert.match(hook, /organizationLoading/);
  assert.match(hook, /fetchActivation\(organizationId, controller\.signal\)/);
  assert.match(hook, /activationResponseForOrganization/);
  assert.match(hook, /AbortController/);
  assert.match(hook, /controller\.abort\(\)/);
  assert.match(hook, /\[organizationId, organizationLoading, requestVersion\]/);
  assert.doesNotMatch(hook, /\[organizationId, organizationLoading, mode, requestVersion\]/);
  assert.match(hook, /refresh/);
  assert.match(hook, /error/);
  assert.doesNotMatch(hook, /useFetchProperties|useFetchAllTenants|useSelector|useSubscription|HasSeenTutorial|cancelAtPeriodEnd/);
  assert.doesNotMatch(hook, /options\.context/);
});

test('dashboard has one persistent activation card high in composition and no tutorial-driven setup', async () => {
  const dashboard = await source('../pages/landlord/dashboard.jsx');
  const headerEnd = dashboard.indexOf('</DashboardHeader>') >= 0
    ? dashboard.indexOf('</DashboardHeader>')
    : dashboard.indexOf('/>', dashboard.indexOf('<DashboardHeader'));
  const card = dashboard.indexOf('<FinishSetup');
  const operational = dashboard.indexOf('{/* Main dashboard columns */}');

  assert.ok(headerEnd >= 0 && card > headerEnd && card < operational, 'activation card must follow dashboard header and precede operational cards');
  assert.equal((dashboard.match(/<FinishSetup/g) || []).length, 1);
  assert.doesNotMatch(dashboard, /OnboardingWizard|showOnboardingWizard|leaseCompleted|HasSeenTutorial|setupTasksOpen/);

  const cardSource = await source('../sections/landlord/dashboard/FinishSetup.jsx');
  assert.match(cardSource, /\/landlord\/setup/);
  assert.match(cardSource, /Retry/);
  assert.match(cardSource, /progressLabel/);
  assert.doesNotMatch(cardSource, /ThemeAdaptiveDrawer|onClose|dismiss|finishSetupPulse/);
  assert.match(dashboard, /readActivationModePreference/);
});

test('setup is a routed accessible hub with resumable truthful paths and role states', async () => {
  const routes = await source('./MainRoutes.jsx');
  const page = await source('../pages/landlord/setup.jsx');

  assert.match(routes, /pages\/landlord\/setup/);
  assert.match(routes, /path:\s*['"]landlord\/setup['"]/);
  assert.match(routes, /path:\s*['"]landlord\/rent-collection\/:leaseId['"]/);
  assert.doesNotMatch(routes, /path:\s*['"]landlord\/rent-collection\/:propertyId['"]/);
  assert.match(page, /component="h1"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /role="progressbar"/);
  assert.match(page, /aria-current/);
  assert.match(page, /Fill a vacancy/);
  assert.match(page, /Set up an occupied rental/);
  assert.match(page, /Import a spreadsheet/);
  assert.match(page, /properties and basic unit details only/i);
  assert.match(page, /leases, tenants, rent, and communications still need setup/i);
  assert.match(page, /Not needed — this rental already has a configured lease/);
  assert.match(page, /Invite sent \/ waiting for tenant/);
  assert.match(page, /Waiting for an Owner/);
  assert.match(page, /Enhance your setup/);
  assert.match(page, /writeActivationModePreference/);
  assert.match(page, /readActivationModePreference/);
  assert.match(page, /explicitMode\s*\?\?\s*readActivationModePreference/);
  assert.doesNotMatch(page, /context:/);
});

test('duplicate header and wrapper onboarding surfaces are passive', async () => {
  const header = await source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const wrapper = await source('../components/onboarding/OnboardingWrapper.jsx');

  assert.doesNotMatch(header, /FinishSetup|useLandlordSetupSteps|finishSetupOpen/);
  assert.doesNotMatch(wrapper, /OnboardingDialog|HasSeenTutorial|hasSeenTutorial|setTimeout/);
});

test('activation recovery routes and actions stay canonical and resumable', async () => {
  const routes = await source('./MainRoutes.jsx');
  const page = await source('../pages/landlord/setup.jsx');
  const card = await source('../sections/landlord/dashboard/FinishSetup.jsx');
  const lifecycle = await source('../utils/activationLifecycle.js');
  const leaseTenant = await source('../pages/landlord/lease-add-tenant.jsx');

  const setupRoute = routes.match(/path:\s*['"]landlord\/setup['"][\s\S]*?\n\s*},/i)?.[0] || '';
  const organizationRecoveryRoute = routes.match(/path:\s*['"]landlord\/admin-members['"][\s\S]*?\n\s*},/i)?.[0] || '';
  assert.doesNotMatch(setupRoute, /SubscriptionPausedGuard/, 'the read-only activation hub must remain reachable when billing is paused');
  assert.doesNotMatch(organizationRecoveryRoute, /SubscriptionPausedGuard/, 'organization selection and access recovery must remain reachable when billing is paused');
  assert.match(page, /to="\/landlord\/admin-members"/);
  assert.match(card, /to="\/landlord\/admin-members"/);
  assert.match(lifecycle, /organization:\s*\['\/landlord\/admin-members'/);
  assert.doesNotMatch(page, /Start spreadsheet import/);
  assert.match(page, /view\.available\s*&&\s*view\.readOnly/);
  assert.match(card, /Review setup/);
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
