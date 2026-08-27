import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Grid,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  alpha,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Divider
} from '@mui/material';
import {
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  EditOutlined,
  MessageOutlined,
  CalendarOutlined,
  SendOutlined,
  ReloadOutlined,
  DollarOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useDrawer } from 'contexts/DrawerContext';
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import axiosServices from 'utils/axios';
import { formatDate, formatDateAndTime, formatPhoneInput } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import { tenantInviteAPI } from 'api';
import { removeTenantFromLease } from 'api/lease';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { getConversations } from 'store/conversation/conversation.action';
import { selectConversations } from 'store/conversation/conversation.selector';
import { getMessages } from 'store/message/message.action';
import { selectMessages } from 'store/message/message.selector';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchProperties from 'hooks/useFetchProperties';

export default function TenantPage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const conversations = useSelector(selectConversations);
  const messages = useSelector(selectMessages);
  const { properties, propertiesRefetch } = useFetchProperties();

  const [tenant, setTenant] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [tenantLeases, setTenantLeases] = useState([]);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [tenantInvites, setTenantInvites] = useState({});
  const [sendingInvite, setSendingInvite] = useState(false);
  const [removeFromLeaseConfirm, setRemoveFromLeaseConfirm] = useState(null);
  const [removingFromLease, setRemovingFromLease] = useState(false);
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [paymentHistoryError, setPaymentHistoryError] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'rent'

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const tenantResponse = await axiosServices.get(`/api/tenant/${tenantId}`);
      if (tenantResponse.data && tenantResponse.data.success) {
        const tenantData = tenantResponse.data.data;
        setTenant(tenantData);
        if (tenantData.user || tenantData.User) {
          setUser(tenantData.user || tenantData.User);
        }
      } else {
        setError('Tenant not found');
      }
    } catch (err) {
      console.error('Error fetching tenant:', err);
      setError(err?.response?.data?.message || 'Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Fetch tenant details on load
  useEffect(() => {
    if (tenantId) fetchTenant();
  }, [tenantId, fetchTenant]);

  // Fetch conversations and find the one with this tenant
  useEffect(() => {
    const fetchConversation = async () => {
      if (!tenant?.id) return;

      try {
        setLoadingConversation(true);
        
        // Fetch all conversations
        await dispatch(getConversations(false));
      } catch (err) {
        console.error('Error fetching conversations:', err);
      } finally {
        setLoadingConversation(false);
      }
    };

    fetchConversation();
  }, [tenant?.id, dispatch]);

  // Find conversation from Redux state after it's loaded
  useEffect(() => {
    if (!tenant?.id || !conversations || conversations.length === 0) {
      // If conversations haven't loaded yet, try fetching them
      if (tenant?.id && conversations.length === 0) {
        dispatch(getConversations(false));
      }
      return;
    }

    // Find conversation with this tenant
    // Try matching by tenantId first, then by tenant name
    const tenantFullName = `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim();
    const tenantConversation = conversations.find(
      (conv) => {
        // Match by tenant ID if available
        if (conv.tenantId && tenant.id && conv.tenantId === tenant.id) {
          return true;
        }
        // Match by tenant name
        if (conv.tenantName && tenantFullName && 
            conv.tenantName.toLowerCase() === tenantFullName.toLowerCase()) {
          return true;
        }
        return false;
      }
    );

    if (tenantConversation && tenantConversation.id !== conversation?.id) {
      setConversation(tenantConversation);
      
      // Fetch messages for this conversation
      dispatch(getMessages(tenantConversation.id)).catch((err) => {
        console.warn('Could not fetch messages:', err);
      });
    }
  }, [tenant?.id, tenant?.firstname, tenant?.lastname, conversations, dispatch, conversation?.id]);

  // Get messages for the conversation
  useEffect(() => {
    if (conversation?.id) {
      // Check if messages are in Redux state
      const convMessages = messages[conversation.id];
      if (convMessages && Array.isArray(convMessages)) {
        // Sort by date and get last few messages for preview
        const sortedMessages = [...convMessages].sort((a, b) => 
          new Date(a.createdAt || a.CreatedAt || 0) - new Date(b.createdAt || b.CreatedAt || 0)
        );
        setConversationMessages(sortedMessages.slice(-5)); // Last 5 messages
      } else {
        setConversationMessages([]);
      }
    }
  }, [conversation?.id, messages]);

  // Leases for this tenant: from properties (current/draft) and lease history (ended)
  const tenantLeasesFromProperties = useMemo(() => {
    if (!tenant?.id || !properties?.length) return [];
    const tid = tenant.id;
    const list = [];
    properties.forEach((p) => {
      p.units?.forEach((u) => {
        const unitLease = u.lease || u.Lease;
        if (!unitLease?.id) return;
        const tenants = unitLease.tenants || unitLease.Tenants || [];
        if (tenants.some((t) => (t.id || t.Id) === tid)) {
          list.push({
            ...unitLease,
            propertyName: p.name,
            propertyId: p.id,
            unitName: u.name,
            unitId: u.id
          });
        }
      });
    });
    return list;
  }, [tenant?.id, properties]);

  // Fetch lease history and merge with property-based leases
  useEffect(() => {
    if (!tenant?.id) return;

    const fetchHistoryAndMerge = async () => {
      setLoadingLeases(true);
      try {
        const response = await axiosServices.get('/api/lease/history');
        let historyLeases = [];
        if (response.data?.success && response.data?.data) {
          const tid = tenant.id;
          historyLeases = response.data.data.filter((lease) => {
            const tenants = lease.tenants || lease.Tenants || [];
            return tenants.some((t) => (t.id || t.Id) === tid);
          });
        }
        const currentIds = new Set(tenantLeasesFromProperties.map((l) => l.id || l.Id));
        const historyOnly = historyLeases.filter((l) => !currentIds.has(l.id || l.Id));
        setTenantLeases([...tenantLeasesFromProperties, ...historyOnly]);
      } catch (err) {
        console.error('Error fetching leases for tenant:', err);
        setTenantLeases(tenantLeasesFromProperties);
      } finally {
        setLoadingLeases(false);
      }
    };

    fetchHistoryAndMerge();
  }, [tenant?.id, tenantLeasesFromProperties]);

  // Fetch tenant invite status for "Invite to Portal" visibility
  useEffect(() => {
    if (!tenant?.id) return;

    const fetchInvites = async () => {
      try {
        const response = await tenantInviteAPI.getInvitesByTenantId(tenant.id);
        if (response.success && response.data && response.data.length > 0) {
          const validInvite = response.data.find(
            (inv) => !inv.isUsed && new Date(inv.expiresAt) > new Date()
          );
          setTenantInvites((prev) => ({ ...prev, [tenant.id]: !!validInvite }));
        }
      } catch (err) {
        console.warn('Error fetching tenant invites:', err);
      }
    };

    fetchInvites();
  }, [tenant?.id]);

  // Fetch payment history for Payment reliability card
  useEffect(() => {
    if (!tenantId) return;

    const fetchPaymentHistory = async () => {
      setLoadingPaymentHistory(true);
      setPaymentHistoryError(null);
      try {
        const response = await axiosServices.get(`/api/payment/tenant/${tenantId}`);
        const raw = response.data;
        const list = Array.isArray(raw) ? raw : raw?.data ?? [];
        setPaymentHistory(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching payment history:', err);
        setPaymentHistoryError(err?.response?.data?.message || 'Failed to load payment history');
        setPaymentHistory([]);
      } finally {
        setLoadingPaymentHistory(false);
      }
    };

    fetchPaymentHistory();
  }, [tenantId]);

  const fullName = useMemo(() => {
    if (!tenant) return '';
    return `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || 'Unnamed Tenant';
  }, [tenant]);

  const propertyDisplay = useMemo(() => {
    if (!tenant) return 'N/A';
    if (tenant.propertyType?.toLowerCase() === 'singlefamily') {
      return tenant.propertyName || 'N/A';
    }
    return tenant.unitName
      ? `${tenant.propertyName || ''} – ${tenant.unitName}`.trim()
      : tenant.propertyName || 'N/A';
  }, [tenant]);

  const tenantProperty = useMemo(() =>
    properties?.find((p) => p.id === tenant?.propertyId) || null,
  [properties, tenant?.propertyId]);

  const filteredPaymentHistory = useMemo(() => {
    if (!paymentHistory?.length) return [];
    if (paymentFilter === 'rent') {
      return paymentHistory.filter((p) => String(p.paymentType || p.PaymentType || '').toLowerCase() === 'rent');
    }
    return paymentHistory;
  }, [paymentHistory, paymentFilter]);

  const analyzedPaymentHistory = useMemo(() => {
    if (!filteredPaymentHistory.length) return [];

    const toDateOnly = (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };

    const getActualDayOfMonth = (day, year, month) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return Math.min(Math.max(Number(day) || 1, 1), lastDay);
    };

    const addDays = (date, days) => {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    };

    const getRentDueDatesForLease = (lease) => {
      const startDate = toDateOnly(lease?.startDate ?? lease?.StartDate);
      const endDate = toDateOnly(lease?.endDate ?? lease?.EndDate);
      const rentDueDay = lease?.rentDueDay ?? lease?.RentDueDay ?? 1;
      if (!startDate || !endDate) return [];

      const startMonthDueDay = getActualDayOfMonth(rentDueDay, startDate.getFullYear(), startDate.getMonth());
      let firstDueDate = new Date(startDate.getFullYear(), startDate.getMonth(), startMonthDueDay);
      if (firstDueDate < startDate) {
        const nextMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
        const nextMonthDueDay = getActualDayOfMonth(rentDueDay, nextMonth.getFullYear(), nextMonth.getMonth());
        firstDueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthDueDay);
      }

      const dates = [];
      let cursor = firstDueDate;
      while (cursor <= endDate && dates.length < 60) {
        dates.push(cursor);
        const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const nextDueDay = getActualDayOfMonth(rentDueDay, nextMonth.getFullYear(), nextMonth.getMonth());
        cursor = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDueDay);
      }
      return dates;
    };

    const leasesById = new Map(tenantLeases.map((lease) => [Number(lease.id ?? lease.Id), lease]));
    const byLease = new Map();

    filteredPaymentHistory.forEach((payment) => {
      const leaseId = Number(payment.leaseId ?? payment.LeaseId);
      if (!byLease.has(leaseId)) byLease.set(leaseId, []);
      byLease.get(leaseId).push(payment);
    });

    return Array.from(byLease.entries()).flatMap(([leaseId, paymentsForLease]) => {
      const lease = leasesById.get(leaseId);
      const rentAmount = parseFloat(lease?.rentAmount ?? lease?.RentAmount) || 0;
      const rentDueDates = getRentDueDatesForLease(lease);
      const gracePeriod = Number(lease?.lateFeeGracePeriod ?? lease?.LateFeeGracePeriod ?? 5) || 0;
      let cumulativeRentPaid = 0;

      return [...paymentsForLease]
        .sort((a, b) => (toDateOnly(a.paymentDate || a.PaymentDate)?.getTime() || 0) - (toDateOnly(b.paymentDate || b.PaymentDate)?.getTime() || 0))
        .map((payment) => {
          const paymentDate = toDateOnly(payment.paymentDate || payment.PaymentDate);
          const paymentType = payment.paymentType || payment.PaymentType || 'Payment';
          const paymentTypeKey = String(paymentType).toLowerCase();
          const isRent = paymentTypeKey === 'rent';
          const explicitDueDate = toDateOnly(payment.dueDate || payment.DueDate);
          let dueDate = explicitDueDate;
          let lateDate = explicitDueDate;

          if (isRent && rentAmount > 0 && rentDueDates.length) {
            cumulativeRentPaid += parseFloat(payment.amount ?? payment.Amount) || 0;
            const coveredCycleIndex = Math.max(0, Math.ceil(cumulativeRentPaid / rentAmount) - 1);
            dueDate = rentDueDates[coveredCycleIndex] || explicitDueDate;
            lateDate = dueDate ? addDays(dueDate, gracePeriod) : null;
          }

          let onTime;
          if (paymentTypeKey === 'deposit' && !dueDate) {
            onTime = true;
          } else if (paymentDate && lateDate) {
            onTime = paymentDate <= lateDate;
          } else {
            onTime = payment.isOnTime ?? payment.IsOnTime;
          }

          return {
            ...payment,
            id: payment.id || payment.Id || `${payment.paymentDate || payment.PaymentDate}-${payment.amount || payment.Amount}`,
            onTime,
            date: payment.paymentDate || payment.PaymentDate,
            dueDate,
            amount: payment.amount ?? payment.Amount,
            paymentType
          };
        });
    });
  }, [filteredPaymentHistory, tenantLeases]);

  const paymentReliabilityTimeline = useMemo(() => {
    return [...analyzedPaymentHistory]
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
      .slice(-12);
  }, [analyzedPaymentHistory]);

  const paymentReliabilitySummary = useMemo(() => {
    const total = analyzedPaymentHistory.length;
    if (total === 0) return null;
    const onTime = analyzedPaymentHistory.filter((p) => p.onTime === true).length;
    const pct = total > 0 ? Math.round((onTime / total) * 100) : 0;
    return { total, onTime, pct };
  }, [analyzedPaymentHistory]);

  // Avatar: profile image if available (from linked user), else first + last initials
  const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl;
  const initials = useMemo(() => {
    const first = (tenant?.firstname || tenant?.firstName || '').trim();
    const last = (tenant?.lastname || tenant?.lastName || '').trim();
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    if (last) return last.slice(0, 2).toUpperCase();
    return fullName ? fullName.slice(0, 2).toUpperCase() : '?';
  }, [tenant?.firstname, tenant?.firstName, tenant?.lastname, tenant?.lastName, fullName]);

  const hasAccount = !!(tenant?.userId || tenant?.UserId);
  const activeLease = useMemo(
    () => tenantLeases.find((lease) => lease.isActive !== false && lease.IsActive !== false && lease.isDrafted !== true && lease.IsDrafted !== true) || tenantLeases[0],
    [tenantLeases]
  );
  const activeLeaseId = activeLease?.id ?? activeLease?.Id;
  const accountStatusLabel = hasAccount ? 'Portal connected' : tenant?.email ? 'Ready to invite' : 'Missing email';
  const accountStatusColor = hasAccount ? 'success' : tenant?.email ? 'warning' : 'default';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !tenant) {
    return (
      <MainCard>
        <Alert severity="error">{error || 'Tenant not found'}</Alert>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/landlord/leases?tab=tenants')}
          sx={{ mt: 2 }}
        >
          Back to Tenants
        </Button>
      </MainCard>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Tenants', path: '/landlord/leases?tab=tenants' },
          { label: fullName }
        ]}
      />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mt: 1, mb: 3 }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            alt={fullName}
            src={profileImageUrl}
            size={isMobile ? 'lg' : 'xl'}
            color="primary"
            sx={{
              flexShrink: 0,
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.08)}`
            }}
          >
            {initials}
          </Avatar>
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                {fullName}
              </Typography>
              <Chip label={accountStatusLabel} color={accountStatusColor} size="small" variant={hasAccount ? 'filled' : 'outlined'} />
            </Stack>
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              {tenant.email && (
                <Chip
                  icon={<MailOutlined style={{ fontSize: 14 }} />}
                  label={tenant.email}
                  size="small"
                  variant="outlined"
                  sx={{ maxWidth: 260, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                />
              )}
              {(tenant.phoneNumber || tenant.phone) && (
                <Chip
                  icon={<PhoneOutlined style={{ fontSize: 14 }} />}
                  label={formatPhoneInput(tenant.phoneNumber || tenant.phone)}
                  size="small"
                  variant="outlined"
                />
              )}
              {propertyDisplay !== 'N/A' && (
                <Chip
                  icon={<HomeOutlined style={{ fontSize: 14 }} />}
                  label={propertyDisplay}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    if (tenant.unitId) navigate(`/landlord/unit/${tenant.unitId}`);
                    else if (tenant.propertyId) navigate(`/landlord/property/${tenant.propertyId}`);
                  }}
                  sx={{ cursor: (tenant.unitId || tenant.propertyId) ? 'pointer' : 'default' }}
                />
              )}
            </Stack>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={<EditOutlined style={{ fontSize: 16 }} />}
            onClick={() => tenant && drawer.openTenantEditDrawer(tenant)}
            sx={{ px: 2.5 }}
          >
            Edit tenant
          </Button>
          <Button
            variant="outlined"
            startIcon={<DollarOutlined style={{ fontSize: 16 }} />}
            onClick={() => {
              if (activeLeaseId) navigate(`/landlord/leases/${activeLeaseId}/charges`);
              else openSnackbar({ open: true, message: 'No lease to add charges to.', variant: 'alert', alert: { color: 'warning' } });
            }}
            disabled={!activeLeaseId}
          >
            Create charge
          </Button>
          <Button
            variant="contained"
            startIcon={<MessageOutlined style={{ fontSize: 16 }} />}
            onClick={() => setMessageDrawerOpen(true)}
          >
            Message
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          mb: 0,
          '& .MuiTabs-root': { minHeight: 42 },
          '& .MuiTab-root': {
            minHeight: 42,
            px: 0,
            mr: 3,
            textTransform: 'none',
            fontWeight: 600,
            color: 'text.secondary',
            '&.Mui-selected': { color: 'primary.main' }
          },
          '& .MuiTabs-indicator': { height: 2, borderRadius: 2 }
        }}
      >
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Overview" id="tenant-tab-0" aria-controls="tenant-tabpanel-0" />
          <Tab label="Messages" id="tenant-tab-1" aria-controls="tenant-tabpanel-1" />
        </Tabs>
      </Box>

      {/* Tab panel: Overview */}
      <Box role="tabpanel" hidden={activeTab !== 0} id="tenant-tabpanel-0" aria-labelledby="tenant-tab-0" sx={{ pt: 3 }}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Portal Access */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}` }}>
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: alpha(accountStatusColor === 'success' ? theme.palette.success.main : accountStatusColor === 'warning' ? theme.palette.warning.main : theme.palette.text.disabled, 0.12), color: accountStatusColor === 'success' ? 'success.main' : accountStatusColor === 'warning' ? 'warning.main' : 'text.disabled', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <UserOutlined style={{ fontSize: 17 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', letterSpacing: 1.1, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 800 }}>Portal Access</Typography>
                    <Typography variant="h4" sx={{ lineHeight: 1.05, fontWeight: 800 }}>{accountStatusLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">{hasAccount ? 'Tenant can use the portal' : tenant?.email ? 'Invite can be sent' : 'Add email before inviting'}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Leases */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}` }}>
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <FileTextOutlined style={{ fontSize: 17 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', letterSpacing: 1.1, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 800 }}>Leases</Typography>
                    <Typography variant="h4" sx={{ lineHeight: 1.05, fontWeight: 800 }}>{tenantLeases.length}</Typography>
                    <Typography variant="caption" color="text.secondary">{tenantLeases.length === 1 ? 'Lease connected' : 'Lease records connected'}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Payment Reliability */}
          <Grid size={{ xs: 12, sm: 4 }}>
            {(() => {
              const pct = paymentReliabilitySummary?.pct ?? null;
              const reliabilityColor = pct === null ? theme.palette.text.disabled : pct >= 80 ? theme.palette.success.main : pct >= 50 ? theme.palette.warning.main : theme.palette.error.main;
              return (
                <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}` }}>
                  <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: alpha(reliabilityColor, 0.12), color: reliabilityColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <DollarOutlined style={{ fontSize: 17 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', letterSpacing: 1.1, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 800 }}>Payment Reliability</Typography>
                        <Typography variant="h4" sx={{ lineHeight: 1.05, fontWeight: 800 }}>{pct !== null ? `${pct}%` : '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{paymentReliabilitySummary ? `${paymentReliabilitySummary.onTime} of ${paymentReliabilitySummary.total} on time` : 'No payment history yet'}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })()}
          </Grid>
        </Grid>

        <Grid container spacing={isMobile ? 2 : 3} alignItems="stretch">
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
            <MainCard title="Tenant information" sx={{ height: '100%', mb: { xs: 2, md: 0 }, borderRadius: 2, boxShadow: 'none', borderColor: 'divider' }}>
            <Grid container spacing={isMobile ? 2 : 3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Full Name
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {fullName}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {tenant.email || 'N/A'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Phone Number
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatPhoneInput(tenant.phoneNumber || tenant.phone) || 'N/A'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Property / Unit
                  </Typography>
                  <Box
                    onClick={() => {
                      if (tenant.unitId) {
                        navigate(`/landlord/unit/${tenant.unitId}`);
                      } else if (tenant.propertyId) {
                        navigate(`/landlord/property/${tenant.propertyId}`);
                      }
                    }}
                    sx={{
                      cursor: (tenant.unitId || tenant.propertyId) ? 'pointer' : 'default',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <HomeOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                    <Typography 
                      variant="body1" 
                      fontWeight={500}
                      sx={{
                        color: (tenant.unitId || tenant.propertyId) ? 'primary.main' : 'text.primary',
                        textDecoration: 'none',
                        '&:hover': (tenant.unitId || tenant.propertyId) ? {
                          textDecoration: 'underline'
                        } : {}
                      }}
                    >
                      {propertyDisplay}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              {tenant.userId && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Account Created
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                      <Typography variant="body1" fontWeight={500}>
                        {user?.createDate || user?.CreateDate 
                          ? formatDateAndTime(user.createDate || user.CreateDate)
                          : 'Account exists (date not available)'}
                      </Typography>
                    </Stack>
                  </Stack>
                </Grid>
              )}
            </Grid>
          </MainCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          {/* Current lease(s) */}
          <MainCard title="Leases" sx={{ height: '100%', borderRadius: 2, boxShadow: 'none', borderColor: 'divider' }}>
            {loadingLeases ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : tenantLeases.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No leases associated with this tenant.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {tenantLeases.map((lease) => {
                  const leaseId = lease.id || lease.Id;
                  const propertyName = lease.propertyName || lease.PropertyName || 'Property';
                  const unitName = lease.unitName || lease.UnitName;
                  const leaseName = lease.name || lease.Name || `${propertyName}${unitName ? `, #${unitName}` : ''}` || `Lease #${leaseId}`;
                  const startDate = lease.startDate || lease.StartDate;
                  const endDate = lease.endDate || lease.EndDate;
                  const isDraft = lease.isDrafted === true || lease.IsDrafted === true;
                  const isActive = lease.isActive !== false && lease.IsActive !== false;
                  const isConnectedToPortal = !!(tenant?.userId || tenant?.UserId);
                  const showInvite = !isConnectedToPortal && !!tenant?.email;

                  return (
                    <Paper
                      key={leaseId}
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: 'background.paper',
                        borderColor: 'divider',
                        borderRadius: 2,
                        transition: 'border-color 120ms ease, background-color 120ms ease',
                        '&:hover': {
                          borderColor: alpha(theme.palette.primary.main, 0.35),
                          bgcolor: alpha(theme.palette.primary.main, 0.015)
                        }
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            onClick={() => (lease.unitId || lease.UnitId) && navigate(`/landlord/lease/${leaseId}`)}
                            sx={{
                              color: 'primary.main',
                              cursor: (lease.unitId || lease.UnitId) ? 'pointer' : 'default',
                              flex: 1,
                              minWidth: 0,
                              '&:hover': { textDecoration: 'underline' }
                            }}
                          >
                            {leaseName}
                          </Typography>
                          <Chip
                            label={isDraft ? 'Draft' : isActive ? 'Active' : 'Ended'}
                            size="small"
                            color={isDraft ? 'default' : isActive ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: '0.75rem', flexShrink: 0 }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <HomeOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                          <Typography variant="body2" color="text.secondary">
                            {propertyName}{unitName ? `, #${unitName}` : ''}
                          </Typography>
                          {(startDate || endDate) && (
                            <>
                              <Divider orientation="vertical" flexItem />
                              <Typography variant="caption" color="text.secondary">
                                {startDate ? formatDate(startDate) : '—'} → {endDate ? formatDate(endDate) : '—'}
                              </Typography>
                            </>
                          )}
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 0.5 }}>
                          <Stack direction="row" alignItems="center">
                            {showInvite && (
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={sendingInvite ? <ReloadOutlined spin /> : <SendOutlined />}
                                disabled={sendingInvite}
                                sx={{ px: 2.5 }}
                                onClick={async () => {
                                  try {
                                    setSendingInvite(true);
                                    const response = await tenantInviteAPI.createTenantInvite({
                                      tenantId: tenant.id,
                                      email: tenant.email
                                    });
                                    if (response.success) {
                                      openSnackbar({
                                        open: true,
                                        message: 'Invite email sent successfully!',
                                        anchorOrigin: { vertical: 'top', horizontal: 'right' },
                                        variant: 'alert',
                                        alert: { color: 'success' }
                                      });
                                      setTenantInvites((prev) => ({ ...prev, [tenant.id]: true }));
                                    } else {
                                      openSnackbar({
                                        open: true,
                                        message: response.message || 'Failed to send invite',
                                        anchorOrigin: { vertical: 'top', horizontal: 'right' },
                                        variant: 'alert',
                                        alert: { color: 'error' }
                                      });
                                    }
                                  } catch (err) {
                                    openSnackbar({
                                      open: true,
                                      message: err?.response?.data?.message || 'Failed to send invite',
                                      anchorOrigin: { vertical: 'top', horizontal: 'right' },
                                      variant: 'alert',
                                      alert: { color: 'error' }
                                    });
                                  } finally {
                                    setSendingInvite(false);
                                  }
                                }}
                              >
                                Invite to Portal
                              </Button>
                            )}
                          </Stack>
                          <Button
                            variant="text"
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlined style={{ fontSize: 14 }} />}
                            disabled={removingFromLease}
                            onClick={() => setRemoveFromLeaseConfirm(lease)}
                            sx={{ textTransform: 'none' }}
                          >
                            Remove from lease
                          </Button>
                        </Stack>
                        </Stack>
                      </Paper>
                    );
                })}
              </Stack>
            )}
          </MainCard>
          </Grid>

          {/* Payment reliability */}
          <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
            <MainCard
              title="Payment reliability"
              sx={{
                borderRadius: 2,
                boxShadow: 'none',
                borderColor: 'divider',
                '&:hover': {
                  boxShadow: 'none',
                  borderColor: 'divider'
                }
              }}
              secondary={
                <ToggleButtonGroup
                  value={paymentFilter}
                  exclusive
                  onChange={(_, v) => v != null && setPaymentFilter(v)}
                  size="small"
                  sx={{ flexWrap: 'wrap' }}
                >
                  <ToggleButton value="all">All payments</ToggleButton>
                  <ToggleButton value="rent">Rent only</ToggleButton>
                </ToggleButtonGroup>
              }
            >
              {loadingPaymentHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : paymentHistoryError ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {paymentHistoryError}
                </Alert>
              ) : filteredPaymentHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  No payment history yet.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {paymentReliabilitySummary?.pct ?? 0}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {paymentReliabilitySummary?.onTime ?? 0} of {paymentReliabilitySummary?.total ?? 0} payments on time
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                      {Array.from({ length: 12 }).map((_, index) => {
                        const payment = paymentReliabilityTimeline[index];
                        const color = !payment
                          ? 'rgba(0,0,0,0.08)'
                          : payment.onTime === true
                            ? 'success.main'
                            : payment.onTime === false
                              ? 'warning.main'
                              : 'grey.300';

                        return (
                          <Box
                            key={payment?.id || index}
                            title={payment?.date ? `${formatDate(payment.date)}${payment.onTime === false ? ' · late' : payment.onTime === true ? ' · on time' : ''}` : 'No payment'}
                            sx={{
                              width: 10,
                              height: 28,
                              borderRadius: 0.75,
                              border: '1px solid rgba(0,0,0,0.08)',
                              bgcolor: color
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary">On time</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                      <Typography variant="caption" color="text.secondary">Late</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Last {Math.min(paymentReliabilityTimeline.length, 12)} payments shown
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </MainCard>
          </Grid>
      </Grid>
      </Box>

      {/* Tab panel: Messages */}
      <Box role="tabpanel" hidden={activeTab !== 1} id="tenant-tabpanel-1" aria-labelledby="tenant-tab-1" sx={{ pt: 3 }}>
        <MainCard
          title="Messages"
          sx={{ borderRadius: 2, boxShadow: 'none', borderColor: 'divider' }}
          secondary={
            conversation && (
              <Button
                variant="contained"
                size="small"
                startIcon={<MessageOutlined style={{ fontSize: 14 }} />}
                onClick={() => setMessageDrawerOpen(true)}
              >
                View Messages
              </Button>
            )
          }
        >
          {loadingConversation ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : conversation ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Conversation with {fullName}. Use the button above to open the Messages page with this conversation selected.
              </Typography>
              {conversationMessages.length > 0 && (
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Recent messages
                  </Typography>
                  {conversationMessages.map((message) => (
                    <Paper
                      key={message.id}
                      variant="outlined"
                      sx={{ p: 2, bgcolor: alpha(theme.palette.background.paper, 0.5) }}
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" fontWeight={600}>
                            {message.senderName || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateAndTime(message.createdAt || message.CreatedAt)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.primary">
                          {message.content || message.Content || ''}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          ) : (
            <Alert severity="info">
              No conversation found with this tenant. You can start a conversation from the Messages page.
            </Alert>
          )}
        </MainCard>
      </Box>

      {/* Remove from lease confirmation */}
      <ConfirmationDialog
        open={!!removeFromLeaseConfirm}
        onClose={() => setRemoveFromLeaseConfirm(null)}
        onConfirm={async () => {
          if (!removeFromLeaseConfirm || !tenant?.id) return;
          const leaseId = removeFromLeaseConfirm.id ?? removeFromLeaseConfirm.Id;
          try {
            setRemovingFromLease(true);
            const response = await removeTenantFromLease(leaseId, tenant.id);
            if (response?.success !== false) {
              setTenantLeases((prev) => prev.filter((l) => (l.id ?? l.Id) !== leaseId));
              openSnackbar({
                open: true,
                message: 'Tenant removed from lease.',
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
                variant: 'alert',
                alert: { color: 'success' }
              });
              setRemoveFromLeaseConfirm(null);
              propertiesRefetch();
            } else {
              openSnackbar({
                open: true,
                message: response?.message || 'Failed to remove tenant from lease.',
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
                variant: 'alert',
                alert: { color: 'error' }
              });
            }
          } catch (err) {
            openSnackbar({
              open: true,
              message: err?.response?.data?.message || 'Failed to remove tenant from lease.',
              anchorOrigin: { vertical: 'top', horizontal: 'right' },
              variant: 'alert',
              alert: { color: 'error' }
            });
          } finally {
            setRemovingFromLease(false);
          }
        }}
        title="Remove from lease"
        message={`Are you sure you want to remove ${fullName} from this lease? This will disconnect the tenant from the lease and unit. The tenant record will be preserved.`}
        confirmText="Remove from lease"
        cancelText="Cancel"
        confirmColor="error"
      />

      {/* Tenant Edit Drawer - refetch tenant after save so header/name update */}
      <TenantEditDrawer onUpdateSuccess={fetchTenant} />

      <TenantMessageDrawer
        open={messageDrawerOpen}
        onClose={() => setMessageDrawerOpen(false)}
        tenant={tenant}
        property={tenantProperty}
      />
    </Box>
  );
}


