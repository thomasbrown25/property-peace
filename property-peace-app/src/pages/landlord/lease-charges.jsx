import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  alpha,
  useTheme,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Alert,
  Link,
  Collapse
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { 
  DollarOutlined, 
  ReloadOutlined, 
  PlusOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  CloseOutlined,
  LockOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import DueDateSelector from 'components/input/DueDateSelector';
import ConfigureLateFeesModal from 'components/dialogs/ConfigureLateFeesModal';
import StripeConnectOnboardingDialog from 'components/dialogs/StripeConnectOnboardingDialog';
import { formatCurrency, formatDate } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { updateLease } from 'store/lease/lease.action';
import { getBankAccounts, getBankAccount } from 'api/bankAccount';
import axiosServices from 'utils/axios';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

// Helper to format due date for display (1st, 2nd, Last day, etc.)
const formatDueDateDisplay = (value) => {
  if (value == null || value === undefined) return 'Not set';
  if (value === -1 || value === 'last' || value === 'lastDay') return 'Last day of the month';
  const day = parseInt(value, 10);
  if (isNaN(day) || day < 1 || day > 28) return 'Not set';
  const suffix = day >= 11 && day <= 13 ? 'th' : [undefined, 'st', 'nd', 'rd'][day % 10] || 'th';
  return `${day}${suffix} of each month`;
};

export default function LeaseCharges() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();
  const { presentation: rentReadiness, canInvoke: rentCanInvoke } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);
  
  // Find the lease from properties (include property and unit for updateLease)
  const lease = useMemo(() => {
    return properties
      ?.flatMap((p) =>
        (p.units || [])
          .filter((u) => u.lease)
          .map((u) => ({ ...u.lease, unit: u, property: p }))
      )
      ?.find((l) => l?.id?.toString() === leaseId);
  }, [properties, leaseId]);

  const property = lease?.property;

  const unit = lease?.unit;

  const currentLeaseId = lease?.id ?? lease?.Id ?? leaseId;

  // Rent state
  const rentAmount = lease?.rentAmount ?? lease?.RentAmount ?? null;
  const rentDueDay = lease?.rentDueDay ?? lease?.RentDueDay ?? null;
  const hasRentDefined = rentAmount != null && rentAmount > 0;

  const [showAddRentForm, setShowAddRentForm] = useState(false);
  const [editingRent, setEditingRent] = useState(false);
  const [rentForm, setRentForm] = useState({ amount: '', dueDate: null });
  const [savingRent, setSavingRent] = useState(false);

  // Late fees
  const lateFees = useMemo(() => {
    const fees = lease?.fees ?? lease?.Fees ?? [];
    return fees.filter((f) => f.isLateFee === true || f.IsLateFee === true);
  }, [lease?.fees, lease?.Fees]);

  const [lateFeesModalOpen, setLateFeesModalOpen] = useState(false);

  // How will you collect rent? Both can be selected; re-clicking an option unselects it.
  const rentCollectionByPlatform = lease?.rentCollectionByPlatform ?? lease?.RentCollectionByPlatform;
  const [collectThroughPlatform, setCollectThroughPlatform] = useState(
    rentCollectionByPlatform !== false
  );
  const [collectOutsidePlatform, setCollectOutsidePlatform] = useState(
    rentCollectionByPlatform === false
  );

  // Payment account (Stripe / bank account for this lease)
  const leaseOperatingAccountId = lease?.operatingAccountId ?? lease?.OperatingAccountId;
  const [operatingAccount, setOperatingAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [bankingModalOpen, setBankingModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [savingBankAccount, setSavingBankAccount] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);

  // Fetch operating account details for the lease
  useEffect(() => {
    const fetchOperatingAccount = async () => {
      if (!rentCanInvoke || !leaseOperatingAccountId) {
        setOperatingAccount(null);
        setLoadingAccount(false);
        return;
      }
      if (leaseOperatingAccountId) {
        setLoadingAccount(true);
        try {
          const response = await getBankAccount(leaseOperatingAccountId);
          if (response.success && response.data) {
            setOperatingAccount(response.data);
          } else {
            setOperatingAccount(null);
          }
        } catch (error) {
          console.error('Error fetching operating account:', error);
          setOperatingAccount(null);
        } finally {
          setLoadingAccount(false);
        }
      } else {
        setOperatingAccount(null);
      }
    };
    fetchOperatingAccount();
  }, [leaseOperatingAccountId, rentCanInvoke]);

  // Fetch bank accounts when modal opens
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (!bankingModalOpen || !rentCanInvoke) {
        setLoadingBankAccounts(false);
        return;
      }
      if (bankingModalOpen) {
        setLoadingBankAccounts(true);
        try {
          const response = await getBankAccounts();
          if (response.success && response.data) {
            setBankAccounts(response.data || []);
            setSelectedAccountId(leaseOperatingAccountId ?? null);
          }
        } catch (error) {
          console.error('Error fetching bank accounts:', error);
          openSnackbar({
            open: true,
            message: 'Failed to load bank accounts',
            variant: 'alert',
            alert: { color: 'error' }
          });
        } finally {
          setLoadingBankAccounts(false);
        }
      }
    };
    fetchBankAccounts();
  }, [bankingModalOpen, leaseOperatingAccountId, rentCanInvoke]);

  useEffect(() => {
    if (!rentCanInvoke) {
      setBankingModalOpen(false);
      setShowStripeOnboarding(false);
      setBankAccounts([]);
      setSelectedAccountId(null);
    }
  }, [rentCanInvoke]);

  const handleSaveBankAccount = async () => {
    if (!rentCanInvoke || !currentLeaseId) return;
    setSavingBankAccount(true);
    try {
      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id,
        unitId: unit?.id,
        name: lease?.name ?? lease?.Name,
        startDate: lease?.startDate ?? lease?.StartDate,
        endDate: lease?.endDate ?? lease?.EndDate,
        rentAmount: lease?.rentAmount ?? lease?.RentAmount,
        depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
        operatingAccountId: selectedAccountId || null
      };
      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) {
        openSnackbar({
          open: true,
          message: 'Payment account updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setBankingModalOpen(false);
        propertiesRefetch();
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to update payment account',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error updating payment account:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to update payment account',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingBankAccount(false);
    }
  };

  const handleStripeOnboardingComplete = async () => {
    if (!rentCanInvoke) return;
    setShowStripeOnboarding(false);
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await axiosServices.post('/api/stripe/sync-bank-account');
      propertiesRefetch();
      if (bankingModalOpen) {
        const response = await getBankAccounts();
        if (response.success && response.data) {
          setBankAccounts(response.data || []);
        }
      }
    } catch (err) {
      console.error('Error syncing bank account:', err);
    }
  };

  // Initialize rent form when adding
  useEffect(() => {
    if (showAddRentForm && !hasRentDefined) {
      setRentForm({
        amount: '',
        dueDate: rentDueDay != null ? rentDueDay : 1
      });
    }
  }, [showAddRentForm, hasRentDefined]);

  // Initialize rent form when editing
  useEffect(() => {
    if (editingRent && hasRentDefined) {
      setRentForm({
        amount: String(rentAmount),
        dueDate: rentDueDay != null ? rentDueDay : 1
      });
    }
  }, [editingRent, hasRentDefined, rentAmount, rentDueDay]);

  const getLeaseStartIso = () => {
    const start = lease?.startDate || lease?.StartDate;
    if (start) return new Date(start).toISOString();
    return new Date().toISOString();
  };

  const buildFeesForApi = () => {
    const leaseStart = getLeaseStartIso();
    const fees = lease?.fees ?? lease?.Fees ?? [];
    const oneTimeFees = fees.filter((f) => !(f.isLateFee ?? f.IsLateFee));
    return (oneTimeFees || []).map((f) => ({
      id: f.id ?? f.Id,
      leaseId: currentLeaseId,
      name: f.name ?? f.Name,
      amount: f.amount ?? f.Amount,
      dueDate: f.dueDate ?? f.DueDate ?? leaseStart,
      isLateFee: false
    }));
  };

  const handleSaveRent = async () => {
    const amount = rentForm.amount ? parseFloat(rentForm.amount) : 0;
    if (!amount || amount <= 0) {
      openSnackbar({
        open: true,
        message: 'Please enter a valid rent amount',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    if (rentForm.dueDate === null || rentForm.dueDate === undefined) {
      openSnackbar({
        open: true,
        message: 'Please select a due date',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSavingRent(true);
    try {
      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id,
        unitId: unit?.id,
        name: lease?.name || lease?.Name,
        startDate: lease?.startDate || lease?.StartDate,
        endDate: lease?.endDate || lease?.EndDate,
        rentAmount: amount,
        depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
        leaseLength: lease?.leaseLength ?? lease?.LeaseLength,
        rentFrequency: lease?.rentFrequency ?? lease?.RentFrequency ?? 'Monthly',
        rentDueDay: rentForm.dueDate,
        fees: buildFeesForApi()
      };
      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) {
        await propertiesRefetch();
        openSnackbar({
          open: true,
          message: 'Rent saved successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setShowAddRentForm(false);
        setEditingRent(false);
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to save rent',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error saving rent:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save rent',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingRent(false);
    }
  };

  const handleDeleteRent = async () => {
    if (!window.confirm('Are you sure you want to remove the rent amount from this lease?')) return;

    setSavingRent(true);
    try {
      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id,
        unitId: unit?.id,
        name: lease?.name || lease?.Name,
        startDate: lease?.startDate || lease?.StartDate,
        endDate: lease?.endDate || lease?.EndDate,
        rentAmount: 0,
        depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
        leaseLength: lease?.leaseLength ?? lease?.LeaseLength,
        rentFrequency: lease?.rentFrequency ?? lease?.RentFrequency ?? 'Monthly',
        rentDueDay: rentForm.dueDate ?? 1,
        fees: buildFeesForApi()
      };
      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) {
        await propertiesRefetch();
        openSnackbar({
          open: true,
          message: 'Rent removed',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditingRent(false);
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to remove rent',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error removing rent:', error);
      openSnackbar({
        open: true,
        message: 'Failed to remove rent',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingRent(false);
    }
  };

  const handleLateFeesSave = async (newLateFees) => {
    try {
      const leaseStart = getLeaseStartIso();
      const oneTimeFeesForApi = buildFeesForApi();
      const allFees = [...oneTimeFeesForApi, ...newLateFees];

      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id,
        unitId: unit?.id,
        name: lease?.name || lease?.Name,
        startDate: lease?.startDate || lease?.StartDate,
        endDate: lease?.endDate || lease?.EndDate,
        rentAmount: lease?.rentAmount ?? lease?.RentAmount ?? 0,
        depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
        leaseLength: lease?.leaseLength ?? lease?.LeaseLength,
        rentFrequency: lease?.rentFrequency ?? lease?.RentFrequency ?? 'Monthly',
        rentDueDay: lease?.rentDueDay ?? lease?.RentDueDay ?? 1,
        fees: allFees
      };

      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) {
        await propertiesRefetch();
        openSnackbar({
          open: true,
          message: 'Late fees saved successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setLateFeesModalOpen(false);
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to save late fees',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error saving late fees:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save late fees',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // One-time charges form state
  const [showAddOneTimeChargeForm, setShowAddOneTimeChargeForm] = useState(false);
  const [oneTimeCharge, setOneTimeCharge] = useState({
    category: 'Security Deposit',
    amount: '',
    dueDate: '',
    description: ''
  });

  const handleOneTimeChargeChange = (field, value) => {
    setOneTimeCharge(prev => ({ ...prev, [field]: value }));
  };

  const handleAddOneTimeCharge = async () => {
    // TODO: Implement add logic
    openSnackbar({
      open: true,
      message: 'One-time charge added successfully',
      variant: 'alert',
      alert: { color: 'success' }
    });
  };

  const handleCancel = () => navigate(`/landlord/leases/${leaseId}`);

  const hasBankAccount = !!(leaseOperatingAccountId || selectedAccountId);

  const validateAndSaveRentPayments = async (payloadExtra = {}) => {
    if (!currentLeaseId || !property?.id || !unit?.id) return false;
    if (hasRentDefined && !collectThroughPlatform && !collectOutsidePlatform) {
      openSnackbar({
        open: true,
        message: 'Please select how you will collect rent.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return false;
    }
    if (hasRentDefined && rentCanInvoke && collectThroughPlatform && !hasBankAccount) {
      openSnackbar({
        open: true,
        message: 'Please add or select a bank account to complete Set up Rent Payments.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return false;
    }
    try {
      await dispatch(updateLease({
        id: currentLeaseId,
        propertyId: property.id,
        unitId: unit.id,
        name: lease?.name || lease?.Name,
        startDate: lease?.startDate || lease?.StartDate,
        endDate: lease?.endDate || lease?.EndDate,
        rentAmount: lease?.rentAmount ?? lease?.RentAmount,
        depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
        leaseLength: lease?.leaseLength ?? lease?.LeaseLength,
        rentFrequency: lease?.rentFrequency ?? lease?.RentFrequency ?? 'Monthly',
        rentDueDay: lease?.rentDueDay ?? lease?.RentDueDay ?? 1,
        rentCollectionByPlatform: rentCanInvoke && collectThroughPlatform,
        operatingAccountId: rentCanInvoke && collectThroughPlatform ? (selectedAccountId ?? leaseOperatingAccountId ?? null) : null,
        fees: lease?.fees ?? lease?.Fees ?? [],
        ...payloadExtra
      }));
      await propertiesRefetch();
      return true;
    } catch (e) {
      console.error('Error saving rent payment setup:', e);
      return false;
    }
  };

  const handleSkip = async () => {
    const saved = await validateAndSaveRentPayments();
    if (saved) navigate(`/landlord/leases/${leaseId}`);
  };

  const handleNext = async () => {
    const saved = await validateAndSaveRentPayments();
    if (saved) navigate(`/landlord/leases/${leaseId}`, { state: { scrollToSection: 'move-in-condition' } });
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases', path: '/landlord/leases' },
          { label: 'Set Up Rent Payments' }
        ]}
      />

      <Stack spacing={3} sx={{ mt: 3 }}>
        {/* Heading Card */}
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <IconButton onClick={() => navigate(`/landlord/leases/${leaseId}`)}>
              <ArrowLeftOutlined />
            </IconButton>
            <Typography variant="h4" fontWeight={700}>
              Add Your Charges
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            We automatically send charges to tenants 15 days before the due date. You can add and edit charges later on too.
          </Typography>
        </MainCard>

        <Grid container spacing={3}>
          {/* Set up Rent Payments Card - Rent and Late Fees */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <ReloadOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={700}>
                    Set up Rent Payments
                  </Typography>
                </Stack>
              }
              sx={{
                height: '100%',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={3}>
                {/* Rent Section */}
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                    Monthly Rent
                  </Typography>

                  {hasRentDefined && !editingRent && !showAddRentForm ? (
                    /* Show defined rent - editable and deletable */
                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Rent
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatCurrency(rentAmount)} due {formatDueDateDisplay(rentDueDay)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => setEditingRent(true)}
                            aria-label="Edit rent"
                          >
                            <EditOutlined />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={handleDeleteRent}
                            disabled={savingRent}
                            aria-label="Delete rent"
                          >
                            <DeleteOutlined />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Box>
                  ) : (showAddRentForm || editingRent) ? (
                    /* Add or Edit rent form */
                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ minWidth: 160, flex: 1 }}>
                          <InputLabel htmlFor="rent-amount-input" sx={{ mb: 0.5 }}>Rent Amount</InputLabel>
                          <NumericFormat
                            customInput={TextField}
                            id="rent-amount-input"
                            fullWidth
                            size="small"
                            value={rentForm.amount || ''}
                            onValueChange={(values) => setRentForm(prev => ({ ...prev, amount: values.floatValue != null ? String(values.floatValue) : '' }))}
                            thousandSeparator
                            prefix="$"
                            decimalScale={2}
                            fixedDecimalScale
                            placeholder="$0.00"
                          />
                        </Box>
                        <Box sx={{ minWidth: 180, flex: 1 }}>
                          <DueDateSelector
                            label="Due Date"
                            value={rentForm.dueDate}
                            onChange={(value) => setRentForm(prev => ({ ...prev, dueDate: value }))}
                            helperText="Day of month when rent is due"
                          />
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleSaveRent}
                          disabled={savingRent}
                          sx={{ textTransform: 'none' }}
                        >
                          {savingRent ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setShowAddRentForm(false);
                            setEditingRent(false);
                          }}
                          disabled={savingRent}
                          sx={{ textTransform: 'none' }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Box>
                  ) : null}

                  {!hasRentDefined && !showAddRentForm && !editingRent && (
                    <Button
                      variant="outlined"
                      startIcon={<PlusOutlined />}
                      onClick={() => setShowAddRentForm(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      Add rent amount
                    </Button>
                  )}
                </Box>

                {/* Late Fees Section */}
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                    Late Fees
                  </Typography>
                  {lateFees.length > 0 ? (
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      {lateFees.map((fee) => (
                        <Box
                          key={fee.id || fee.Id}
                          sx={{
                            p: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            bgcolor: 'background.paper'
                          }}
                        >
                          <Typography variant="subtitle2" fontWeight={600}>
                            {fee.name || fee.Name || (fee.lateFeeType === 'OneTime' ? 'One-time Initial Fee' : 'Daily Late Fees')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {fee.lateFeeType === 'OneTime' ? (
                              <>
                                {fee.feeType === 'Flat' ? `${formatCurrency(fee.amount || fee.Amount)}` : `${fee.percentValue || fee.PercentValue}% ${fee.feeType === 'PercentRent' ? 'of rent' : 'of unpaid'}`}
                                {' • Applied '}
                                {fee.appliedAfterDays || fee.AppliedAfterDays} day{(fee.appliedAfterDays || fee.AppliedAfterDays) !== 1 ? 's' : ''} after rent is due
                              </>
                            ) : (
                              <>
                                {formatCurrency(fee.amount || fee.Amount)} per day
                                {' • Starting '}
                                {fee.startingAfterDays || fee.StartingAfterDays} day{(fee.startingAfterDays || fee.StartingAfterDays) !== 1 ? 's' : ''} after rent is due
                                {fee.limitType && fee.limitType !== 'NoLimit' && (
                                  <>
                                    {' • '}
                                    {fee.limitType === 'StopAfterDays'
                                      ? `Stop after ${fee.limitDays || fee.LimitDays} days`
                                      : `Max total: ${fee.limitAmountType === 'Flat' ? '$' : ''}${fee.limitAmount || fee.LimitAmount}${fee.limitAmountType === 'PercentRent' ? '% of rent' : ''}`
                                    }
                                  </>
                                )}
                              </>
                            )}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      No late fees configured.
                    </Typography>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<PlusOutlined />}
                    onClick={() => setLateFeesModalOpen(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Late Fees
                  </Button>
                </Box>
              </Stack>
            </MainCard>
          </Grid>

          {/* One-time Charges Card */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <DollarOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={700}>
                    One-time Charges
                  </Typography>
                </Stack>
              }
              contentSX={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0
              }}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Good for deposits, pro-rated rent, move-in fees, etc.
                </Typography>

                {/* Pre-filled deposits and one-time fees from lease */}
                {(() => {
                  const existingCharges = [];
                  const depAmt = lease?.depositAmount ?? lease?.DepositAmount;
                  if (depAmt != null && depAmt > 0) {
                    existingCharges.push({ name: 'Security Deposit', amount: depAmt, dueDate: lease?.startDate });
                  }
                  const petDep = lease?.petDepositAmount ?? lease?.PetDepositAmount;
                  if (petDep != null && petDep > 0) {
                    existingCharges.push({ name: 'Pet Deposit', amount: petDep, dueDate: lease?.startDate });
                  }
                  const leaseDeps = lease?.leaseDeposits ?? lease?.LeaseDeposits ?? [];
                  (leaseDeps || []).forEach((d) => {
                    existingCharges.push({ name: d.name || 'Deposit', amount: d.amount ?? d.Amount, dueDate: d.dueDate ?? d.DueDate });
                  });
                  const fees = lease?.fees ?? lease?.Fees ?? [];
                  (fees || []).filter((f) => !(f.isLateFee ?? f.IsLateFee)).forEach((f) => {
                    existingCharges.push({ name: f.name || f.Name || 'Fee', amount: f.amount ?? f.Amount, dueDate: f.dueDate ?? f.DueDate });
                  });
                  if (existingCharges.length === 0) return null;
                  return (
                    <Box sx={{ mb: 2, p: 2, borderRadius: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.05), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Already defined on lease</Typography>
                      <Stack spacing={1}>
                        {existingCharges.map((c, i) => (
                          <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                            <Typography variant="body2">{c.name}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {c.dueDate && (
                                <Typography variant="caption" color="text.secondary">Due {formatDate(c.dueDate)}</Typography>
                              )}
                              <Typography variant="body2" fontWeight={600}>{formatCurrency(c.amount)}</Typography>
                            </Stack>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  );
                })()}

                {showAddOneTimeChargeForm ? (
                  <Stack spacing={3}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={oneTimeCharge.category}
                        label="Category"
                        onChange={(e) => handleOneTimeChargeChange('category', e.target.value)}
                      >
                        <MenuItem value="Security Deposit">Security Deposit</MenuItem>
                        <MenuItem value="Pro-rated Rent">Pro-rated Rent</MenuItem>
                        <MenuItem value="Move-in Fee">Move-in Fee</MenuItem>
                        <MenuItem value="Application Fee">Application Fee</MenuItem>
                        <MenuItem value="Pet Deposit">Pet Deposit</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      fullWidth
                      label="Amount"
                      type="number"
                      value={oneTimeCharge.amount}
                      onChange={(e) => handleOneTimeChargeChange('amount', e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Due Date"
                      type="date"
                      value={oneTimeCharge.dueDate}
                      onChange={(e) => handleOneTimeChargeChange('dueDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                      fullWidth
                      label="Description (Optional)"
                      multiline
                      rows={3}
                      value={oneTimeCharge.description}
                      onChange={(e) => handleOneTimeChargeChange('description', e.target.value)}
                      helperText={`${oneTimeCharge.description.length} / 50 characters used`}
                      inputProps={{ maxLength: 50 }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          
                        }
                      }}
                    />
                  </Stack>
                ) : (
                  <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-start' }}>
                    <Button
                      variant="outlined"
                      startIcon={<PlusOutlined />}
                      onClick={() => setShowAddOneTimeChargeForm(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      Add one-time charge
                    </Button>
                  </Box>
                )}
              </Box>
            </MainCard>
          </Grid>
        </Grid>

        {/* Payment account – How will you collect rent? + connect bank account */}
        <MainCard
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <BankOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={700}>
                Payment account
              </Typography>
            </Stack>
          }
          sx={{
            mt: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            How will you collect rent?
          </Typography>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection" />
            <Card
              onClick={() => {
                if (rentCanInvoke) setCollectThroughPlatform((prev) => !prev);
              }}
              aria-disabled={!rentCanInvoke}
              sx={{
                cursor: rentCanInvoke ? 'pointer' : 'not-allowed',
                opacity: rentCanInvoke ? 1 : 0.6,
                border: `2px solid ${rentCanInvoke && collectThroughPlatform ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
                bgcolor: 'background.paper',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: theme.palette.primary.main }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Checkbox
                    checked={rentCanInvoke && collectThroughPlatform}
                    disabled={!rentCanInvoke}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (rentCanInvoke) setCollectThroughPlatform((prev) => !prev);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mt: -1 }}
                  />
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                      <Typography variant="h6" fontWeight={600}>
                        Payments through Property Peace
                      </Typography>
                      <Chip
                        label="RECOMMENDED"
                        size="small"
                        sx={{
                          bgcolor: '#ff9800',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          height: 22
                        }}
                      />
                    </Stack>
                    <Stack spacing={0.5} sx={{ ml: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        • ACH/direct deposit
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Debit or credit card
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Collapse in={rentCanInvoke && collectThroughPlatform} timeout={300}>
            <Box sx={{ pt: 1, px: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select or add a bank account to receive rent payments for this lease. You can change it later.
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" sx={{ mb: 3 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <BankOutlined style={{ fontSize: 18, color: theme.palette.info.main }} />
                </Box>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  {operatingAccount ? 'Payment account connected' : 'No payment account connected'}
                </Typography>
                {loadingAccount ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Loading...
                    </Typography>
                  </Box>
                ) : operatingAccount ? (
                  <Stack spacing={0.5} direction="row" alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={500}>
                      {operatingAccount.displayName || 'Bank Account'}
                    </Typography>
                    {(operatingAccount.bankName || operatingAccount.last4) && (
                      <Typography variant="caption" color="text.secondary">
                        {[operatingAccount.bankName, operatingAccount.last4 && `****${operatingAccount.last4}`].filter(Boolean).join(' • ')}
                      </Typography>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditOutlined style={{ fontSize: 14 }} />}
                      onClick={() => setBankingModalOpen(true)}
                      sx={{
                        textTransform: 'none',
                        color: 'info.main',
                        borderColor: 'info.main',
                        '&:hover': { borderColor: 'info.dark', bgcolor: alpha(theme.palette.info.main, 0.08) }
                      }}
                    >
                      Change account
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PlusOutlined style={{ fontSize: 14 }} />}
                    onClick={() => setBankingModalOpen(true)}
                    sx={{
                      textTransform: 'none',
                      color: 'info.main',
                      borderColor: 'info.main',
                      '&:hover': { borderColor: 'info.dark', bgcolor: alpha(theme.palette.info.main, 0.08) }
                    }}
                  >
                    Select or add bank account
                  </Button>
                )}
              </Stack>

              <Alert
                severity="success"
                icon={<LockOutlined />}
                sx={{
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                  '& .MuiAlert-icon': { color: theme.palette.success.main }
                }}
              >
                <Typography variant="body2">
                  <strong>Guaranteed secure.</strong> Our payment processor, Stripe, requires identity verification in order to collect rent.
                  Property Peace takes security seriously.{' '}
                  <Link href="/landlord/help" target="_blank" rel="noopener noreferrer" sx={{ fontSize: 'inherit' }}>
                    Learn how Property Peace protects its user&apos;s data.
                  </Link>
                </Typography>
              </Alert>
            </Box>
          </Collapse>


            <Card
              onClick={() => setCollectOutsidePlatform((prev) => !prev)}
              sx={{
                cursor: 'pointer',
                border: `2px solid ${collectOutsidePlatform ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
                bgcolor: 'background.paper',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: theme.palette.primary.main }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Checkbox
                    checked={collectOutsidePlatform}
                    onChange={(e) => {
                      e.stopPropagation();
                      setCollectOutsidePlatform((prev) => !prev);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mt: -1 }}
                  />
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Methods outside of Property Peace
                    </Typography>
                    <Stack spacing={0.5} sx={{ ml: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        • Cash, check, payment apps, voucher, money order, etc.
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            

          </Stack>
        </MainCard>

        {/* Bottom Navigation */}
        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleSkip}
            sx={{ textTransform: 'none' }}
          >
            Save
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            sx={{ 
              textTransform: 'none',
              fontWeight: 700,
              px: 2,
              py: 1,
              
            }}
          >
            Save & Next
          </Button>
        </Stack>
      </Stack>

      <ConfigureLateFeesModal
        open={lateFeesModalOpen}
        onClose={() => setLateFeesModalOpen(false)}
        onSave={handleLateFeesSave}
        leaseId={currentLeaseId}
        propertyState={property?.state || property?.State}
        existingLateFees={lateFees}
      />

      {/* Payment account selection dialog */}
      {rentCanInvoke && bankingModalOpen && (
      <Dialog open={bankingModalOpen} onClose={() => setBankingModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Payment account</Typography>
            <IconButton onClick={() => setBankingModalOpen(false)} size="small" sx={{ color: 'text.secondary' }}>
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Select the bank account for this lease. Rent payments will be deposited here.
            </Typography>
            {loadingBankAccounts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="lease-charges-bank-account-label">Bank account</InputLabel>
                <Select
                  labelId="lease-charges-bank-account-label"
                  value={selectedAccountId || ''}
                  label="Bank account"
                  onChange={(e) => setSelectedAccountId(e.target.value || null)}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {bankAccounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      <Stack>
                        <Typography variant="body1">{account.displayName || 'Bank Account'}</Typography>
                        {account.last4 && (
                          <Typography variant="caption" color="text.secondary">
                            ****{account.last4} {account.bankName ? `• ${account.bankName}` : ''}
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Button
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={() => setShowStripeOnboarding(true)}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              Add new bank account
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankingModalOpen(false)} disabled={savingBankAccount}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveBankAccount}
            disabled={savingBankAccount || loadingBankAccounts}
            startIcon={savingBankAccount ? <CircularProgress size={16} /> : null}
          >
            {savingBankAccount ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      {rentCanInvoke && showStripeOnboarding && (
      <StripeConnectOnboardingDialog
        open={showStripeOnboarding}
        onClose={() => setShowStripeOnboarding(false)}
        onComplete={handleStripeOnboardingComplete}
      />
      )}
    </Box>
  );
}
