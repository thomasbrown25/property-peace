import { useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Box, Stack, Tab, Tabs } from '@mui/material';
import SubscriptionPausedGuard from 'components/auth/SubscriptionPausedGuard';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import useRentPaymentAccess from 'hooks/useRentPaymentAccess';
import { recordTabsSx } from 'sections/landlord/property/recordTabsStyle';
import {
  buildLegacyOnlinePaymentsRedirect,
  getOnlinePaymentTabs,
  getRequestedOnlinePaymentTab,
  getSelectedOnlinePaymentTab,
  isStripeSetupRequested,
  STRIPE_TAB
} from 'utils/onlinePaymentTabs';
import { makeRentPaymentAccessScopeKey } from 'utils/rentPaymentAccess';
import { PaymentsSettingsContent } from './PaymentsSettings';
import PayoutAssignments from './PayoutAssignments';

export default function OnlinePaymentSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stripeTabRef = useRef(null);
  const { user } = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const introScope = !organizationLoading && !user?.isDemo && !user?.IsDemo
    ? makeRentPaymentAccessScopeKey({
        userId: user?.id ?? user?.Id,
        organizationId: currentOrganization?.id ?? currentOrganization?.Id
      })
    : null;
  const rentPaymentAccess = useRentPaymentAccess();
  const paymentTabs = getOnlinePaymentTabs(rentPaymentAccess.presentation.canConfigure);
  const requestedTab = getRequestedOnlinePaymentTab(searchParams);
  const selectedTab = getSelectedOnlinePaymentTab(requestedTab, paymentTabs);

  const selectTab = (value, setup = false, setupMode = null) => {
    const params = new URLSearchParams(searchParams);
    params.set('paymentTab', value);
    if (setup) params.set('setup', '1');
    else params.delete('setup');
    if (setup && setupMode === 'existing') params.set('setupMode', 'existing');
    else params.delete('setupMode');
    setSearchParams(params, { replace: true });
  };

  const openStripeSetup = (setupMode) => {
    selectTab(STRIPE_TAB, true, setupMode);
    stripeTabRef.current?.focus();
  };

  const closeStripeSetup = () => {
    selectTab(STRIPE_TAB);
    stripeTabRef.current?.focus();
  };

  if (requestedTab === 'transactions') {
    return <Navigate to={buildLegacyOnlinePaymentsRedirect(searchParams)} replace />;
  }

  return (
    <Stack spacing={2.5}>
      <Box sx={recordTabsSx}>
        <Tabs value={selectedTab} onChange={(_event, value) => selectTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Online payment settings">
          {paymentTabs.map(({ id, label }) => (
            <Tab
              key={id}
              ref={id === STRIPE_TAB ? stripeTabRef : undefined}
              value={id}
              label={label}
              id={`online-payments-tab-${id}`}
              aria-controls={`online-payments-panel-${id}`}
            />
          ))}
        </Tabs>
      </Box>
      <Box role="tabpanel" id={`online-payments-panel-${selectedTab}`} aria-labelledby={`online-payments-tab-${selectedTab}`}>
        {selectedTab === STRIPE_TAB && (
          <PaymentsSettingsContent
            rentPaymentAccess={rentPaymentAccess}
            introScope={introScope}
            showStripeSetup={isStripeSetupRequested(searchParams)}
            initialSetupMode={searchParams.get('setupMode') === 'existing' ? 'existing' : 'new'}
            onOpenStripeSetup={openStripeSetup}
            onCloseStripeSetup={closeStripeSetup}
          />
        )}
        {selectedTab === 'payout-assignments' && (
          <SubscriptionPausedGuard>
            <PayoutAssignments />
          </SubscriptionPausedGuard>
        )}
      </Box>
    </Stack>
  );
}
