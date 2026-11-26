import { Navigate, useSearchParams } from 'react-router-dom';
import { Box, Stack, Tab, Tabs } from '@mui/material';
import SubscriptionPausedGuard from 'components/auth/SubscriptionPausedGuard';
import useRentPaymentAccess from 'hooks/useRentPaymentAccess';
import ShortStayConnect from 'pages/landlord/short-stay-connect.jsx';
import { recordTabsSx } from 'sections/landlord/property/recordTabsStyle';
import { buildLegacyOnlinePaymentsRedirect, DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs, getSelectedOnlinePaymentTab } from 'utils/onlinePaymentTabs';
import { PaymentsSettingsContent } from './PaymentsSettings';
import PayoutAssignments from './PayoutAssignments';

export default function OnlinePaymentSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rentPaymentAccess = useRentPaymentAccess();
  const paymentTabs = getOnlinePaymentTabs(rentPaymentAccess.presentation.canConfigure);
  const requestedTab = searchParams.get('paymentTab') ?? DEFAULT_ONLINE_PAYMENT_TAB;
  const selectedTab = getSelectedOnlinePaymentTab(requestedTab, paymentTabs);

  const changeTab = (_event, value) => {
    const params = new URLSearchParams(searchParams);
    params.set('paymentTab', value);
    params.delete('setup');
    setSearchParams(params, { replace: true });
  };

  const clearSetupRequest = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('setup');
    setSearchParams(params, { replace: true });
  };

  if (requestedTab === 'transactions') {
    return <Navigate to={buildLegacyOnlinePaymentsRedirect(searchParams)} replace />;
  }

  return (
    <Stack spacing={2.5}>
      <Box sx={recordTabsSx}>
        <Tabs value={selectedTab} onChange={changeTab} variant="scrollable" scrollButtons="auto" aria-label="Online payment settings">
          {paymentTabs.map(({ id, label }) => (
            <Tab key={id} value={id} label={label} id={`online-payments-tab-${id}`} aria-controls={`online-payments-panel-${id}`} />
          ))}
        </Tabs>
      </Box>
      <Box role="tabpanel" id={`online-payments-panel-${selectedTab}`} aria-labelledby={`online-payments-tab-${selectedTab}`}>
        {selectedTab === 'bank-accounts' && (
          <Stack spacing={3}>
            <PaymentsSettingsContent
              rentPaymentAccess={rentPaymentAccess}
              onSetupRequestHandled={searchParams.get('setup') === '1' ? clearSetupRequest : undefined}
            />
            <ShortStayConnect />
          </Stack>
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
