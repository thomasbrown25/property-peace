import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Button,
  alpha,
  CircularProgress,
  useTheme,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  useMediaQuery,
  Select,
  MenuItem,
  FormControl,
  Alert,
  Chip
} from '@mui/material';
import {
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  TableOutlined,
  ReloadOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { useModal } from 'contexts/ModalContext';
import PaymentModal from 'components/drawers/PaymentModal';
import PropertySelect from 'components/PropertySelect';
import { getSettings, saveSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';
import { sendRentReminder } from 'store/rent-collection/rent-collection.action';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';

// Enhanced components
import RentCollectionHeader from 'sections/landlord/rent-collection/RentCollectionHeader';
import RentCollectionMetrics from 'sections/landlord/rent-collection/RentCollectionMetrics';
import SettlementSummary from 'sections/landlord/rent-collection/SettlementSummary';
import RentCollectionTable from 'sections/landlord/rent-collection/RentCollectionTable';
import RentCollectionEmptyState from 'sections/landlord/rent-collection/RentCollectionEmptyState';
import RentCard from 'components/cards/RentCard';
import MainCard from 'components/MainCard';
import BankAccountBanner from 'components/rent-collection/BankAccountBanner';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

export default function RentCollection() {
  const modal = useModal();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedProperty = useSelector(selectProperty);
  const userSettings = useSelector(selectUserSettings);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { presentation: rentReadiness, canInvoke: rentCanInvoke } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);
  const [accountStatus, setAccountStatus] = useState(null);
  const [checkingBankStatus, setCheckingBankStatus] = useState(false);

  // Check for propertyId in URL query params and set property if present
  useEffect(() => {
    const propertyIdParam = searchParams.get('propertyId');
    if (propertyIdParam) {
      // PropertySelect component will handle setting the property
      // We just need to ensure it's not reset to null
    } else {
      // Reset property selection to "All" if no propertyId in URL
      dispatch(setProperty(null));
    }
  }, [searchParams, dispatch]);

  // Load user settings on mount
  useEffect(() => {
    dispatch(getSettings());
  }, [dispatch]);

  // Check bank account status
  useEffect(() => {
    if (!rentCanInvoke) {
      setAccountStatus(null);
      setCheckingBankStatus(false);
      return;
    }
    checkBankAccountStatus();
  }, [user, rentCanInvoke]);

  const checkBankAccountStatus = async () => {
    if (!rentCanInvoke || (!user?.id && !user?.Id)) return;

    try {
      setCheckingBankStatus(true);
      const response = await axiosServices.get('/api/stripe/account-status');
      if (response.data && response.data.success && response.data.data) {
        const data = response.data.data;
        setAccountStatus({
          AccountId: data.accountId,
          Status: data.status,
          IsEnabled: data.isEnabled || false,
          ChargesEnabled: data.chargesEnabled || false,
          PayoutsEnabled: data.payoutsEnabled || false,
          DetailsSubmitted: data.detailsSubmitted || false
        });
      } else {
        setAccountStatus({
          AccountId: null,
          Status: null,
          IsEnabled: false,
          ChargesEnabled: false,
          PayoutsEnabled: false,
          DetailsSubmitted: false
        });
      }
    } catch (error) {
      console.error('Error checking Stripe account status:', error);
      setAccountStatus({
        AccountId: null,
        Status: null,
        IsEnabled: false,
        ChargesEnabled: false,
        PayoutsEnabled: false,
        DetailsSubmitted: false
      });
    } finally {
      setCheckingBankStatus(false);
    }
  };

  // Check if bank account is connected
  const isBankConnected = accountStatus?.AccountId && (accountStatus?.ChargesEnabled || accountStatus?.PayoutsEnabled);

  // Default layout: cards on xs, table on other widths
  const defaultLayout = isXs ? 'cards' : 'table';
  const [rentCollectionLayout, setRentCollectionLayout] = useState(defaultLayout);

  // Reset to default when screen size changes
  useEffect(() => {
    const newDefault = isXs ? 'cards' : 'table';
    setRentCollectionLayout(newDefault);
  }, [isXs]);

  // search + tab state
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active'); // active | needsAttention | paid | overdue | notStarted | archived
  const [refreshing, setRefreshing] = useState(false);

  // sorting state - default to sorting by status with overdue first
  const [sortField, setSortField] = useState('status'); // 'property', 'rentAmount', 'dueDate', 'overdue', 'status'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchRentCollection();
    } catch (error) {
      console.error('Error refreshing rent collection:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // fetch rent summary + records
  const propertyId = selectedProperty?.id !== undefined ? selectedProperty.id : null;
  const { summary, rentRecords, loading, refetch: refetchRentCollection } = useFetchRentCollection(propertyId, true);
  // ⬆️ hook should fetch rent details + summary (API can return both in one payload)

  // auto-fill search with property name and auto-select tab
  useEffect(() => {
    if (selectedProperty?.name) {
      setSearch(selectedProperty.name);

      // Auto-select tab based on property's rent collection status
      // Get rent records for this property
      const propertyRents = rentRecords?.filter((r) => r.propertyName.toLowerCase().includes(selectedProperty.name.toLowerCase()));

      if (propertyRents && propertyRents.length > 0) {
        // Priority: overdue > paid > notStarted > active > archived
        const hasPaymentIssues = propertyRents.some((r) => r.paymentIssueCount > 0 || r.hasLongProcessingPayment);
        const hasOverdue = propertyRents.some((r) => r.status === 'overdue');
        const hasPaid = propertyRents.some((r) => r.status === 'upToDate');
        const hasNotStarted = propertyRents.some((r) => r.status === 'notStarted');
        const hasArchived = propertyRents.some((r) => r.status === 'archived');

        if (hasPaymentIssues) {
          setTab('needsAttention');
        } else if (hasOverdue) {
          setTab('overdue');
        } else if (hasPaid) {
          setTab('paid');
        } else if (hasNotStarted) {
          setTab('notStarted');
        } else if (hasArchived) {
          setTab('archived');
        } else {
          setTab('active');
        }
      }
    } else {
      setSearch('');
      setTab('active');
    }
  }, [selectedProperty, rentRecords]);

  // filter rents based on tab + search
  const filteredRents = rentRecords?.filter((r) => {
    // When a property is selected, API already filters by propertyId, so search only needs to match unit name or tenant name
    // When no property is selected, search should match property name, unit name, or tenant name
    const searchLower = search.toLowerCase();
    const matchesSearch =
      search.trim() === '' ||
      (selectedProperty
        ? // When property is selected, search by unit name or tenant names
          r.unitName?.toLowerCase().includes(searchLower) ||
          (r.tenants &&
            Array.isArray(r.tenants) &&
            r.tenants.some((t) => `${t.firstname || ''} ${t.lastname || ''}`.toLowerCase().includes(searchLower)))
        : // When no property selected, search by property name, unit name, or tenant names
          r.propertyName?.toLowerCase().includes(searchLower) ||
          r.unitName?.toLowerCase().includes(searchLower) ||
          (r.tenants &&
            Array.isArray(r.tenants) &&
            r.tenants.some((t) => `${t.firstname || ''} ${t.lastname || ''}`.toLowerCase().includes(searchLower))));

    if (tab === 'needsAttention') return (r.paymentIssueCount > 0 || r.hasLongProcessingPayment) && matchesSearch;
    if (tab === 'paid') return r.status === 'upToDate' && matchesSearch;
    if (tab === 'overdue') return r.status === 'overdue' && matchesSearch;
    if (tab === 'notStarted') return r.status === 'notStarted' && matchesSearch;
    if (tab === 'archived') return r.status === 'archived' && matchesSearch;
    // For 'active' tab, show all non-archived items
    if (tab === 'active') return r.status !== 'archived' && matchesSearch;
    return matchesSearch;
  });

  const paymentIssueRents = useMemo(
    () => (rentRecords || []).filter((r) => r.paymentIssueCount > 0 || r.hasLongProcessingPayment),
    [rentRecords]
  );
  const longProcessingCount = paymentIssueRents.filter((r) => r.hasLongProcessingPayment).length;
  const failedOrDisputedCount = paymentIssueRents.reduce((sum, r) => sum + (r.paymentIssueCount || 0), 0);

  // Handle layout change (manual toggle - doesn't persist)
  const handleLayoutChange = (newLayout) => {
    if (newLayout === null) return;
    // Update local state immediately for instant UI feedback
    setRentCollectionLayout(newLayout);
  };

  // Handle sort column click
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // sort filtered rents based on sortField and sortOrder
  const sortedRents = useMemo(() => {
    if (!filteredRents || filteredRents.length === 0) return [];

    return [...filteredRents].sort((a, b) => {
      // Sort based on selected field
      let comparison = 0;

      switch (sortField) {
        case 'property': {
          const aDisplay =
            a.propertyType?.toLowerCase() === 'singlefamily'
              ? a.propertyName
              : a.unitName
                ? `${a.propertyName} – ${a.unitName}`
                : a.propertyName;
          const bDisplay =
            b.propertyType?.toLowerCase() === 'singlefamily'
              ? b.propertyName
              : b.unitName
                ? `${b.propertyName} – ${b.unitName}`
                : b.propertyName;
          comparison = (aDisplay || '').toLowerCase().localeCompare((bDisplay || '').toLowerCase());
          break;
        }
        case 'rentAmount':
          comparison = (a.rentAmount || 0) - (b.rentAmount || 0);
          break;
        case 'dueDate': {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          comparison = aDate - bDate;
          break;
        }
        case 'overdue':
          comparison = (a.overdueAmount || 0) - (b.overdueAmount || 0);
          break;
        case 'status': {
          // Sort by status priority: overdue > upToDate > notStarted > archived
          const statusOrder = { overdue: 0, upToDate: 1, notStarted: 2, archived: 3 };
          const aStatusOrder = statusOrder[a.status] ?? 999;
          const bStatusOrder = statusOrder[b.status] ?? 999;
          comparison = aStatusOrder - bStatusOrder;
          break;
        }
        default:
          return 0;
      }

      // Apply sort order
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredRents, sortField, sortOrder]);

  // Handle rent card actions
  const handleSendReminder = async (rent) => {
    try {
      const result = await dispatch(sendRentReminder(rent.leaseId));

      if (result.success) {
        openSnackbar({
          open: true,
          message: result.message,
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: result.message,
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to send reminder. Please try again.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };


  const getTabDisplay = (tabValue) => {
    const tabConfig = {
      active: { icon: <CheckCircleOutlined style={{ fontSize: 16 }} />, label: 'Active' },
      needsAttention: { icon: <AlertOutlined style={{ fontSize: 16 }} />, label: 'Needs Attention' },
      paid: { icon: <DollarOutlined style={{ fontSize: 16 }} />, label: 'Paid' },
      overdue: { icon: <AlertOutlined style={{ fontSize: 16 }} />, label: 'Overdue' },
      notStarted: { icon: <ClockCircleOutlined style={{ fontSize: 16 }} />, label: 'Not Started' },
      archived: { icon: <FileTextOutlined style={{ fontSize: 16 }} />, label: 'Archived' }
    };
    return tabConfig[tabValue] || tabConfig.active;
  };

  return (
    <Box>
      {/* Enhanced Header */}
      <RentCollectionHeader />
      <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection" />

      {/* Bank Account Banner - Show if bank account is not connected */}
      {rentCanInvoke && !checkingBankStatus && !isBankConnected && (
        <Box sx={{ mb: 3 }}>
          <BankAccountBanner />
        </Box>
      )}

      {/* Tenant payment metrics and landlord settlement are intentionally presented separately. */}
      <RentCollectionMetrics summary={summary} />
      <SettlementSummary summary={summary} />

      {paymentIssueRents.length > 0 && (
        <Alert
          severity="warning"
          sx={{
            mt: 3,
            borderRadius: 2,
            '& .MuiAlert-message': { width: '100%' }
          }}
          action={
            <Button color="inherit" size="small" onClick={() => setTab('needsAttention')}>
              Review
            </Button>
          }
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="body2" fontWeight={700}>
              ACH/payment issues need attention
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {failedOrDisputedCount > 0 && <Chip size="small" color="error" label={`${failedOrDisputedCount} failed/disputed`} />}
              {longProcessingCount > 0 && <Chip size="small" color="warning" label={`${longProcessingCount} processing over 5 days`} />}
            </Stack>
          </Stack>
        </Alert>
      )}

      {/* Search + Tabs */}
      <MainCard
        sx={{
          mt: 3,
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            '@media (max-width: 912px)': {
              flexDirection: 'column',
              alignItems: 'stretch'
            }
          }}
        >
          <PropertySelect width="100%" requestedPropertyId={searchParams.get('propertyId')} />

          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'wrap',
              flexShrink: 0,
              '@media (max-width: 912px)': {
                width: '100%',
                justifyContent: 'flex-start'
              }
            }}
          >
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                displayEmpty
                renderValue={(value) => {
                  const { icon, label } = getTabDisplay(value);
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {icon}
                      <span>{label}</span>
                    </Box>
                  );
                }}
                sx={{
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1
                  }
                }}
              >
                <MenuItem value="active">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleOutlined style={{ fontSize: 16 }} />
                    <span>Active</span>
                  </Box>
                </MenuItem>
                <MenuItem value="needsAttention">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AlertOutlined style={{ fontSize: 16 }} />
                    <span>Needs Attention</span>
                  </Box>
                </MenuItem>
                <MenuItem value="paid">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DollarOutlined style={{ fontSize: 16 }} />
                    <span>Paid</span>
                  </Box>
                </MenuItem>
                <MenuItem value="overdue">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AlertOutlined style={{ fontSize: 16 }} />
                    <span>Overdue</span>
                  </Box>
                </MenuItem>
                <MenuItem value="notStarted">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ClockCircleOutlined style={{ fontSize: 16 }} />
                    <span>Not Started</span>
                  </Box>
                </MenuItem>
                <MenuItem value="archived">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileTextOutlined style={{ fontSize: 16 }} />
                    <span>Archived</span>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            <ToggleButtonGroup
              value={rentCollectionLayout}
              exclusive
              onChange={(e, newLayout) => {
                if (newLayout !== null) {
                  handleLayoutChange(newLayout);
                }
              }}
              size="small"
              aria-label="view layout"
            >
              <Tooltip title="Card View">
                <ToggleButton value="cards" aria-label="cards">
                  <AppstoreOutlined />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Table View">
                <ToggleButton value="table" aria-label="table">
                  <TableOutlined />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
            <Button
              size="small"
              variant="text"
              startIcon={<ReloadOutlined style={{ fontSize: 16 }} />}
              onClick={handleRefresh}
              disabled={refreshing}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                },
                '&:disabled': {
                  color: 'text.disabled'
                }
              }}
            >
              Refresh
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={() => {
                const params = new URLSearchParams();
                if (selectedProperty?.id) {
                  params.set('propertyId', selectedProperty.id);
                }
                navigate(`/landlord/leases/selection${params.size ? `?${params.toString()}` : ''}`);
              }}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              Create Lease with AI Builder
            </Button>
          </Box>
        </Box>
      </MainCard>

      {/* Rent Records Display */}
      {loading || refreshing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      ) : sortedRents.length > 0 ? (
        rentCollectionLayout === 'table' ? (
          <RentCollectionTable
            sortedRents={sortedRents}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onSendReminder={handleSendReminder}
          />
        ) : (
          <Grid container spacing={3}>
            {sortedRents.map((rent) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={rent.leaseId || rent.id}>
                <RentCard rent={rent} onSendReminder={handleSendReminder} />
              </Grid>
            ))}
          </Grid>
        )
      ) : (
        <RentCollectionEmptyState tab={tab} />
      )}
      <PaymentModal
        open={modal.openPayment}
        rent={modal.selectedRent}
        onClose={modal.closePaymentModal}
        onSuccess={refetchRentCollection}
        defaultAmount={0}
      />
    </Box>
  );
}
