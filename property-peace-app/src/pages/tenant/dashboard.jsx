import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import {
  Divider,
  Grid,
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  DollarOutlined,
  CalendarOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  WarningOutlined,
  SettingOutlined,
  MobileOutlined
} from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate } from 'utils/formatters';
import { calculateNextPaymentDate } from 'utils/helper-methods';
import MainCard from 'components/MainCard';
import { useModal } from 'contexts/ModalContext';
import { useLease } from 'contexts/LeaseContext';

// Get selectedLeaseId and leases directly to avoid dependency on getSelectedLease function
import PaymentModal from 'components/drawers/PaymentModal';
import Announcements from 'sections/tenant/dashboard/Announcements';
import LeaseSelector from 'components/LeaseSelector';
import { openSnackbar } from 'api/snackbar';
import moment from 'moment';
import useRentPaymentActionReadiness from 'hooks/useRentPaymentActionReadiness';
import { classifyPaymentStatus, isBalanceCreditingPayment } from 'utils/paymentSafety';
import { normalizeRentBalance } from 'utils/rentBalance';
import { createRentStripeLoader, requireRentStripeAccount } from 'utils/connectedRentStripe.mjs';
import SavedRentPaymentMethods from 'components/payments/SavedRentPaymentMethods';
import { getStatusPillSx } from 'themes/statusPillStyles';

// ==============================|| TENANT - DASHBOARD ||============================== //

const getTenantDashboardStripe = createRentStripeLoader(loadStripe);

