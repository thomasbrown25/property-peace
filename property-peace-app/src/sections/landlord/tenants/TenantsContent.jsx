import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import {
  CalendarOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  HomeOutlined,
  MailOutlined,
  MoreOutlined,
  PhoneOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import AddToLeaseDrawer from 'components/drawers/AddToLeaseDrawer';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { TenantCsvImportButton } from 'components/import/CsvImportButtons';
import { tenantInviteAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useFetchTenants from 'hooks/useFetchTenants';
import { useDrawer } from 'contexts/DrawerContext';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { selectTenants } from 'store/tenant/tenant.selector';
import { deleteTenant } from 'store/tenant/tenant.action';
import { formatPhoneInput } from 'utils/formatters';

const PAGE_SIZE = 10;
const NAVY = '#061e35';

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (tenant) => read(tenant, 'id', 'Id');
const getFullName = (tenant) => `${read(tenant, 'firstname', 'Firstname') || ''} ${read(tenant, 'lastname', 'Lastname') || ''}`.trim() || 'Unnamed tenant';
const hasAccount = (tenant) => Boolean(read(tenant, 'userId', 'UserId'));
const hasLease = (tenant) => Boolean(read(tenant, 'leaseId', 'LeaseId'));
const isActiveTenant = (tenant) => read(tenant, 'isActive', 'IsActive') !== false;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLeaseEnd(tenant) {
  return parseDate(read(tenant, 'leaseEndDate', 'LeaseEndDate'));
}

function isLeaseEndingSoon(tenant) {
  const leaseEnd = getLeaseEnd(tenant);
  if (!hasLease(tenant) || !leaseEnd) return false;
  const days = Math.ceil((leaseEnd.getTime() - Date.now()) / 86400000);
  return days >= 0 && days <= 60;
}

function getPropertyDisplay(tenant) {
  const propertyName = read(tenant, 'propertyName', 'PropertyName');
  const unitName = read(tenant, 'unitName', 'UnitName');
  const propertyType = String(read(tenant, 'propertyType', 'PropertyType') || '').toLowerCase();
  if (!propertyName) return null;
  if (propertyType === 'singlefamily' || !unitName) return propertyName;
  return `${propertyName} · ${unitName}`;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 112,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${active ? alpha(color, 0.55) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha(NAVY, 0.05)}`,
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.45), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.28)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.55, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function PortalStatus({ tenant, tenantInvites }) {
  const tenantId = getId(tenant);
  const email = read(tenant, 'email', 'Email');

  if (hasAccount(tenant)) {
    return <Chip label="Portal active" color="success" size="small" sx={{ fontWeight: 650 }} />;
  }
  if (email && tenantInvites[tenantId]) {
    return <Chip label="Invite pending" color="warning" size="small" sx={{ fontWeight: 650 }} />;
  }
  if (email) {
    return <Chip label="Ready to invite" color="primary" variant="outlined" size="small" sx={{ fontWeight: 650 }} />;
  }
  return <Chip label="Email needed" size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider', fontWeight: 600 }} />;
}

function TenantRow({ tenant, tenantInvites, selected, onSelect, onOpen, onActions }) {
  const theme = useTheme();
  const tenantId = getId(tenant);
  const fullName = getFullName(tenant);
  const email = read(tenant, 'email', 'Email');
  const phone = read(tenant, 'phoneNumber', 'PhoneNumber') || read(tenant, 'phone', 'Phone');
  const propertyDisplay = getPropertyDisplay(tenant);
  const leaseStart = formatDate(read(tenant, 'leaseStartDate', 'LeaseStartDate'));
  const leaseEnd = formatDate(read(tenant, 'leaseEndDate', 'LeaseEndDate'));
  const canInvite = !hasAccount(tenant) && Boolean(email);
  const initials = fullName === 'Unnamed tenant'
    ? '?'
    : fullName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(tenant);
    }
  };

  return (
    <Box
      role="link"
      tabIndex={0}
      onClick={() => onOpen(tenant)}
      onKeyDown={handleKeyDown}
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.5, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: '42px minmax(210px, 1.45fr) minmax(190px, 1.25fr) minmax(210px, 1.35fr) minmax(125px, .8fr) 42px',
        gap: { xs: 1.25, md: 1.5 },
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        transition: 'background-color 140ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`, outlineOffset: -2 }
      }}
    >
      <Box sx={{ display: { xs: 'none', md: 'block' } }} onClick={(event) => event.stopPropagation()}>
        <Tooltip title={!email ? 'Add an email address before inviting' : hasAccount(tenant) ? 'Portal account already active' : ''} disableHoverListener={canInvite}>
          <span>
            <Checkbox size="small" checked={selected} onChange={(event) => onSelect(event, tenantId)} disabled={!canInvite} />
          </span>
        </Tooltip>
      </Box>

      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 40, height: 40, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.mode === 'dark' ? 'primary.light' : NAVY, fontSize: '0.78rem', fontWeight: 750 }}>
          {initials}
        </Avatar>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography fontWeight={700} noWrap>{fullName}</Typography>
            {!isActiveTenant(tenant) && <Chip size="small" label="Archived" sx={{ height: 20, fontSize: '0.65rem' }} />}
          </Stack>
          <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>Tenant record #{tenantId}</Typography>
        </Box>
      </Stack>

      <Box sx={{ mt: { xs: 1.25, md: 0 }, pl: { xs: 6.5, md: 0 } }}>
        {propertyDisplay ? (
          <>
            <Stack direction="row" spacing={0.7} alignItems="center">
              <HomeOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
              <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{propertyDisplay}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 0.45 }}>
              <CalendarOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.7rem', color: isLeaseEndingSoon(tenant) ? 'warning.main' : 'text.secondary', fontWeight: isLeaseEndingSoon(tenant) ? 650 : 400 }}>
                {hasLease(tenant)
                  ? leaseEnd
                    ? `${leaseStart ? `${leaseStart} – ` : 'Through '}${leaseEnd}`
                    : 'Lease assigned'
                  : 'No lease assigned'}
              </Typography>
            </Stack>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 650, color: 'text.secondary' }}>Unassigned</Typography>
            <Typography sx={{ mt: 0.35, fontSize: '0.7rem', color: 'warning.main', fontWeight: 650 }}>Add to a lease when ready</Typography>
          </>
        )}
      </Box>

      <Stack spacing={0.5} sx={{ mt: { xs: 1.25, md: 0 }, pl: { xs: 6.5, md: 0 }, minWidth: 0 }}>
        <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
          <MailOutlined style={{ fontSize: 13, color: theme.palette.text.secondary, flexShrink: 0 }} />
          <Typography noWrap sx={{ fontSize: '0.76rem', color: email ? 'text.secondary' : 'text.disabled' }}>{email || 'No email on file'}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
          <PhoneOutlined style={{ fontSize: 13, color: theme.palette.text.secondary, flexShrink: 0 }} />
          <Typography noWrap sx={{ fontSize: '0.76rem', color: phone ? 'text.secondary' : 'text.disabled' }}>{phone ? formatPhoneInput(phone) : 'No phone on file'}</Typography>
        </Stack>
      </Stack>

      <Box sx={{ mt: { xs: 1.2, md: 0 }, pl: { xs: 6.5, md: 0 } }}>
        <PortalStatus tenant={tenant} tenantInvites={tenantInvites} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' }, mt: { xs: -4, md: 0 } }} onClick={(event) => event.stopPropagation()}>
        <Tooltip title="Tenant actions">
          <IconButton size="small" aria-label={`Actions for ${fullName}`} onClick={(event) => onActions(event, tenant)}>
            <MoreOutlined />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default function TenantsContent() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const { setTenantsLoading } = useDashboardLoading();
  const tenants = useSelector(selectTenants) || [];
  const { refetch, isLoading } = useFetchTenants();

  const [search, setSearch] = useState('');
  const [recordStatus, setRecordStatus] = useState('active');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [leaseFilter, setLeaseFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [tenantInvites, setTenantInvites] = useState({});
  const [selectedTenantIds, setSelectedTenantIds] = useState(new Set());
  const [sendingInvite, setSendingInvite] = useState({});
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuTenant, setActionMenuTenant] = useState(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [tenantToRemove, setTenantToRemove] = useState(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [tenantToEdit, setTenantToEdit] = useState(null);
  const [addToLeaseDrawerOpen, setAddToLeaseDrawerOpen] = useState(false);
  const [addToLeaseTenant, setAddToLeaseTenant] = useState(null);

  useEffect(() => {
    setTenantsLoading(isLoading);
  }, [isLoading, setTenantsLoading]);

  useEffect(() => {
    let active = true;

    const loadInvites = async () => {
      const checks = tenants
        .filter((tenant) => !hasAccount(tenant) && read(tenant, 'email', 'Email'))
        .map(async (tenant) => {
          try {
            const response = await tenantInviteAPI.getInvitesByTenantId(getId(tenant));
            const invites = response?.success && Array.isArray(response.data) ? response.data : [];
            const hasValidInvite = invites.some((invite) => !invite.isUsed && (!invite.expiresAt || new Date(invite.expiresAt) > new Date()));
            return [getId(tenant), hasValidInvite];
          } catch (error) {
            console.error(`Error checking invites for tenant ${getId(tenant)}:`, error);
            return [getId(tenant), false];
          }
        });

      const results = await Promise.all(checks);
      if (active) setTenantInvites(Object.fromEntries(results.filter(([, hasInvite]) => hasInvite)));
    };

    loadInvites();
    return () => { active = false; };
  }, [tenants]);

  useEffect(() => {
    setPage(1);
    setSelectedTenantIds(new Set());
  }, [search, recordStatus, propertyFilter, leaseFilter, accessFilter, sort]);

  const activeTenants = useMemo(() => tenants.filter(isActiveTenant), [tenants]);
  const metrics = useMemo(() => {
    const leased = activeTenants.filter(hasLease).length;
    const accounts = activeTenants.filter(hasAccount).length;
    const readyToInvite = activeTenants.filter((tenant) => !hasAccount(tenant) && read(tenant, 'email', 'Email') && !tenantInvites[getId(tenant)]).length;
    const accessRate = activeTenants.length ? Math.round((accounts / activeTenants.length) * 100) : 0;
    return { total: activeTenants.length, leased, accounts, readyToInvite, accessRate };
  }, [activeTenants, tenantInvites]);

  const propertyOptions = useMemo(() => {
    const byId = new Map();
    tenants.forEach((tenant) => {
      const propertyId = read(tenant, 'propertyId', 'PropertyId');
      const propertyName = read(tenant, 'propertyName', 'PropertyName');
      if (propertyId && propertyName) byId.set(String(propertyId), propertyName);
    });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = tenants.filter((tenant) => {
      const tenantId = getId(tenant);
      const email = read(tenant, 'email', 'Email');
      const phone = read(tenant, 'phoneNumber', 'PhoneNumber') || read(tenant, 'phone', 'Phone');
      const searchable = [getFullName(tenant), email, phone, getPropertyDisplay(tenant)].filter(Boolean).join(' ').toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (recordStatus === 'active' && !isActiveTenant(tenant)) return false;
      if (recordStatus === 'archived' && isActiveTenant(tenant)) return false;
      if (propertyFilter !== 'all' && String(read(tenant, 'propertyId', 'PropertyId')) !== propertyFilter) return false;
      if (leaseFilter === 'leased' && !hasLease(tenant)) return false;
      if (leaseFilter === 'unassigned' && hasLease(tenant)) return false;
      if (leaseFilter === 'ending' && !isLeaseEndingSoon(tenant)) return false;
      if (accessFilter === 'active' && !hasAccount(tenant)) return false;
      if (accessFilter === 'pending' && (hasAccount(tenant) || !tenantInvites[tenantId])) return false;
      if (accessFilter === 'ready' && (hasAccount(tenant) || !email || tenantInvites[tenantId])) return false;
      if (accessFilter === 'missingEmail' && (hasAccount(tenant) || email)) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sort === 'property') return String(getPropertyDisplay(a) || 'zzzz').localeCompare(String(getPropertyDisplay(b) || 'zzzz'));
      if (sort === 'leaseEnd') return (getLeaseEnd(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (getLeaseEnd(b)?.getTime() || Number.MAX_SAFE_INTEGER);
      if (sort === 'newest') return (parseDate(read(b, 'createdAt', 'CreatedAt'))?.getTime() || 0) - (parseDate(read(a, 'createdAt', 'CreatedAt'))?.getTime() || 0);
      return getFullName(a).localeCompare(getFullName(b));
    });
  }, [accessFilter, leaseFilter, propertyFilter, recordStatus, search, sort, tenantInvites, tenants]);

  const pageCount = Math.ceil(filteredTenants.length / PAGE_SIZE);
  const paginatedTenants = filteredTenants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const eligibleOnPage = paginatedTenants.filter((tenant) => !hasAccount(tenant) && read(tenant, 'email', 'Email'));
  const allEligibleSelected = eligibleOnPage.length > 0 && eligibleOnPage.every((tenant) => selectedTenantIds.has(getId(tenant)));
  const hasFilters = search || recordStatus !== 'active' || propertyFilter !== 'all' || leaseFilter !== 'all' || accessFilter !== 'all' || sort !== 'name';

  const clearFilters = () => {
    setSearch('');
    setRecordStatus('active');
    setPropertyFilter('all');
    setLeaseFilter('all');
    setAccessFilter('all');
    setSort('name');
  };

  const showSnackbar = (message, color = 'success') => {
    openSnackbar({ open: true, message, variant: 'alert', alert: { color }, close: true });
  };

  const handleSendInvite = async (tenant) => {
    const tenantId = getId(tenant);
    const email = read(tenant, 'email', 'Email');
    if (!email) {
      showSnackbar('Add an email address before sending an invite.', 'warning');
      return;
    }

    setSendingInvite((current) => ({ ...current, [tenantId]: true }));
    try {
      const invitesResponse = await tenantInviteAPI.getInvitesByTenantId(tenantId);
      const invites = invitesResponse?.success && Array.isArray(invitesResponse.data) ? invitesResponse.data : [];
      const validInvite = invites.find((invite) => !invite.isUsed && (!invite.expiresAt || new Date(invite.expiresAt) > new Date()));
      const response = validInvite
        ? await tenantInviteAPI.resendInvite(validInvite.id)
        : await tenantInviteAPI.createTenantInvite({ tenantId, email });

      if (!response?.success) throw new Error(response?.message || 'Invite could not be sent');
      setTenantInvites((current) => ({ ...current, [tenantId]: true }));
      showSnackbar(validInvite ? 'Tenant invite resent.' : 'Tenant invite sent.');
    } catch (error) {
      console.error('Error sending tenant invite:', error);
      showSnackbar(error?.response?.data?.message || error?.message || 'Failed to send tenant invite', 'error');
    } finally {
      setSendingInvite((current) => ({ ...current, [tenantId]: false }));
    }
  };

  const handleBulkInvite = async () => {
    const selected = filteredTenants.filter((tenant) => selectedTenantIds.has(getId(tenant)) && !hasAccount(tenant) && read(tenant, 'email', 'Email'));
    for (const tenant of selected) await handleSendInvite(tenant);
    setSelectedTenantIds(new Set());
  };

  const toggleTenantSelection = (event, tenantId) => {
    event.stopPropagation();
    setSelectedTenantIds((current) => {
      const next = new Set(current);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  };

  const toggleSelectAll = (event) => {
    event.stopPropagation();
    setSelectedTenantIds((current) => {
      const next = new Set(current);
      if (allEligibleSelected) eligibleOnPage.forEach((tenant) => next.delete(getId(tenant)));
      else eligibleOnPage.forEach((tenant) => next.add(getId(tenant)));
      return next;
    });
  };

  const handleConfirmRemove = async () => {
    if (!tenantToRemove) return;
    setRemoveConfirmOpen(false);
    try {
      await dispatch(deleteTenant(getId(tenantToRemove)));
      await refetch();
      showSnackbar(`${getFullName(tenantToRemove)} was removed from your portfolio.`);
      setTenantToRemove(null);
    } catch (error) {
      console.error('Error removing tenant:', error);
      showSnackbar(error?.response?.data?.message || error?.message || 'Failed to remove tenant', 'error');
    }
  };

  const handleActions = (event, tenant) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setActionMenuTenant(tenant);
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setActionMenuTenant(null);
  };

  const setSummaryView = ({ lease = 'all', access = 'all' }) => {
    setRecordStatus('active');
    setPropertyFilter('all');
    setLeaseFilter(lease);
    setAccessFilter(access);
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Tenants' }]} />
      </Box>

      <Box
        sx={{
          mb: 2.5,
          p: { xs: 2, md: 2.75 },
          borderRadius: 3,
          color: '#fff',
          background: 'linear-gradient(120deg, #061e35 0%, #0b3558 100%)',
          boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}`
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Tenants</Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              Manage renter relationships, lease placement, contact details, and portal access from one workspace.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <TenantCsvImportButton
              buttonProps={{
                sx: {
                  color: '#fff',
                  borderColor: alpha('#fff', 0.35),
                  bgcolor: alpha('#fff', 0.06),
                  textTransform: 'none',
                  '&:hover': { borderColor: alpha('#fff', 0.65), bgcolor: alpha('#fff', 0.12) }
                }
              }}
            />
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={() => drawer.openTenantAddDrawer()}
              sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
            >
              Add tenant
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Active tenants"
            value={metrics.total}
            helper={`${tenants.length - metrics.total} archived record${tenants.length - metrics.total === 1 ? '' : 's'}`}
            icon={<UserOutlined />}
            color={theme.palette.primary.main}
            active={recordStatus === 'active' && leaseFilter === 'all' && accessFilter === 'all'}
            onClick={() => setSummaryView({})}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Assigned to a lease"
            value={metrics.leased}
            helper={`${metrics.total - metrics.leased} waiting for placement`}
            icon={<HomeOutlined />}
            color={theme.palette.success.main}
            active={leaseFilter === 'leased'}
            onClick={() => setSummaryView({ lease: leaseFilter === 'leased' ? 'all' : 'leased' })}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Portal access"
            value={`${metrics.accessRate}%`}
            helper={`${metrics.accounts} of ${metrics.total} accounts active`}
            icon={<MailOutlined />}
            color={theme.palette.success.main}
            active={accessFilter === 'active'}
            onClick={() => setSummaryView({ access: accessFilter === 'active' ? 'all' : 'active' })}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Ready to invite"
            value={metrics.readyToInvite}
            helper="Email on file, no portal account"
            icon={<SendOutlined />}
            color={theme.palette.warning.main}
            active={accessFilter === 'ready'}
            onClick={() => setSummaryView({ access: accessFilter === 'ready' ? 'all' : 'ready' })}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
          borderRadius: 3,
          boxShadow: `0 8px 28px ${alpha(NAVY, 0.055)}`,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} alignItems={{ lg: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tenants, contact details, or properties"
              size="small"
              startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>}
              sx={{ flex: 1, minWidth: { lg: 260 }, borderRadius: 1.75 }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, lg: 0 } }}>
              <Select size="small" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 120, borderRadius: 1.75 }}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
                <MenuItem value="all">All records</MenuItem>
              </Select>
              <Select size="small" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 150, maxWidth: 210, borderRadius: 1.75 }}>
                <MenuItem value="all">All properties</MenuItem>
                {propertyOptions.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
              </Select>
              <Select size="small" value={leaseFilter} onChange={(event) => setLeaseFilter(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 150, borderRadius: 1.75 }}>
                <MenuItem value="all">All lease status</MenuItem>
                <MenuItem value="leased">Assigned to lease</MenuItem>
                <MenuItem value="unassigned">Unassigned</MenuItem>
                <MenuItem value="ending">Ending in 60 days</MenuItem>
              </Select>
              <Select size="small" value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 150, borderRadius: 1.75 }}>
                <MenuItem value="all">All portal access</MenuItem>
                <MenuItem value="active">Portal active</MenuItem>
                <MenuItem value="pending">Invite pending</MenuItem>
                <MenuItem value="ready">Ready to invite</MenuItem>
                <MenuItem value="missingEmail">Email needed</MenuItem>
              </Select>
              <Select size="small" value={sort} onChange={(event) => setSort(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 145, borderRadius: 1.75 }}>
                <MenuItem value="name">Sort: Name</MenuItem>
                <MenuItem value="property">Sort: Property</MenuItem>
                <MenuItem value="leaseEnd">Sort: Lease end</MenuItem>
                <MenuItem value="newest">Sort: Newest</MenuItem>
              </Select>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mt: 1.4 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{filteredTenants.length} of {tenants.length} tenants</Typography>
              {hasFilters && <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>Reset view</Button>}
            </Stack>
            {selectedTenantIds.size > 0 && (
              <Button variant="contained" color="success" size="small" startIcon={<SendOutlined />} onClick={handleBulkInvite} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Send {selectedTenantIds.size} invite{selectedTenantIds.size === 1 ? '' : 's'}
              </Button>
            )}
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '42px minmax(210px, 1.45fr) minmax(190px, 1.25fr) minmax(210px, 1.35fr) minmax(125px, .8fr) 42px', gap: 1.5, px: 2, py: 1.15, bgcolor: alpha(theme.palette.primary.main, 0.025), alignItems: 'center' }}>
          <Checkbox
            size="small"
            checked={allEligibleSelected}
            indeterminate={selectedTenantIds.size > 0 && !allEligibleSelected}
            onChange={toggleSelectAll}
            disabled={eligibleOnPage.length === 0}
          />
          {['Tenant', 'Home & lease', 'Contact', 'Portal access', ''].map((label) => (
            <Typography key={label || 'actions'} sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
          ))}
        </Box>

        {isLoading ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading tenants…</Typography>
          </Stack>
        ) : tenants.length === 0 ? (
          <Stack alignItems="center" spacing={1.4} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Avatar sx={{ width: 52, height: 52, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><UserOutlined /></Avatar>
            <Typography variant="h6" fontWeight={700}>Add your first tenant</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', maxWidth: 430 }}>Create a tenant record to organize contact details, lease placement, and portal access.</Typography>
            <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openTenantAddDrawer()} sx={{ textTransform: 'none', fontWeight: 700 }}>Add tenant</Button>
          </Stack>
        ) : filteredTenants.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>No tenants match this view</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Try a different search or reset the tenant filters.</Typography>
            <Button variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none' }}>Reset filters</Button>
          </Stack>
        ) : (
          paginatedTenants.map((tenant) => (
            <TenantRow
              key={getId(tenant)}
              tenant={tenant}
              tenantInvites={tenantInvites}
              selected={selectedTenantIds.has(getId(tenant))}
              onSelect={toggleTenantSelection}
              onOpen={(item) => navigate(`/landlord/tenants/${getId(item)}`)}
              onActions={handleActions}
            />
          ))
        )}

        {pageCount > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredTenants.length)} of {filteredTenants.length}
            </Typography>
            <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        )}
      </Box>

      <Menu anchorEl={actionMenuAnchor} open={Boolean(actionMenuAnchor)} onClose={closeActionMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => { setTenantToEdit(actionMenuTenant); setEditDrawerOpen(true); closeActionMenu(); }}>
          <Stack direction="row" spacing={1} alignItems="center"><EditOutlined /><span>Edit tenant</span></Stack>
        </MenuItem>
        {hasLease(actionMenuTenant) ? (
          <MenuItem onClick={() => { const leaseId = read(actionMenuTenant, 'leaseId', 'LeaseId'); closeActionMenu(); navigate(`/landlord/leases/${leaseId}`); }}>
            <Stack direction="row" spacing={1} alignItems="center"><HomeOutlined /><span>View lease</span></Stack>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { setAddToLeaseTenant(actionMenuTenant); setAddToLeaseDrawerOpen(true); closeActionMenu(); }}>
            <Stack direction="row" spacing={1} alignItems="center"><HomeOutlined /><span>Add to lease</span></Stack>
          </MenuItem>
        )}
        {actionMenuTenant && !hasAccount(actionMenuTenant) && read(actionMenuTenant, 'email', 'Email') && (
          <MenuItem disabled={sendingInvite[getId(actionMenuTenant)]} onClick={() => { const tenant = actionMenuTenant; closeActionMenu(); handleSendInvite(tenant); }}>
            <Stack direction="row" spacing={1} alignItems="center"><MailOutlined /><span>{tenantInvites[getId(actionMenuTenant)] ? 'Resend invite' : 'Send invite'}</span></Stack>
          </MenuItem>
        )}
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => { setTenantToRemove(actionMenuTenant); setRemoveConfirmOpen(true); closeActionMenu(); }}
        >
          <Stack direction="row" spacing={1} alignItems="center"><DeleteOutlined /><span>Remove tenant</span></Stack>
        </MenuItem>
      </Menu>

      <ConfirmationDialog
        open={removeConfirmOpen}
        onClose={() => { setRemoveConfirmOpen(false); setTenantToRemove(null); }}
        onConfirm={handleConfirmRemove}
        title="Remove tenant?"
        message={`Remove ${tenantToRemove ? getFullName(tenantToRemove) : 'this tenant'} from your portfolio? Their account and historical documents will be preserved.`}
        confirmText="Remove tenant"
        confirmColor="error"
      />

      <TenantEditDrawer
        tenant={tenantToEdit}
        open={editDrawerOpen}
        onClose={() => { setEditDrawerOpen(false); setTenantToEdit(null); }}
        onUpdateSuccess={refetch}
      />

      <AddToLeaseDrawer
        open={addToLeaseDrawerOpen}
        tenant={addToLeaseTenant}
        onClose={() => { setAddToLeaseDrawerOpen(false); setAddToLeaseTenant(null); }}
        onSuccess={refetch}
      />
    </Box>
  );
}
