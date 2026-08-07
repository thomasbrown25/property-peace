import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MaintenanceAgentDrawer from './MaintenanceAgentDrawer';
import TenantMaintenanceFormDrawer from 'components/drawers/TenantMaintenanceFormDrawer';

// material-ui
import {
  Divider,
  Grid,
  Box,
  Typography,
  Stack,
  Paper,
  Button,
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
  PlusOutlined,
  EyeOutlined,
  ToolOutlined,
  FileTextOutlined,
  WarningOutlined,
  SettingOutlined,
  MobileOutlined
} from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate, formatRelativeTime } from 'utils/formatters';
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
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

// ==============================|| TENANT - DASHBOARD ||============================== //

const BALANCE_CREDITING_STATUSES = new Set(['completed', 'paid']);

let tenantDashboardStripePromise;
const getTenantDashboardStripe = async () => {
  if (!tenantDashboardStripePromise) {
    const response = await axiosServices.get('/api/stripe/publishable-key');
    tenantDashboardStripePromise = loadStripe(response.data.publishableKey);
  }
  return tenantDashboardStripePromise;
};

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
  return (payment?.status || payment?.Status || 'Completed').toString();
}

function isBalanceCreditingPayment(payment) {
  return BALANCE_CREDITING_STATUSES.has(getPaymentStatus(payment).toLowerCase());
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
        iconColor: '#52c41a',
        accent: 'success',
        datePrefix: 'Paid on'
      };
    case 'processing':
      return {
        label: 'Processing',
        color: 'info',
        icon: <ClockCircleOutlined />,
        iconColor: '#1677ff',
        accent: 'info',
        datePrefix: 'Submitted on'
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'error',
        icon: <CloseCircleOutlined />,
        iconColor: '#ff4d4f',
        accent: 'error',
        datePrefix: 'Failed on'
      };
    case 'canceled':
    case 'cancelled':
      return {
        label: 'Canceled',
        color: 'default',
        icon: <CloseCircleOutlined />,
        iconColor: '#8c8c8c',
        accent: 'default',
        datePrefix: 'Canceled on'
      };
    case 'disputed':
      return {
        label: 'Disputed',
        color: 'error',
        icon: <WarningOutlined />,
        iconColor: '#faad14',
        accent: 'warning',
        datePrefix: 'Disputed on'
      };
    default:
      return {
        label: getPaymentStatus(payment),
        color: 'default',
        icon: null,
        iconColor: '#8c8c8c',
        accent: 'default',
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

function getPaymentStatusPalette(theme, accent) {
  const isDark = theme.palette.mode === 'dark';
  switch (accent) {
    case 'success':
      return {
        main: theme.palette.success.main,
        bg: alpha(theme.palette.success.main, isDark ? 0.12 : 0.055),
        border: alpha(theme.palette.success.main, isDark ? 0.28 : 0.18)
      };
    case 'info':
      return {
        main: theme.palette.info.main,
        bg: alpha(theme.palette.info.main, isDark ? 0.13 : 0.06),
        border: alpha(theme.palette.info.main, isDark ? 0.28 : 0.18)
      };
    case 'error':
      return {
        main: theme.palette.error.main,
        bg: alpha(theme.palette.error.main, isDark ? 0.12 : 0.055),
        border: alpha(theme.palette.error.main, isDark ? 0.28 : 0.18)
      };
    case 'warning':
      return {
        main: theme.palette.warning.main,
        bg: alpha(theme.palette.warning.main, isDark ? 0.13 : 0.06),
        border: alpha(theme.palette.warning.main, isDark ? 0.28 : 0.18)
      };
    default:
      return {
        main: theme.palette.text.secondary,
        bg: alpha(theme.palette.action.hover, 0.45),
        border: alpha(theme.palette.divider, 0.28)
      };
  }
}

function formatStatusLabel(status) {
  if (!status) return 'Open';
  return status
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function getMaintenanceStatusChipSx(status) {
  const normalizedStatus = (status || 'open')
    .toString()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  return (theme) => {
    const isDark = theme.palette.mode === 'dark';
    const softChip = (color, bgOpacity = 0.08, borderOpacity = 0.22) => ({
      color,
      bgcolor: alpha(color, isDark ? Math.max(bgOpacity, 0.14) : bgOpacity),
      borderColor: alpha(color, isDark ? Math.max(borderOpacity, 0.34) : borderOpacity),
      '& .MuiChip-label': { px: 1.1 }
    });

    if (normalizedStatus === 'reported' || normalizedStatus === 'open' || normalizedStatus === 'new') {
      return softChip(theme.palette.info.main, 0.075, 0.22);
    }

    if (normalizedStatus === 'acknowledged' || normalizedStatus === 'assigned') {
      return softChip(theme.palette.primary.main, 0.07, 0.2);
    }

    if (normalizedStatus === 'scheduled' || normalizedStatus === 'inprogress' || normalizedStatus === 'pending') {
      return softChip(theme.palette.warning.main, 0.095, 0.28);
    }

    if (normalizedStatus === 'resolved' || normalizedStatus === 'completed' || normalizedStatus === 'complete') {
      return softChip(theme.palette.success.main, 0.075, 0.22);
    }

    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'closed') {
      return softChip(theme.palette.text.secondary, 0.06, 0.2);
    }

    return softChip(theme.palette.text.secondary, 0.06, 0.2);
  };
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Please check your payment method details.');
      setSaving(false);
      return;
    }

    const result = await stripe.confirmSetup({
      elements,
      redirect: 'if_required'
    });

    if (result.error) {
      setError(result.error.message || 'We could not save that payment method. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    onSaved?.();
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

function TenantPaymentMethodModal({ open, onClose, canInvoke }) {
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const prepareSetupIntent = async () => {
      if (!open || !canInvoke) return;
      setLoading(true);
      setError(null);
      setClientSecret('');

      try {
        const [stripeInstance, setupResponse] = await Promise.all([
          getTenantDashboardStripe(),
          axiosServices.post('/api/stripe/create-setup-intent')
        ]);

        if (!active) return;
        setStripePromise(stripeInstance);
        setClientSecret(setupResponse.data?.data?.clientSecret || setupResponse.data?.clientSecret || '');
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || err.response?.data?.Message || 'We could not load the payment method form. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    prepareSetupIntent();

    return () => {
      active = false;
    };
  }, [open, canInvoke]);

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
      ) : stripePromise && clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <SavePaymentMethodForm onClose={handleClose} />
        </Elements>
      ) : null}
    </Dialog>
  );
}

