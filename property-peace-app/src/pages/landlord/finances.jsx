import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Alert, alpha, Box, Button, FormControl, Grid, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography, useTheme } from '@mui/material';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import { useDrawer } from 'contexts/DrawerContext';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useFinancesMoneyData from 'hooks/useFinancesMoneyData';
import useFinancesPayments from 'hooks/useFinancesPayments';
import AccountActivityCard from 'sections/landlord/finances/AccountActivityCard';
import ActivityTab from 'sections/landlord/finances/ActivityTab';
import ExpensesTab from 'sections/landlord/finances/ExpensesTab';
import CalculationDisclosure from 'sections/landlord/finances/CalculationDisclosure';
import FinanceDetailDrawer from 'sections/landlord/finances/FinanceDetailDrawer';
import FinancesHeader from 'sections/landlord/finances/FinancesHeader';
import FinancesMetrics from 'sections/landlord/finances/FinancesMetrics';
import NeedsReviewTab from 'sections/landlord/finances/NeedsReviewTab';
import {
  buildFinancesMoneyQuery,
  normalizeFinancesPeriod,
  normalizeFinancesTab,
  selectFinancesExportState,
  sumCollectedThisMonth,
  updateFinancesPropertyScope,
  updateFinancesSearch
} from 'utils/finances';
import { buildExpenseHookFilters, maskExpenseMetricsAvailability } from 'utils/expensesTab';

const FINANCES_TAB_LABELS = [
  ['review', 'Needs review'],
  ['activity', 'Activity'],
  ['expenses', 'Expenses'],
  ['payments', 'Payments'],
  ['upcoming', 'Upcoming']
];