function formatTenantSmsPhone(raw) {
  if (!raw) return '';
  const digits = raw.toString().replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function getLandlordPhoneFromLease(lease) {
  if (!lease) return null;

  return (
    lease.landlordPhone ||
    lease.LandlordPhone ||
    lease.landlord?.phoneNumber ||
    lease.landlord?.PhoneNumber ||
    lease.unit?.property?.landlord?.phoneNumber ||
    lease.unit?.property?.landlord?.PhoneNumber ||
    lease.Unit?.Property?.Landlord?.PhoneNumber ||
    null
  );
}

function getPaymentStatus(payment) {
  return classifyPaymentStatus(payment).status;
}

function getPaymentStatusMeta(payment) {
  const status = getPaymentStatus(payment).toLowerCase();
  switch (status) {
    case 'completed':
    case 'paid':
      return {
        label: 'Paid',
        color: 'success',
        icon: <CheckCircleOutlined />,
        accent: 'primary',
        datePrefix: 'Paid on'
      };
    case 'processing':
      return {
        label: 'Processing',
        color: 'info',
        icon: <ClockCircleOutlined />,
        accent: 'info',
        datePrefix: 'Submitted on'
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'error',
        icon: <CloseCircleOutlined />,
        accent: 'error',
        datePrefix: 'Failed on'
      };
    case 'canceled':
    case 'cancelled':
      return {
        label: 'Canceled',
        color: 'default',
        icon: <CloseCircleOutlined />,
        accent: 'default',
        datePrefix: 'Canceled on'
      };
    case 'disputed':
      return {
        label: 'Disputed',
        color: 'error',
        icon: <WarningOutlined />,
        accent: 'warning',
        datePrefix: 'Disputed on'
      };
    default:
      return {
        label: 'Needs review',
        color: 'warning',
        icon: <WarningOutlined />,
        accent: 'warning',
        datePrefix: 'Submitted on'
      };
  }
}

function getPaymentDisplayDate(payment) {
  return (
    payment?.paymentDate ||
    payment?.PaymentDate ||
    payment?.submittedAt ||
    payment?.SubmittedAt ||
    payment?.createdAt ||
    payment?.CreatedAt ||
    null
  );
}

function getPaymentMethodLabel(payment) {
  const rawMethod = payment?.method || payment?.Method || payment?.paymentMethod || payment?.PaymentMethod || null;
  const stripeType = (payment?.stripePaymentMethodType || payment?.StripePaymentMethodType || '').toLowerCase();
  const walletType = (payment?.stripePaymentMethodWalletType || payment?.StripePaymentMethodWalletType || '').toLowerCase();
  const last4 = payment?.stripePaymentMethodLast4 || payment?.StripePaymentMethodLast4 || null;

  if (walletType === 'cashapp' || walletType === 'cash_app') return 'Cash App Payment';
  if (stripeType === 'us_bank_account' || stripeType === 'ach') return last4 ? `ACH ****${last4} Payment` : 'ACH Payment';
  if (stripeType === 'card') return 'Credit Card Payment';

  if (!rawMethod) return null;
  if (rawMethod === 'Online Payment') return 'Online Payment';
  return rawMethod;
}

// Helper function to calculate overdue amount (matches backend logic)
function calculateOverdueAmount(lease, payments, today) {
  if (!lease || !lease.startDate) return 0;

  const leaseStart = moment(lease.startDate);
  const leaseEnd = lease.endDate ? moment(lease.endDate) : null;
  const effectiveEnd = leaseEnd && leaseEnd.isBefore(today) ? leaseEnd : today;

  // Calculate first due date
  const rentDueDay = lease.rentDueDay || 1;
  let firstDueDate = moment(lease.startDate);
  if (leaseStart.date() !== rentDueDay) {
    firstDueDate = moment(lease.startDate).date(rentDueDay);
    if (firstDueDate.isBefore(leaseStart)) {
      firstDueDate = firstDueDate.add(1, 'month');
    }
  }

  // Only calculate if we've reached the first due date
  if (today.isBefore(firstDueDate, 'day')) {
    return 0;
  }

  // Include current month only when today is strictly after the due day (overdue = today > dueDay).
  const includeCurrentMonth = today.date() > rentDueDay;

  // Calculate months elapsed from first due date
  let monthsElapsed =
    (effectiveEnd.year() - firstDueDate.year()) * 12 + (effectiveEnd.month() - firstDueDate.month()) + (includeCurrentMonth ? 1 : 0);

  if (monthsElapsed < 0) monthsElapsed = 0;

  // Expected total rent up to now
  const expectedSoFar = monthsElapsed * (lease.rentAmount || 0);

  // Total payments made for this lease
  const leasePayments = payments
    .filter((p) => isBalanceCreditingPayment(p) && (p.leaseId === lease.id || p.LeaseId === lease.id))
    .reduce((sum, p) => sum + (p.amount || p.Amount || 0), 0);

  // Overdue = expected – paid
  const overdue = Math.max(expectedSoFar - leasePayments, 0);

  return Math.round(overdue * 100) / 100; // Round to 2 decimal places
}

function SavePaymentMethodForm({ onClose, onSaved }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const activeRef = useRef(false);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    setError(null);

    try {
    const { error: submitError } = await elements.submit();
    if (!activeRef.current) return;
    if (submitError) {
      setError(submitError.message || 'Please check your payment method details.');
      setSaving(false);
      return;
    }

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required'
    });

    if (!activeRef.current) return;
    if (result.error) {
      setError(result.error.message || 'We could not save that payment method. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    if (result.setupIntent?.status !== 'succeeded') {
      setError('Your payment method is not ready yet. Complete any required bank verification before using it.');
      onSaved?.();
      return;
    }
    setSaved(true);
    onSaved?.();
    } catch (err) {
      if (activeRef.current) setError(err.message || 'Unable to save your payment method. Please try again.');
    } finally {
      if (activeRef.current) setSaving(false);
    }
  };

  if (saved) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            bgcolor: (t) => alpha(t.palette.success.main, 0.12),
            color: 'success.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <CheckCircleOutlined style={{ fontSize: 42 }} />
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
          Payment method saved
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your payment method has been saved successfully.
        </Typography>
        <DialogActions sx={{ justifyContent: 'center', px: 0 }}>
          <Button variant="outlined" onClick={onClose} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button variant="contained" onClick={onClose} sx={{ textTransform: 'none' }}>
            Done
          </Button>
        </DialogActions>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <DialogContent dividers sx={{ px: { xs: 2.25, sm: 3 }, py: 2.5 }}>
        <Stack spacing={2.25}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
              Payment Method
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
              Want to pay by ACH? Choose{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                US bank account
              </Box>{' '}
              or{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Try paying by bank
              </Box>{' '}
              options below to securely connect a bank account.
            </Typography>
            <PaymentElement />
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.25, sm: 3 }, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={!stripe || saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? 'Saving…' : 'Save payment method'}
        </Button>
      </DialogActions>
    </Box>
  );
}