export default function TenantDashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const modal = useModal();
  const { presentation: rentReadiness, canInvoke } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);
  const { getSelectedLease, selectedLeaseId, leases: contextLeases, setLeases: setContextLeases, selectLease } = useLease();

  // Track previous lease ID to prevent unnecessary re-fetches
  const prevLeaseIdRef = useRef(null);

  const [lease, setLease] = useState(null);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [rentCollection, setRentCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [maintenanceDrawerOpen, setMaintenanceDrawerOpen] = useState(false);
  const [maintenanceAgentEnabled, setMaintenanceAgentEnabled] = useState(true);
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

  // Fetch maintenance agent settings
  useEffect(() => {
    axiosServices
      .get('/api/maintenance-agent/settings')
      .then((res) => {
        if (res.data?.success) {
          setMaintenanceAgentEnabled(res.data.data?.isMaintenanceAgentEnabled ?? true);
        }
      })
      .catch(() => {});
  }, []);

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
        // otherwise show empty lease, maintenance, and payment sections.
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
          setDeposits([]);
          setMaintenanceRequests([]);
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
            const paymentsResponse = await axiosServices.get(`/api/payment/${leaseData.id}`);
            if (paymentsResponse.data) {
              // Handle both response formats
              const paymentsData = paymentsResponse.data.data || paymentsResponse.data || [];
              setPayments(Array.isArray(paymentsData) ? paymentsData : []);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.warn('Could not fetch payments:', err);
            setPayments([]);
          }

          // Fetch deposits for this lease
          try {
            setLoadingDeposits(true);
            const depositsResponse = await axiosServices.get(`/api/deposit/lease/${leaseData.id}`);
            if (depositsResponse.data && depositsResponse.data.success) {
              setDeposits(depositsResponse.data.data || []);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.warn('Could not fetch deposits:', err);
            setDeposits([]);
          } finally {
            setLoadingDeposits(false);
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

        // Fetch maintenance requests (try tenant-specific endpoint or use dummy data)
        try {
          // Try to fetch maintenance requests - this might need a tenant-specific endpoint
          const maintenanceResponse = await axiosServices.get('/api/maintenance-request/tenant/current');
          if (maintenanceResponse.data && maintenanceResponse.data.success) {
            setMaintenanceRequests(maintenanceResponse.data.data || []);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Could not fetch maintenance requests:', err);
          setMaintenanceRequests([]);
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
    let rentAmount = lease.rentAmount || 0;
    let leaseRecord = null;

    // Handle both camelCase and PascalCase property names
    const rentRecords = rentCollection?.rentRecords || rentCollection?.RentRecords || [];
    if (rentRecords && rentRecords.length > 0) {
      leaseRecord = rentRecords.find((r) => r.leaseId === lease.id || r.LeaseId === lease.id);
      if (leaseRecord) {
        overdueAmount = leaseRecord.overdueAmount || leaseRecord.OverdueAmount || 0;
        rentAmount = leaseRecord.rentAmount || leaseRecord.RentAmount || lease.rentAmount || 0;
      } else {
        overdueAmount = calculateOverdueAmount(lease, payments, today);
      }
    } else {
      overdueAmount = calculateOverdueAmount(lease, payments, today);
    }

    // Amount due: use AmountDueNow (15-day charge window + overdue) when present; else rent + overdue.
    const amountDueNow = leaseRecord?.amountDueNow ?? leaseRecord?.AmountDueNow;
    const amountDue = amountDueNow != null ? amountDueNow : rentAmount + overdueAmount;

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

  // Get open maintenance requests
  const openMaintenanceRequests = useMemo(() => {
    return maintenanceRequests.filter((req) => req.status?.toLowerCase() !== 'completed' && req.status?.toLowerCase() !== 'cancelled');
  }, [maintenanceRequests]);

  // Calculate if deposit is paid
  const depositPaid = useMemo(() => {
    if (!lease?.depositAmount || lease.depositAmount <= 0) return null;
    if (loadingDeposits) return null; // Return null while loading
    if (!deposits || deposits.length === 0) return false;
    return deposits.some((d) => d.receivedDate && !d.refundedDate);
  }, [deposits, lease?.depositAmount, loadingDeposits]);

  // Payment allocation data for Make Payment modal (rent, fees by due date, deposit)
  const paymentAllocation = useMemo(() => {
    if (!nextRentDue || !lease) return null;
    const rentAmountDue = nextRentDue.amount ?? 0;
    const depositAmount = (lease?.depositAmount || 0) > 0 && !depositPaid ? lease.depositAmount || 0 : 0;
    const fees = lease?.fees || lease?.Fees || [];
    const feesWithRemaining = fees
      .map((fee) => {
        const feeId = fee.id || fee.Id;
        const originalAmount = fee.amount || fee.Amount || 0;
        const feePayments = (payments || []).filter(
          (p) => (p.feeId === feeId || p.FeeId === feeId) && (p.status === 'Completed' || p.Status === 'Completed' || !p.status)
        );
        const paidAmount = feePayments.reduce((s, p) => s + (p.amount || p.Amount || 0), 0);
        const remaining = Math.max(0, originalAmount - paidAmount);
        return { fee, feeName: fee.name || fee.Name || 'Fee', feeDueDate: fee.dueDate || fee.DueDate, remaining };
      })
      .filter(({ remaining }) => remaining > 0)
      .sort((a, b) => {
        const dA = a.feeDueDate ? new Date(a.feeDueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const dB = b.feeDueDate ? new Date(b.feeDueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return dA - dB;
      });
    const totalFeesRemaining = feesWithRemaining.reduce((sum, { remaining }) => sum + remaining, 0);
    const totalAmountDue = rentAmountDue + depositAmount + totalFeesRemaining;
    const allocationOrder = [
      { type: 'rent', label: 'Rent amount due', amount: rentAmountDue, dueDate: nextRentDue.date },
      ...feesWithRemaining.map(({ fee, feeName, feeDueDate, remaining }) => ({
        type: 'fee',
        label: feeName,
        amount: remaining,
        feeId: fee.id || fee.Id,
        dueDate: feeDueDate
      })),
      ...(depositAmount > 0 ? [{ type: 'deposit', label: 'Deposit amount', amount: depositAmount, dueDate: lease.startDate }] : [])
    ];
    return { rentAmountDue, feesWithRemaining, depositAmount, totalAmountDue, allocationOrder };
  }, [nextRentDue, lease, depositPaid, payments]);

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
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Tenant Dashboard
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
  const isSingleFamily = propertyType === 'singlefamily' || propertyType === 'singleunit';
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight="bold">
                Tenant Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Welcome back, {user?.firstname}!
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
              {landlordContactNumber && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<MobileOutlined />}
                  href={`sms:${landlordContactNumber}`}
                  sx={{
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
              <LeaseSelector />
            </Stack>
          </Box>
        </Grid>
        <Divider width="100%" sx={{ mt: -0.25, mb: 0.25 }} />

        <Grid size={12}>
          <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection" />
        </Grid>

        {/* Announcements */}
        <Grid size={{ xs: 12 }}>
          <Announcements />
        </Grid>

        {/* Row 1: Rent Status & Lease Summary */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard
            title="Rent Status"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
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
                  const isOverdue = nextRentDue.isOverdue || nextRentDue.daysUntil < 0;
                  const statusTone = isOverdue ? theme.palette.error : totalAmountDue > 0 ? theme.palette.primary : theme.palette.success;
                  const sectionDivider = alpha(isDark ? theme.palette.common.white : theme.palette.common.black, isDark ? 0.1 : 0.08);
                  const mutedPanelBg = alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04);
                  const iconBoxSx = {
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: alpha(statusTone.main, isDark ? 0.18 : 0.1),
                    color: statusTone.main,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `inset 0 0 0 1px ${alpha(statusTone.main, isDark ? 0.24 : 0.14)}`,
                    flexShrink: 0
                  };
                  const amountRowSx = {
                    py: 1.15,
                    borderBottom: `1px solid ${sectionDivider}`,
                    '&:last-of-type': { borderBottom: 0 }
                  };

                  return (
                    <Box
                      sx={{
                        overflow: 'hidden',
                        borderRadius: 2.5,
                        border: `1px solid ${alpha(statusTone.main, isDark ? 0.28 : 0.18)}`,
                        bgcolor: isDark ? alpha(theme.palette.background.paper, 0.26) : alpha(theme.palette.background.paper, 0.72),
                        backgroundImage: isDark
                          ? `linear-gradient(135deg, ${alpha(statusTone.main, 0.16)} 0%, ${alpha(theme.palette.background.paper, 0.18)} 42%, ${alpha(theme.palette.background.default, 0.12)} 100%)`
                          : `linear-gradient(135deg, ${alpha(statusTone.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 48%, ${alpha(theme.palette.primary.light, 0.08)} 100%)`,
                        boxShadow: isDark
                          ? `0 18px 40px ${alpha(theme.palette.common.black, 0.24)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.06)}`
                          : `0 16px 34px ${alpha(theme.palette.primary.main, 0.1)}`
                      }}
                    >
                      <Box sx={{ p: { xs: 2, sm: 2.25 } }}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={2}
                          alignItems={{ xs: 'stretch', sm: 'center' }}
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

                          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, letterSpacing: 0.8 }}>
                              Amount due
                            </Typography>
                            <Typography variant="h4" fontWeight={800} color={totalAmountDue > 0 ? statusTone.main : 'success.main'}>
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
                            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={amountRowSx}>
                              <Typography variant="body2" color="text.secondary">
                                Rent for {formatDate(nextRentDue.date)}
                              </Typography>
                              <Typography variant="body1" fontWeight={700} color="text.primary">
                                {formatCurrency(paymentAllocation.rentAmountDue)}
                              </Typography>
                            </Stack>
                            {paymentAllocation.feesWithRemaining.map(({ fee, feeName, feeDueDate, remaining }, idx) => (
                              <Stack
                                key={fee.id || fee.Id || idx}
                                direction="row"
                                spacing={1.5}
                                alignItems="center"
                                justifyContent="space-between"
                                sx={amountRowSx}
                              >
                                <Typography variant="body2" color="text.secondary">
                                  {feeName} due{feeDueDate ? ` ${formatDate(feeDueDate)}` : ''}
                                </Typography>
                                <Typography variant="body1" fontWeight={700} color="text.primary">
                                  {formatCurrency(remaining)}
                                </Typography>
                              </Stack>
                            ))}
                            {paymentAllocation.depositAmount > 0 && (
                              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={amountRowSx}>
                                <Typography variant="body2" color="text.secondary">
                                  Deposit due {formatDate(lease.startDate)}
                                </Typography>
                                <Typography variant="body1" fontWeight={700} color="text.primary">
                                  {formatCurrency(paymentAllocation.depositAmount)}
                                </Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      )}

                      <Box sx={{ p: { xs: 2, sm: 2.25 } }}>
                        <Grid container spacing={1.25}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Button
                              variant="contained"
                              fullWidth
                              startIcon={<DollarOutlined />}
                              color="success"
                              disabled={!canInvoke || !paymentAllocation || totalAmountDue <= 0}
                              onClick={() => {
                                if (paymentAllocation) {
                                  modal.openPaymentModal({
                                    isTotalPayment: true,
                                    leaseId: lease.id,
                                    totalAmountDue: paymentAllocation.totalAmountDue,
                                    allocationOrder: paymentAllocation.allocationOrder,
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
                                bgcolor: isDark ? theme.palette.success.main : theme.palette.success.dark,
                                boxShadow: `0 10px 22px ${alpha(theme.palette.success.main, isDark ? 0.2 : 0.14)}`,
                                '&:hover': {
                                  bgcolor: isDark ? theme.palette.success.light : theme.palette.success.main,
                                  boxShadow: `0 12px 24px ${alpha(theme.palette.success.main, isDark ? 0.24 : 0.18)}`
                                }
                              }}
                            >
                              Make Payment
                            </Button>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
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
                                whiteSpace: 'nowrap',
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

        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard
            title="Lease Summary"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
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
                    <HomeOutlined style={{ fontSize: 18, color: '#1877F2' }} />
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
                    <CalendarOutlined style={{ fontSize: 18, color: '#1877F2' }} />
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
                    <DollarOutlined style={{ fontSize: 18, color: '#1877F2' }} />
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

        {/* Row 2: Recent Payments & Maintenance Requests */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <MainCard
            title="Recent Payments"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
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
                  const statusPalette = getPaymentStatusPalette(theme, statusMeta.accent);
                  const displayDate = getPaymentDisplayDate(payment);
                  const method = getPaymentMethodLabel(payment);

                  return (
                    <Paper
                      key={payment.id || payment.Id || `payment-${index}`}
                      variant="outlined"
                      sx={{
                        p: 1.75,
                        borderRadius: 1.75,
                        bgcolor: statusPalette.bg,
                        border: `1px solid ${statusPalette.border}`,
                        boxShadow: (t) => `0 8px 18px ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.12 : 0.035)}`
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {statusMeta.icon && <Box sx={{ color: statusPalette.main, lineHeight: 0 }}>{statusMeta.icon}</Box>}
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
                          color={statusMeta.color}
                          size="small"
                          icon={statusMeta.icon}
                          sx={{ flexShrink: 0, height: 24, fontWeight: 700 }}
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

        <Grid size={{ xs: 12, lg: 6 }}>
          <MainCard
            title="Maintenance Requests"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
              height: '100%'
            }}
            secondary={
              <Button size="small" startIcon={<PlusOutlined />} onClick={() => setMaintenanceDrawerOpen(true)}>
                New Request
              </Button>
            }
          >
            {openMaintenanceRequests.length > 0 ? (
              <Stack spacing={2}>
                {openMaintenanceRequests.slice(0, 3).map((request) => (
                  <Paper
                    key={request.id}
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      borderRadius: 1.75,
                      borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.18 : 0.55),
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                        borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
                        transform: 'translateY(-1px)'
                      }
                    }}
                    onClick={() => navigate(`/tenant/maintenance/${request.id}`)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" fontWeight={600}>
                          {request.title || 'Maintenance Request'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {request.description || 'No description'}
                        </Typography>
                        {request.createdAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                            {formatRelativeTime(request.createdAt)}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={formatStatusLabel(request.status)}
                        size="small"
                        variant="outlined"
                        sx={(theme) => ({
                          height: 24,
                          fontWeight: 700,
                          ...getMaintenanceStatusChipSx(request.status)(theme)
                        })}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <ToolOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 8 }} />
                <Typography variant="body2" color="text.secondary">
                  No open maintenance requests
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlusOutlined />}
                  onClick={() => setMaintenanceDrawerOpen(true)}
                  sx={{ mt: 2 }}
                >
                  Submit Request
                </Button>
              </Box>
            )}
          </MainCard>
        </Grid>
      </Grid>

      {/* Maintenance Drawer */}
      {maintenanceAgentEnabled ? (
        <MaintenanceAgentDrawer
          open={maintenanceDrawerOpen}
          onClose={() => setMaintenanceDrawerOpen(false)}
          onRequestCreated={() => {
            setMaintenanceDrawerOpen(false);
            axiosServices
              .get('/api/maintenance-request/tenant/current')
              .then((res) => {
                if (res.data?.success) setMaintenanceRequests(res.data.data || []);
              })
              .catch(() => {});
          }}
        />
      ) : (
        <TenantMaintenanceFormDrawer
          open={maintenanceDrawerOpen}
          onClose={() => setMaintenanceDrawerOpen(false)}
          unitId={lease?.unitId ?? null}
          onRequestCreated={() => {
            setMaintenanceDrawerOpen(false);
            axiosServices
              .get('/api/maintenance-request/tenant/current')
              .then((res) => {
                if (res.data?.success) setMaintenanceRequests(res.data.data || []);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* Payment Method Modal */}
      {canInvoke && paymentMethodModalOpen && (
        <TenantPaymentMethodModal
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

                const paymentsResponse = await axiosServices.get(`/api/payment/${lease.id}`);
                if (paymentsResponse.data) {
                  const paymentsData = paymentsResponse.data.data || paymentsResponse.data || [];
                  setPayments(Array.isArray(paymentsData) ? paymentsData : []);
                }

                try {
                  setLoadingDeposits(true);
                  const depositsResponse = await axiosServices.get(`/api/deposit/lease/${lease.id}`);
                  if (depositsResponse.data && depositsResponse.data.success) {
                    setDeposits(depositsResponse.data.data || []);
                  }
                } catch (err) {
                  if (import.meta.env.DEV) console.warn('Could not refetch deposits:', err);
                } finally {
                  setLoadingDeposits(false);
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