const PERIOD_OPTIONS = [
  ['this-month', 'This month'],
  ['last-month', 'Last month'],
  ['ytd', 'This year'],
  ['last-year', 'Last year'],
  ['custom', 'Custom dates']
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALL_PROPERTIES_SCOPE = Object.freeze({});

export default function FinancesPage() {
  const theme = useTheme();
  const drawer = useDrawer();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { properties } = useFetchProperties();
  const activeTab = normalizeFinancesTab(searchParams.get('tab'));
  const period = normalizeFinancesPeriod(searchParams.get('period'));
  const effectiveSearchParams = useMemo(() => {
    const effective = new URLSearchParams(searchParams);
    effective.set('period', period);
    return effective;
  }, [period, searchParams]);
  const scopedQuery = useMemo(() => buildFinancesMoneyQuery(effectiveSearchParams), [effectiveSearchParams]);
  const propertyId = scopedQuery.propertyId;
  const selectedProperty = properties?.find((property) => Number(property.id) === Number(propertyId)) || null;
  const moneyData = useFinancesMoneyData(effectiveSearchParams, drawer.financeMutationVersion);
  const paymentsData = useFinancesPayments(propertyId, drawer.financeMutationVersion);
  const expenseFilters = useMemo(() => buildExpenseHookFilters({
    propertyId,
    sharedFrom: scopedQuery.from,
    sharedTo: scopedQuery.to
  }), [propertyId, scopedQuery.from, scopedQuery.to]);
  const expensesData = useFetchExpenses(expenseFilters);
  const moneyScopeKey = JSON.stringify({ ...scopedQuery, mutationVersion: drawer.financeMutationVersion });
  const paymentsScopeKey = `${propertyId ?? 'all'}:${drawer.financeMutationVersion ?? 0}`;
  const previousMoneyScopeRef = useRef(moneyScopeKey);
  const previousPaymentsScopeRef = useRef(paymentsScopeKey);
  const moneyScopeChanged = previousMoneyScopeRef.current !== moneyScopeKey;
  const paymentsScopeChanged = previousPaymentsScopeRef.current !== paymentsScopeKey;
  useEffect(() => {
    previousMoneyScopeRef.current = moneyScopeKey;
    previousPaymentsScopeRef.current = paymentsScopeKey;
  }, [moneyScopeKey, paymentsScopeKey]);
  const collectedThisMonth = useMemo(
    () => sumCollectedThisMonth(paymentsData.payments, new Date(), propertyId),
    [paymentsData.payments, propertyId]
  );
  const metricsOverview = useMemo(() => maskExpenseMetricsAvailability(
    moneyData.loading || moneyScopeChanged ? null : moneyData.overview,
    expensesData.available
  ), [expensesData.available, moneyData.loading, moneyData.overview, moneyScopeChanged]);
  const customFrom = searchParams.get('from') || '';
  const customTo = searchParams.get('to') || '';
  const customRangeValid = ISO_DATE.test(customFrom) && ISO_DATE.test(customTo) && customFrom <= customTo;
  const exportRegistrationKey = `${location.key}:${activeTab}`;
  const [exportRegistration, setExportRegistration] = useState(null);
  const [selectedFinanceItem, setSelectedFinanceItem] = useState(null);

  const registerExport = useCallback((tab, registrationKey, exportState) => {
    setExportRegistration({ tab, registrationKey, exportState });
    return () => setExportRegistration((current) => (
      current?.tab === tab && current.registrationKey === registrationKey && current.exportState === exportState
        ? null
        : current
    ));
  }, []);
  const openFinanceDetail = useCallback((entry) => {
    const originalItem = moneyData.itemsResponse?.items?.find((item) => item.sourceId === entry.sourceId);
    setSelectedFinanceItem(originalItem || entry);
  }, [moneyData.itemsResponse]);
  const updateSearch = (changes) => setSearchParams(updateFinancesSearch(searchParams, changes), { replace: true });
  const setPropertyScope = (property) => setSearchParams(updateFinancesPropertyScope(searchParams, property?.id), { replace: true });
  const setTab = (tab) => updateSearch({ tab });
  const setPeriod = (nextPeriod) => updateSearch({
    period: nextPeriod,
    ...(nextPeriod === 'custom' ? {} : { from: undefined, to: undefined })
  });

  const handleMetricNavigation = (metric) => {
    if (metric === 'income') updateSearch({ tab: 'payments' });
    if (metric === 'expenses') updateSearch({ tab: 'expenses' });
    if (metric === 'net-cash-flow') updateSearch({ tab: 'activity' });
    if (metric === 'collected-this-month') updateSearch({ tab: 'payments', period: 'this-month', from: undefined, to: undefined });
  };

  const handleAccountNavigation = (account) => updateSearch({ tab: 'activity', account });
  const activityExportDisabled = moneyData.loading || moneyScopeChanged || Boolean(moneyData.itemsError);
  const registeredExportState = selectFinancesExportState(exportRegistration, activeTab, exportRegistrationKey);
  const activeExport = useMemo(() => {
    if (!registeredExportState) {
      return {
        label: 'Export',
        disabled: true,
        disabledReason: `Export is unavailable until the ${FINANCES_TAB_LABELS.find(([value]) => value === activeTab)?.[1] || 'selected'} view is ready.`
      };
    }
    if (activeTab === 'activity' && !registeredExportState.hasClientFilters) {
      return {
        label: 'Export activity',
        onExport: moneyData.exportActivity,
        busy: moneyData.exporting,
        disabled: activityExportDisabled,
        disabledReason: moneyData.loading || moneyScopeChanged ? 'Activity is still loading.' : moneyData.itemsError ? 'Activity records are unavailable.' : ''
      };
    }
    return registeredExportState;
  }, [activeTab, activityExportDisabled, moneyData.exportActivity, moneyData.exporting, moneyData.itemsError, moneyData.loading, moneyScopeChanged, registeredExportState]);

  return (
    <Box sx={{ pb: 4 }}>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Finances' }]} />
      <FinancesHeader
        activeTab={activeTab}
        onAddExpense={() => drawer.openExpenseAddDrawer()}
        onRecordPayment={() => drawer.openPaymentAddDrawer()}
        exportState={activeExport}
      />

      <Box sx={{ p: 2, mb: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <Box sx={{ minWidth: { xs: '100%', md: 260 } }}>
            <PropertySelect
              width="100%"
              label="Property"
              localSelectedProperty={selectedProperty || ALL_PROPERTIES_SCOPE}
              requestedPropertyId={propertyId}
              onPropertyChange={setPropertyScope}
            />
          </Box>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="finances-period-label">Period</InputLabel>
            <Select labelId="finances-period-label" label="Period" value={period} onChange={(event) => setPeriod(event.target.value)}>
              {PERIOD_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          {period === 'custom' && (
            <>
              <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={customFrom} onChange={(event) => updateSearch({ period: 'custom', from: event.target.value })} />
              <TextField size="small" type="date" label="Through" InputLabelProps={{ shrink: true }} value={customTo} onChange={(event) => updateSearch({ period: 'custom', to: event.target.value })} />
            </>
          )}
        </Stack>
      </Box>

      {period === 'custom' && !customRangeValid && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Enter a valid From and Through date. Until then, recorded activity for the current month through now is shown.
        </Alert>
      )}

      <FinancesMetrics
        overview={metricsOverview}
        collectedThisMonth={collectedThisMonth}
        collectedThisMonthAvailable={!paymentsData.loading && !paymentsScopeChanged && paymentsData.available}
        onSelectMetric={handleMetricNavigation}
      />

      <CalculationDisclosure
        overview={moneyData.loading || moneyScopeChanged ? null : moneyData.overview}
        itemsResponse={moneyData.loading || moneyScopeChanged ? null : moneyData.itemsResponse}
        loading={moneyData.loading || moneyScopeChanged}
        overviewError={moneyData.loading || moneyScopeChanged ? '' : moneyData.overviewError}
        itemsError={moneyData.loading || moneyScopeChanged ? '' : moneyData.itemsError}
        paymentsError={paymentsData.loading || paymentsScopeChanged ? '' : paymentsData.error}
        exportError={moneyData.exportError}
        onRetry={moneyData.retry}
        onRetryPayments={paymentsData.retry}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 9 }}>
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, overflow: 'hidden', minHeight: 300 }}>
            <Box sx={{ px: { xs: 1, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <Tabs value={activeTab} onChange={(_, tab) => setTab(tab)} variant="scrollable" scrollButtons="auto" aria-label="Finances views">
                {FINANCES_TAB_LABELS.map(([value, label]) => <Tab key={value} value={value} label={label} id={`finances-${value}-tab`} aria-controls={`finances-${value}-panel`} />)}
              </Tabs>
            </Box>
            <Box
              role="tabpanel"
              id={`finances-${activeTab}-panel`}
              aria-labelledby={`finances-${activeTab}-tab`}
              sx={{ minHeight: 240 }}
            >
              {activeTab === 'review' && (
                <NeedsReviewTab
                  items={moneyData.reviewItems}
                  loading={moneyData.loading || moneyScopeChanged}
                  error={moneyData.itemsError}
                  onRetry={moneyData.retry}
                  onSelectItem={openFinanceDetail}
                  registrationKey={exportRegistrationKey}
                  registerExport={registerExport}
                />
              )}
              {activeTab === 'activity' && (
                <ActivityTab
                  entries={moneyData.activityEntries}
                  loading={moneyData.loading || moneyScopeChanged}
                  error={moneyData.itemsError}
                  onRetry={moneyData.retry}
                  initialAccount={searchParams.get('account') || ''}
                  onSelectItem={openFinanceDetail}
                  registrationKey={exportRegistrationKey}
                  registerExport={registerExport}
                />
              )}
              {activeTab === 'expenses' && (
                <ExpensesTab
                  expenses={expensesData.expenses}
                  loading={expensesData.loading}
                  error={expensesData.error}
                  onRetry={expensesData.refetch}
                  propertyId={propertyId}
                  sharedPeriod={period}
                  sharedFrom={scopedQuery.from}
                  sharedTo={scopedQuery.to}
                  onMutation={drawer.notifyFinanceMutation}
                  registrationKey={exportRegistrationKey}
                  registerExport={registerExport}
                />
              )}
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 3 }}>
          <Stack spacing={2}>
            <AccountActivityCard
              accounts={moneyData.accountActivity}
              available={!moneyData.loading && !moneyScopeChanged && !moneyData.itemsError}
              loading={moneyData.loading || moneyScopeChanged}
              onSelectAccount={handleAccountNavigation}
            />

            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.045), border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`, borderRadius: 3 }}>
              <Typography fontWeight={750}>Keep records tax-ready</Typography>
              <Typography sx={{ mt: 0.6, fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}>
                Attach receipts while the details are fresh, and mark deductible expenses so reports need less cleanup later.
              </Typography>
              <Button component={RouterLink} to="/landlord/accounting/tax-center" size="small" startIcon={<PlusOutlined />} sx={{ mt: 1.2, px: 0, textTransform: 'none' }}>
                Open Tax Center
              </Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <FinanceDetailDrawer item={selectedFinanceItem} onClose={() => setSelectedFinanceItem(null)} />
    </Box>
  );
}