function TenantPaymentMethodModal({ open, onClose, canInvoke, leaseId }) {
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const prepareSetupIntent = async () => {
      if (!open || !canInvoke || !leaseId) return;
      setLoading(true);
      setError(null);
      setClientSecret('');
      setStripePromise(null);
      setStripeAccountId(null);

      try {
        const [keyResponse, setupResponse] = await Promise.all([
          axiosServices.get('/api/stripe/publishable-key'),
          axiosServices.post(`/api/stripe/create-setup-intent?leaseId=${encodeURIComponent(leaseId)}`)
        ]);

        if (!active) return;
        const data = setupResponse.data?.data;
        if (!setupResponse.data?.success || !data?.clientSecret) throw new Error('Unable to prepare a payment method for this lease.');
        const account = requireRentStripeAccount(data.stripeAccountId);
        setStripePromise(getTenantDashboardStripe(keyResponse.data?.publishableKey, account));
        setStripeAccountId(account);
        setClientSecret(data.clientSecret);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || err.response?.data?.Message || err.message || 'We could not load the payment method form. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    prepareSetupIntent();

    return () => {
      active = false;
    };
  }, [open, canInvoke, leaseId]);

  const handleClose = () => {
    setClientSecret('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <SettingOutlined />
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Edit payment method
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Save a card or bank account for rent payments.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      {loading ? (
        <DialogContent dividers>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      ) : error ? (
        <>
          <DialogContent dividers>
            <Alert severity="error">{error}</Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
              Close
            </Button>
          </DialogActions>
        </>
      ) : canInvoke && leaseId && stripeAccountId && stripePromise && clientSecret ? (
        <>
          <SavedRentPaymentMethods key={JSON.stringify([leaseId, stripeAccountId])} leaseId={leaseId} stripeAccountId={stripeAccountId} refresh={refresh} />
          <Elements key={JSON.stringify([leaseId, stripeAccountId, clientSecret])} stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <SavePaymentMethodForm onClose={handleClose} onSaved={() => setRefresh((value) => value + 1)} />
          </Elements>
        </>
      ) : null}
    </Dialog>
  );
}

function getMakePaymentDisabledReason({ canInvoke, readiness, presentation }, paymentAllocation) {
  if (!canInvoke) {
    if (readiness?.blockers?.includes('connected_payee_missing')) {
      return 'Your landlord hasn’t enabled online payments yet.';
    }
    return presentation.message;
  }
  if (!paymentAllocation) return 'Your rent balance is unavailable right now.';
  return (paymentAllocation.totalAmountDue ?? 0) <= 0 ? 'There’s no rent balance due.' : '';
}

export default function TenantDashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const modal = useModal();
  const firstName = (user?.firstname ?? user?.Firstname ?? user?.firstName ?? '').trim();
  const greeting = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';
  const payReadiness = useRentPaymentActionReadiness('Pay');
  const { canInvoke } = payReadiness;
  const { getSelectedLease, selectedLeaseId, leases: contextLeases, setLeases: setContextLeases, selectLease } = useLease();

  // Track previous lease ID to prevent unnecessary re-fetches
  const prevLeaseIdRef = useRef(null);

  const [lease, setLease] = useState(null);
  const [payments, setPayments] = useState([]);
  const [rentCollection, setRentCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [tenantConversations, setTenantConversations] = useState([]);

  // Fetch tenant conversations so the dashboard can fall back to conversation-level dedicated SMS numbers.
  useEffect(() => {
    if (!(user?.Id || user?.id)) return;

    axiosServices
      .get('/api/Conversation/tenant/my-conversations')
      .then((res) => {
        if (res.data?.success) {
          setTenantConversations(Array.isArray(res.data.data) ? res.data.data : []);
        }
      })
      .catch(() => setTenantConversations([]));
  }, [user]);

  // Check if user was redirected here after account creation
  useEffect(() => {
    const accountAlreadyCreatedMessage = sessionStorage.getItem('accountAlreadyCreatedMessage');
    if (accountAlreadyCreatedMessage === 'true') {
      // Clear the flag
      sessionStorage.removeItem('accountAlreadyCreatedMessage');
      // Show message
      openSnackbar({
        open: true,
        message: 'Your account has already been created. Welcome to your dashboard!',
        variant: 'alert',
        alert: { color: 'success' }
      });
    }
  }, []);

  // Fetch data for selected lease
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        let availableLeases = Array.isArray(contextLeases) ? contextLeases : [];
        let effectiveSelectedLeaseId = selectedLeaseId;

        // The dashboard should not depend on LeaseSelector to hydrate lease context.
        // On a hard refresh, this page can render before leases are loaded and would
        // otherwise show empty lease and payment sections.
        if (!availableLeases.length) {
          try {
            const leasesResponse = await axiosServices.get('/api/lease/tenant/my-leases');
            if (leasesResponse.data?.success && Array.isArray(leasesResponse.data.data)) {
              availableLeases = leasesResponse.data.data;
              setContextLeases(availableLeases);

              if (!effectiveSelectedLeaseId && availableLeases.length) {
                const activeLease = availableLeases.find((item) => item.isActive) || availableLeases[0];
                effectiveSelectedLeaseId = activeLease?.id || null;
                if (effectiveSelectedLeaseId) selectLease(effectiveSelectedLeaseId);
              }
            }
          } catch (leaseErr) {
            if (import.meta.env.DEV) console.warn('Could not fetch tenant leases:', leaseErr);
          }
        }

        const selectedLease =
          (effectiveSelectedLeaseId ? availableLeases.find((item) => Number(item.id) === Number(effectiveSelectedLeaseId)) : null) ||
          getSelectedLease() ||
          availableLeases[0] ||
          null;

        if (!selectedLease) {
          setLease(null);
          setPayments([]);
          setRentCollection(null);
          prevLeaseIdRef.current = null;
          return;
        }

        if (selectedLease.id !== effectiveSelectedLeaseId) {
          selectLease(selectedLease.id);
        }

        // Skip if this is the same lease we already loaded
        if (selectedLease.id === prevLeaseIdRef.current) {
          return;
        }

        prevLeaseIdRef.current = selectedLease.id;
        const leaseData = selectedLease;
        setLease(leaseData);

        // Fetch payments for this lease
        if (leaseData.id) {
          try {
            const paymentsResponse = await axiosServices.get(`/api/payment/${leaseData.id}/tenant-history`);
            if (paymentsResponse.data) {
              // Handle both response formats
              const paymentsData = paymentsResponse.data.data || paymentsResponse.data || [];
              setPayments(Array.isArray(paymentsData) ? paymentsData : []);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.warn('Could not fetch payments:', err);
            setPayments([]);
          }

        }

        // Fetch rent collection data for this lease
        if (leaseData.id) {
          try {
            // For tenants, use the selected lease so multi-lease tenants get the matching AmountDueNow record.
            const rentCollectionResponse = await axiosServices.get('/api/rent-collection/tenant/my-rent', {
              params: { leaseId: leaseData.id }
            });
            if (rentCollectionResponse.data && rentCollectionResponse.data.success) {
              const rentCollectionData = rentCollectionResponse.data.data;
              setRentCollection(rentCollectionData);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.warn('Could not fetch rent collection:', err);
            // Try fallback to main endpoint if tenant endpoint fails
            try {
              const landlordId = leaseData.landlordId || leaseData.unit?.property?.landlordId;
              if (landlordId) {
                const rentCollectionResponse = await axiosServices.get('/api/rent-collection', {
                  params: {
                    landlordId: landlordId,
                    leaseId: leaseData.id,
                    lifetime: false
                  }
                });
                if (rentCollectionResponse.data && rentCollectionResponse.data.success) {
                  const rentCollectionData = rentCollectionResponse.data.data;
                  setRentCollection(rentCollectionData);
                }
              }
            } catch (fallbackErr) {
              if (import.meta.env.DEV) console.warn('Fallback rent collection fetch also failed:', fallbackErr);
              setRentCollection(null);
            }
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching tenant dashboard data:', err);
        setError('Failed to load dashboard information');
      } finally {
        setLoading(false);
      }
    };

    if (user?.Id || user?.id) {
      fetchData();
    }
    // Only depend on selectedLeaseId - getSelectedLease will get the current lease from context
    // We also need to check if leases are loaded, so we use a ref or check leases length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedLeaseId, contextLeases?.length]);

  // Calculate next rent due date and overdue status
  const nextRentDue = useMemo(() => {
    if (!lease) return null;

    const rentDueDay = lease.rentDueDay || 1;
    const today = moment();
    const leaseStartDate = moment(lease.startDate);

    // Use utility function to get base next payment date (handles lease start date)
    const baseNextPaymentDate = calculateNextPaymentDate(lease.startDate, rentDueDay, lease.endDate);
    if (!baseNextPaymentDate) return null;

    let nextDue = moment(baseNextPaymentDate);

    // Check if there's a payment for the current payment period
    // For the first payment (start date), check if payment was made on or after start date
    // For subsequent payments, check if payment was made on or before the due date in that month
    const hasPaymentForPeriod = payments.some((p) => {
      if (!isBalanceCreditingPayment(p)) return false;
      const paymentDate = moment(getPaymentDisplayDate(p));

      // If next due date is the start date (first payment)
      if (nextDue.isSame(leaseStartDate, 'day')) {
        // Check if payment was made on or after the start date
        return paymentDate.isSameOrAfter(leaseStartDate, 'day');
      }

      // For subsequent payments, check if payment was made in the same month and year as the due date
      // and on or before the due date
      return paymentDate.isSame(nextDue, 'year') && paymentDate.isSame(nextDue, 'month') && paymentDate.isSameOrBefore(nextDue, 'day');
    });

    // Determine if the payment is overdue
    // Only mark as overdue if:
    // 1. The lease has started
    // 2. The next payment date has passed
    // 3. No payment has been made for that period
    const isOverdue = today.isAfter(leaseStartDate, 'day') && nextDue.isBefore(today, 'day') && !hasPaymentForPeriod;

    // If the base next payment date has passed and payment was made, calculate the next one
    if (nextDue.isBefore(today, 'day') && hasPaymentForPeriod) {
      // Calculate the next payment date after this one
      // If this was the first payment (start date), next is rent due day of next month
      // Otherwise, it's rent due day of next month
      if (nextDue.isSame(leaseStartDate, 'day')) {
        // First payment was made, next is rent due day of next month
        nextDue = moment().add(1, 'month').date(rentDueDay);
      } else {
        // Subsequent payment was made, move to next month
        nextDue = nextDue.add(1, 'month').date(rentDueDay);
      }

      // Ensure we don't go past lease end date
      if (lease.endDate && nextDue.isAfter(moment(lease.endDate), 'day')) {
        nextDue = moment(lease.endDate);
      }
    }

    // Get rent record to match landlord portal calculation
    let overdueAmount = 0;
    let leaseRecord = null;

    // Handle both camelCase and PascalCase property names
    const rentRecords = rentCollection?.rentRecords || rentCollection?.RentRecords || [];
    if (rentRecords && rentRecords.length > 0) {
      leaseRecord = rentRecords.find((r) => r.leaseId === lease.id || r.LeaseId === lease.id);
      if (leaseRecord) {
        overdueAmount = normalizeRentBalance(leaseRecord).overdueAmount;
      } else {
        overdueAmount = calculateOverdueAmount(lease, payments, today);
      }
    } else {
      overdueAmount = calculateOverdueAmount(lease, payments, today);
    }

    // Keep local schedule arithmetic only when this surface has no collection record.
    const amountDue = leaseRecord
      ? normalizeRentBalance(leaseRecord).rentDue
      : (lease.rentAmount || 0) + overdueAmount;

    return {
      date: nextDue.toDate(),
      amount: amountDue,
      overdueAmount: overdueAmount,
      nextPaymentAmount: lease.rentAmount || 0,
      daysUntil: nextDue.diff(today, 'days'),
      isOverdue: isOverdue || overdueAmount > 0
    };
  }, [lease, payments, rentCollection]);

  // Get recent payments (last 5)
  const recentPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    return [...payments]
      .sort((a, b) => {
        const dateA = new Date(getPaymentDisplayDate(a) || 0);
        const dateB = new Date(getPaymentDisplayDate(b) || 0);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [payments]);

  // The dashboard rent action pays the lease-wide accrued balance, oldest-first.
  // Fees and read-only deposits are shown separately on the Payments page.
  const paymentAllocation = useMemo(() => {
    if (!nextRentDue || !lease) return null;
    const rentAmountDue = nextRentDue.amount ?? 0;
    const totalAmountDue = rentAmountDue;
    return { rentAmountDue, totalAmountDue };
  }, [nextRentDue, lease]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Typography component="h1" variant="h4" fontWeight="bold" gutterBottom>
          {greeting}
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  const propertyDisplay = lease?.unit?.property?.name || lease?.propertyName || lease?.PropertyName || null;
  const unitDisplay = lease?.unit?.name || lease?.unitName || lease?.UnitName;
  const propertyType = (lease?.unit?.property?.propertyType || lease?.propertyType || lease?.PropertyType || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const isSingleFamily = isDetachedSingleUnitType(propertyType);
  const currentLeaseId = lease?.id || lease?.Id || selectedLeaseId;
  const selectedLeaseConversationWithDedicatedNumber = tenantConversations.find((conversation) => {
    const conversationLeaseId = conversation?.leaseId || conversation?.LeaseId;
    const hasDedicatedNumber = conversation?.landlordSmsNumber || conversation?.LandlordSmsNumber;
    return hasDedicatedNumber && currentLeaseId && String(conversationLeaseId) === String(currentLeaseId);
  });
  const conversationWithDedicatedNumber =
    selectedLeaseConversationWithDedicatedNumber ||
    tenantConversations.find((conversation) => conversation?.landlordSmsNumber || conversation?.LandlordSmsNumber);
  const landlordContactNumber =
    lease?.landlordSmsNumber ||
    lease?.LandlordSmsNumber ||
    conversationWithDedicatedNumber?.landlordSmsNumber ||
    conversationWithDedicatedNumber?.LandlordSmsNumber ||
    getLandlordPhoneFromLease(lease);

  return (
    <>
      <Grid container spacing={2.25}>
        {/* Header */}
        <Grid size={12}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
              alignItems: 'center',
              gap: { xs: 1.5, sm: 2 }
            }}
          >
            <Typography
              component="h1"
              variant="h4"
              fontWeight="bold"
              sx={{ gridColumn: 1, gridRow: 1, overflowWrap: 'anywhere' }}
            >
              {greeting}
            </Typography>
            <LeaseSelector
              sx={{
                gridColumn: '1 / -1',
                gridRow: 2,
                justifySelf: 'start',
                width: '100%',
                maxWidth: 270
              }}
            />
            {landlordContactNumber && (
              <Button
                variant="text"
                size="small"
                startIcon={<MobileOutlined />}
                href={`sms:${landlordContactNumber}`}
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  gridColumn: 2,
                  gridRow: 1,
                  justifySelf: 'end',
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  color: 'text.primary',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                }}
              >
                <Stack spacing={0} alignItems="flex-start">
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                    Text your landlord
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                    {formatTenantSmsPhone(landlordContactNumber)}
                  </Typography>
                </Stack>
              </Button>
            )}
          </Box>
        </Grid>
        <Divider width="100%" sx={{ mt: -0.25, mb: 0.25 }} />

        <Grid size={{ xs: 12, md: 4 }}>
          <MainCard
            title="Rent Status"
            sx={{
              bgcolor: 'background.paper',
              border: (t) => `1px solid ${t.palette.divider}`,
              boxShadow: 'none',
              height: '100%'
            }}
          >
            {!lease ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <HomeOutlined style={{ fontSize: 48, color: theme.palette.text.secondary, marginBottom: 16, opacity: 0.5 }} />
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  No Lease Set Up
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your landlord has not set up the lease yet. Your rent information will appear here once your landlord creates and assigns
                  a lease to your account.
                </Typography>
              </Box>
            ) : nextRentDue ? (
              <Stack spacing={2.5}>
                {(() => {
                  const isDark = theme.palette.mode === 'dark';
                  const totalAmountDue = paymentAllocation?.totalAmountDue ?? 0;
                  const paymentDisabledReason = getMakePaymentDisabledReason(payReadiness, paymentAllocation);
                  const isOverdue = nextRentDue.isOverdue || nextRentDue.daysUntil < 0;
                  const statusTone = isOverdue ? theme.palette.error : theme.palette.primary;
                  const sectionDivider = theme.palette.divider;
                  const mutedPanelBg = theme.palette.action.hover;
                  const iconBoxSx = {
                    width: 40,
                    height: 40,
                    color: statusTone.main,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  };

                  return (
                    <Box
                      sx={{
                        overflow: 'hidden',
                        borderRadius: 2.5,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'background.paper',
                        boxShadow: 'none'
                      }}
                    >
                      <Box sx={{ p: { xs: 2, sm: 2.25 } }}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row', md: 'column', xl: 'row' }}
                          spacing={2}
                          alignItems={{ xs: 'stretch', sm: 'center', md: 'stretch', xl: 'center' }}
                          justifyContent="space-between"
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={iconBoxSx}>
                              <CalendarOutlined style={{ fontSize: 19 }} />
                            </Box>
                            <Box>
                              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, letterSpacing: 0.8 }}>
                                Next due date
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                                <Typography variant="h6" fontWeight={700} color="text.primary">
                                  {formatDate(nextRentDue.date)}
                                </Typography>
                                {isOverdue && <Chip label="Overdue" size="small" color="error" sx={{ height: 22, fontWeight: 700 }} />}
                              </Stack>
                            </Box>
                          </Stack>

                          <Box sx={{ textAlign: { xs: 'left', sm: 'right', md: 'left', xl: 'right' } }}>
                            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, letterSpacing: 0.8 }}>
                              Accumulated rent balance
                            </Typography>
                            <Typography variant="h4" fontWeight={800} color={isOverdue ? 'error.main' : totalAmountDue > 0 ? 'primary.main' : 'text.primary'}>
                              {formatCurrency(totalAmountDue)}
                            </Typography>
                            {nextRentDue.daysUntil < 0 && (
                              <Typography variant="caption" color="error.main" fontWeight={700}>
                                {Math.abs(nextRentDue.daysUntil)} day{Math.abs(nextRentDue.daysUntil) !== 1 ? 's' : ''} overdue
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </Box>

                      {paymentAllocation && (
                        <Box
                          sx={{
                            px: { xs: 2, sm: 2.25 },
                            py: 1,
                            bgcolor: mutedPanelBg,
                            borderTop: `1px solid ${sectionDivider}`,
                            borderBottom: `1px solid ${sectionDivider}`
                          }}
                        >
                          <Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
                              Rent checkout applies oldest-first across the lease. Fees and read-only deposits are listed separately on the Payments page.
                            </Typography>
                          </Stack>
                        </Box>
                      )}

                      <Box sx={{ p: { xs: 2, sm: 2.25 } }}>
                        <Grid container spacing={1.25}>
                          <Grid size={{ xs: 12, sm: 6, md: 12, xl: 6 }}>
                            <Tooltip title={paymentDisabledReason} describeChild>
                              <Box
                                component="span"
                                sx={{ display: 'block' }}
                                tabIndex={paymentDisabledReason ? 0 : undefined}
                                aria-label={paymentDisabledReason ? 'Make Payment' : undefined}
                              >
                                <Button
                                  variant="contained"
                                  fullWidth
                                  startIcon={<DollarOutlined />}
                                  color="primary"
                                  disabled={!canInvoke || !paymentAllocation || totalAmountDue <= 0}
                                  onClick={() => {
                                    if (paymentAllocation) {
                                      modal.openPaymentModal({
                                        leaseId: lease.id,
                                        rentAmount: lease.rentAmount || 0,
                                        rentDue: paymentAllocation.rentAmountDue,
                                        amountDueNow: paymentAllocation.rentAmountDue,
                                        overdueAmount: nextRentDue.overdueAmount,
                                        propertyName: propertyDisplay || lease?.propertyName || '',
                                        unitName: unitDisplay || lease?.unitName || ''
                                      });
                                    }
                                  }}
                                  sx={{
                                    minHeight: 44,
                                    py: 1.05,
                                    px: 2,
                                    borderRadius: 1.75,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    bgcolor: theme.palette.primary.main,
                                    boxShadow: `0 10px 22px ${alpha(theme.palette.primary.main, isDark ? 0.2 : 0.14)}`,
                                    '&:hover': {
                                      bgcolor: isDark ? theme.palette.primary.light : theme.palette.primary.main,
                                      boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, isDark ? 0.24 : 0.18)}`
                                    }
                                  }}
                                >
                                  Make Payment
                                </Button>
                              </Box>
                            </Tooltip>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 12, xl: 6 }}>
                            <Button
                              variant="outlined"
                              fullWidth
                              startIcon={<SettingOutlined />}
                              disabled={!canInvoke}
                              onClick={() => setPaymentMethodModalOpen(true)}
                              sx={{
                                minHeight: 44,
                                py: 1.05,
                                px: 2,
                                borderRadius: 1.75,
                                textTransform: 'none',
                                fontWeight: 800,
                                color: isDark ? theme.palette.common.white : theme.palette.text.primary,
                                bgcolor: isDark ? alpha(theme.palette.common.white, 0.08) : theme.palette.common.white,
                                borderColor: isDark ? alpha(theme.palette.common.white, 0.22) : alpha(theme.palette.common.black, 0.12),
                                boxShadow: `0 10px 22px ${alpha(theme.palette.common.black, isDark ? 0.16 : 0.07)}`,
                                '&:hover': {
                                  bgcolor: isDark ? alpha(theme.palette.common.white, 0.13) : alpha(theme.palette.common.white, 0.92),
                                  borderColor: isDark ? alpha(theme.palette.common.white, 0.32) : alpha(theme.palette.common.black, 0.18)
                                }
                              }}
                            >
                              Edit payment method
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                    </Box>
                  );
                })()}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No upcoming payments
              </Typography>
            )}
          </MainCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <MainCard
            title="Lease Summary"
            sx={{
              bgcolor: 'background.paper',
              border: (t) => `1px solid ${t.palette.divider}`,
              boxShadow: 'none',
              height: '100%'
            }}
            secondary={
              lease && (
                <Button size="small" startIcon={<EyeOutlined />} onClick={() => navigate('/tenant/lease')}>
                  View Details
                </Button>
              )
            }
          >
            {!lease ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <FileTextOutlined style={{ fontSize: 48, color: theme.palette.text.secondary, marginBottom: 16, opacity: 0.5 }} />
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  No Lease Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your lease details will appear here once your landlord creates and assigns a lease to your account. If you believe this is
                  an error, please contact your landlord.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <HomeOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                    <Typography variant="body2" color="text.secondary">
                      Property
                    </Typography>
                  </Stack>
                  <Typography variant="body1" fontWeight={600}>
                    {propertyDisplay}
                  </Typography>
                  {unitDisplay && !isSingleFamily && (
                    <Typography variant="body2" color="text.secondary">
                      Unit: {unitDisplay}
                    </Typography>
                  )}
                </Box>
                <Divider />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <CalendarOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                    <Typography variant="body2" color="text.secondary">
                      Lease Period
                    </Typography>
                  </Stack>
                  <Typography variant="body1">
                    {formatDate(lease.startDate)} - {formatDate(lease.endDate)}
                  </Typography>
                </Box>
                <Divider />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <DollarOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                    <Typography variant="body2" color="text.secondary">
                      Monthly Rent
                    </Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(lease.rentAmount || 0)}
                  </Typography>
                </Box>
              </Stack>
            )}
          </MainCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Announcements />
        </Grid>

        {/* Recent Payments */}
        <Grid size={12}>
          <MainCard
            title="Recent Payments"
            sx={{
              bgcolor: 'background.paper',
              border: (t) => `1px solid ${t.palette.divider}`,
              boxShadow: 'none',
              height: '100%'
            }}
            secondary={
              lease && (
                <Link component="button" variant="body2" onClick={() => navigate('/tenant/payments')} sx={{ cursor: 'pointer' }}>
                  View all
                </Link>
              )
            }
          >
            {!lease ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <DollarOutlined style={{ fontSize: 48, color: theme.palette.text.secondary, marginBottom: 16, opacity: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  No payments available. Your payment history will appear here once your landlord sets up your lease.
                </Typography>
              </Box>
            ) : recentPayments.length > 0 ? (
              <Stack spacing={2}>
                {recentPayments.map((payment, index) => {
                  const statusMeta = getPaymentStatusMeta(payment);
                  const statusIconColor = theme.palette[statusMeta.accent]?.main ?? theme.palette.text.secondary;
                  const displayDate = getPaymentDisplayDate(payment);
                  const method = getPaymentMethodLabel(payment);

                  return (
                    <Paper
                      key={payment.id || payment.Id || `payment-${index}`}
                      variant="outlined"
                      sx={{
                        p: 1.75,
                        borderRadius: 1.75,
                        bgcolor: 'background.paper',
                        border: (t) => `1px solid ${t.palette.divider}`,
                        boxShadow: 'none'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {statusMeta.icon && <Box sx={{ color: statusIconColor, lineHeight: 0 }}>{statusMeta.icon}</Box>}
                            <Typography variant="body1" fontWeight={600}>
                              {formatCurrency(payment.amount || payment.Amount || 0)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {statusMeta.datePrefix} {displayDate ? formatDate(displayDate) : '—'}
                            {method ? ` · ${method}` : ''}
                          </Typography>
                        </Box>
                        <Chip
                          label={statusMeta.label}
                          size="small"
                          sx={(t) => ({
                            flexShrink: 0,
                            ...getStatusPillSx(t, statusMeta.color)
                          })}
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No payments found
                </Typography>
              </Box>
            )}
          </MainCard>
        </Grid>
      </Grid>

      {/* Payment Method Modal */}
      {canInvoke && paymentMethodModalOpen && (
        <TenantPaymentMethodModal
          key={selectedLeaseId}
          leaseId={selectedLeaseId}
          open={paymentMethodModalOpen}
          onClose={() => setPaymentMethodModalOpen(false)}
          canInvoke={canInvoke}
        />
      )}

      {/* Payment Modal */}
      {canInvoke && lease && (
        <PaymentModal
          open={modal.openPayment}
          rent={modal.selectedRent}
          onClose={modal.closePaymentModal}
          presentation="drawer"
          defaultAmount={nextRentDue?.amount || lease.rentAmount || 0}
          onSuccess={() => {
            // Refetch the current lease payment surfaces immediately after Stripe submission.
            // ACH/card records are created as Processing first, then finalized by webhook.
            const fetchData = async () => {
              try {
                if (!lease?.id) return;

                const paymentsResponse = await axiosServices.get(`/api/payment/${lease.id}/tenant-history`);
                if (paymentsResponse.data) {
                  const paymentsData = paymentsResponse.data.data || paymentsResponse.data || [];
                  setPayments(Array.isArray(paymentsData) ? paymentsData : []);
                }

                try {
                  const rentCollectionResponse = await axiosServices.get('/api/rent-collection/tenant/my-rent', {
                    params: { leaseId: lease.id }
                  });
                  if (rentCollectionResponse.data && rentCollectionResponse.data.success) {
                    setRentCollection(rentCollectionResponse.data.data);
                  }
                } catch (err) {
                  if (import.meta.env.DEV) console.warn('Could not refetch tenant rent collection:', err);
                }
              } catch (err) {
                if (import.meta.env.DEV) console.error('Error refetching data after payment:', err);
              }
            };
            fetchData();
          }}
        />
      )}
    </>
  );
}
