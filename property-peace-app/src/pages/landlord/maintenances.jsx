import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  alpha,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
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
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  MoreOutlined,

  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  ToolOutlined,
  UserOutlined
} from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import useFetchProperties from 'hooks/useFetchProperties';

import {
  selectHistoryMaintenances,
  selectMaintenanceLoading,
  selectMaintenanceRequests
} from 'store/maintenance/maintenance.selector';
import { setProperty } from 'store/property/property.action';
import { selectProperties, selectProperty } from 'store/property/property.selector';

const NAVY = '#061e35';
const PAGE_SIZE = 10;
const ACTIVE_STATUSES = ['reported', 'acknowledged', 'awaitingapproval', 'assigned', 'scheduled', 'inprogress', 'awaitingtenant'];
const BOARD_COLUMNS = [
  { key: 'reported', label: 'Reported', color: '#dc2626' },
  { key: 'acknowledged', label: 'Acknowledged', color: '#d97706' },
  { key: 'awaitingapproval', label: 'Awaiting approval', color: '#c2410c' },
  { key: 'assigned', label: 'Assigned', color: '#0891b2' },
  { key: 'scheduled', label: 'Scheduled', color: '#2563eb' },
  { key: 'inprogress', label: 'In progress', color: '#7c3aed' },
  { key: 'awaitingtenant', label: 'Awaiting tenant', color: '#0f766e' },
  { key: 'resolved', label: 'Resolved', color: '#16a34a' }
];
const STATUS_OPTIONS = BOARD_COLUMNS.map(({ key, label }) => ({ key, label }));
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

const normalizeToken = (value) => String(value ?? '').trim().toLowerCase().replace(/[-_\s]/g, '');

function normalizeStatus(value) {
  const status = normalizeToken(value);
  if (['reported', 'open', 'notstarted'].includes(status)) return 'reported';
  if (['acknowledged', 'triaged', 'pending', 'onhold'].includes(status)) return 'acknowledged';
  if (status === 'awaitingapproval') return 'awaitingapproval';
  if (status === 'assigned') return 'assigned';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'inprogress') return 'inprogress';
  if (status === 'awaitingtenant') return 'awaitingtenant';
  if (['resolved', 'completed', 'closed', 'cancelled', 'canceled'].includes(status)) return 'resolved';
  return 'reported';
}

function getCategory(request) {
  const category = request?.category;
  if (typeof category === 'string') return category;
  return category?.name || category?.value || category?.Value || 'General repair';
}

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAssignment(request) {
  const memberAssigned = Number(request?.assignedToType) === 4 || Boolean(request?.assignedToUserId);
  if (memberAssigned && request?.assignedContactName) return { name: request.assignedContactName, type: 'Team member' };
  if (request?.vendorName) return { name: request.vendorName, type: 'Vendor' };
  if (request?.assignedContactName) return { name: request.assignedContactName, type: 'Assigned' };
  return null;
}

function getPropertyLabel(request, properties) {
  const property = properties?.find((item) => Number(item.id) === Number(request?.propertyId));
  const propertyName = property?.name?.trim() || property?.streetAddress?.trim() || request?.propertyName || 'Property not set';
  return request?.unitName ? `${propertyName} · ${request.unitName}` : propertyName;
}

function getAge(value) {
  if (!value) return 'Date not set';
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return 'Date not set';
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
  if (days === 0) return 'Reported today';
  if (days === 1) return 'Reported 1 day ago';
  return `Reported ${days} days ago`;
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusPresentation(status) {
  const normalized = normalizeStatus(status);
  return BOARD_COLUMNS.find((column) => column.key === normalized) || BOARD_COLUMNS[0];
}

function priorityColor(priority, theme) {
  const normalized = normalizeToken(priority);
  if (normalized === 'high') return theme.palette.error.main;
  if (normalized === 'medium') return theme.palette.warning.main;
  return theme.palette.success.main;
}

function StatusChip({ status }) {
  const theme = useTheme();
  const view = statusPresentation(status);
  return (
    <Chip
      label={view.label}
      size="small"
      sx={{ height: 23, fontWeight: 700, fontSize: '0.68rem', bgcolor: alpha(view.color, 0.1), color: view.color, border: `1px solid ${alpha(view.color, 0.22)}` }}
    />
  );
}

function PriorityChip({ priority }) {
  const theme = useTheme();
  const color = priorityColor(priority, theme);
  return (
    <Chip
      label={titleCase(priority || 'Low')}
      size="small"
      sx={{ height: 23, fontWeight: 700, fontSize: '0.68rem', bgcolor: alpha(color, 0.1), color, border: `1px solid ${alpha(color, 0.22)}` }}
    />
  );
}

function MetricCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%', minHeight: 112, p: 2, borderRadius: 2.5, font: 'inherit', color: 'text.primary', textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${active ? alpha(color, 0.5) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha(NAVY, 0.05)}`,
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.4), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.25)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Box minWidth={0}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ mt: 0.5, fontSize: '1.5rem', lineHeight: 1.15, fontWeight: 800 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function MaintenanceRow({ request, properties, onOpen, onActions }) {
  const theme = useTheme();
  const assignment = getAssignment(request);
  const scheduled = formatDate(request.scheduledDate);
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen(request)}
      sx={{
        width: '100%', px: { xs: 1.5, md: 2 }, py: { xs: 1.55, md: 1.35 }, border: 0, bgcolor: 'transparent', color: 'text.primary', textAlign: 'left', font: 'inherit', cursor: 'pointer',
        display: { xs: 'block', md: 'grid' }, gridTemplateColumns: 'minmax(250px, 1.35fr) minmax(190px, 1fr) minmax(145px, .72fr) minmax(150px, .78fr) 44px',
        gap: { xs: 1.15, md: 2 }, alignItems: 'center', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.025) },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.4)}`, outlineOffset: -2 }
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 39, height: 39, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><ToolOutlined /></Avatar>
        <Box minWidth={0}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography sx={{ fontSize: '0.69rem', fontWeight: 750, color: 'primary.main' }}>{request.orderNumber || `MR-${request.id}`}</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>· {titleCase(getCategory(request))}</Typography>
          </Stack>
          <Typography fontWeight={720} noWrap>{request.title || 'Untitled maintenance request'}</Typography>
        </Box>
      </Stack>
      <Box minWidth={0}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 650 }} noWrap>{getPropertyLabel(request, properties)}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{getAge(request.createdAt)}</Typography>
      </Box>
      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap><PriorityChip priority={request.priority} /><StatusChip status={request.status} /></Stack>
      <Box minWidth={0}>
        {assignment ? (
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Avatar sx={{ width: 25, height: 25, fontSize: '0.7rem', bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.main' }}>{assignment.name[0]?.toUpperCase()}</Avatar>
            <Box minWidth={0}><Typography sx={{ fontSize: '0.78rem', fontWeight: 650 }} noWrap>{assignment.name}</Typography><Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{assignment.type}</Typography></Box>
          </Stack>
        ) : <Typography sx={{ fontSize: '0.76rem', fontWeight: 650, color: 'warning.dark' }}>Unassigned</Typography>}
        {scheduled && <Typography sx={{ mt: 0.3, fontSize: '0.68rem', color: 'text.secondary' }}>Scheduled {scheduled}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Request actions"><IconButton size="small" aria-label={`Actions for ${request.title || 'maintenance request'}`} onClick={(event) => { event.stopPropagation(); onActions(event, request); }}><MoreOutlined /></IconButton></Tooltip>
      </Box>
    </Box>
  );
}

export default function Maintenances() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setMaintenancesLoading } = useDashboardLoading();
  const requests = useSelector(selectMaintenanceRequests) || [];
  const historyRequests = useSelector(selectHistoryMaintenances) || [];
  const maintenanceLoading = useSelector(selectMaintenanceLoading);
  const properties = useSelector(selectProperties) || [];
  const selectedProperty = useSelector(selectProperty);
  const { propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const { refetch, loadError } = useFetchMaintenances();

  const [scope, setScope] = useState('active');
  const [metric, setMetric] = useState('open');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionRequest, setActionRequest] = useState(null);

  const busy = loading || propertiesLoading || maintenanceLoading;

  useEffect(() => setMaintenancesLoading(busy), [busy, setMaintenancesLoading]);

  useEffect(() => {
    setLoading(true);
    Promise.all([propertiesRefetch(), refetch()]).finally(() => setLoading(false));
  }, [propertiesRefetch, refetch]);

  useEffect(() => {
    const propertyId = Number(searchParams.get('propertyId'));
    if (propertyId && properties.length) dispatch(setProperty(properties.find((property) => Number(property.id) === propertyId) || null));
    else if (!searchParams.get('propertyId')) dispatch(setProperty(null));
  }, [dispatch, properties, searchParams]);

  useEffect(() => {
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    if (status) {
      const normalized = normalizeStatus(status);
      setStatusFilter(normalized);
      if (normalized === 'resolved') setScope('resolved');
    }
    if (priority) setPriorityFilter(normalizeToken(priority));
  }, [searchParams]);

  const allRequests = useMemo(() => {
    const map = new Map();
    [...requests, ...historyRequests].forEach((request) => map.set(String(request.id), request));
    return [...map.values()];
  }, [requests, historyRequests]);

  const kpis = useMemo(() => {
    const active = allRequests.filter((request) => ACTIVE_STATUSES.includes(normalizeStatus(request.status)));
    return {
      open: active.length,
      triage: active.filter((request) => normalizeStatus(request.status) === 'reported').length,
      unassigned: active.filter((request) => !getAssignment(request)).length,
      high: active.filter((request) => normalizeToken(request.priority) === 'high').length
    };
  }, [allRequests]);

  const categories = useMemo(() => [...new Set(allRequests.map(getCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [allRequests]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = allRequests.filter((request) => {
      const status = normalizeStatus(request.status);
      const active = ACTIVE_STATUSES.includes(status);
      if (scope === 'active' && !active) return false;
      if (scope === 'resolved' && active) return false;
      if (selectedProperty?.id && Number(request.propertyId) !== Number(selectedProperty.id)) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (priorityFilter !== 'all' && normalizeToken(request.priority) !== priorityFilter) return false;
      if (categoryFilter !== 'all' && getCategory(request) !== categoryFilter) return false;
      const assignment = getAssignment(request);
      if (assignmentFilter === 'unassigned' && assignment) return false;
      if (assignmentFilter === 'vendor' && assignment?.type !== 'Vendor') return false;
      if (assignmentFilter === 'team' && assignment?.type !== 'Team member') return false;
      if (metric === 'triage' && status !== 'reported') return false;
      if (metric === 'unassigned' && assignment) return false;
      if (metric === 'high' && normalizeToken(request.priority) !== 'high') return false;
      if (query) {
        const haystack = [request.orderNumber, request.title, request.description, request.propertyName, request.unitName, getCategory(request), assignment?.name].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    const priorityRank = { high: 0, medium: 1, low: 2 };
    const statusRank = { reported: 0, acknowledged: 1, scheduled: 2, inprogress: 3, resolved: 4 };
    return filtered.sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sort === 'status') return statusRank[normalizeStatus(a.status)] - statusRank[normalizeStatus(b.status)];
      const priorityDifference = (priorityRank[normalizeToken(a.priority)] ?? 9) - (priorityRank[normalizeToken(b.priority)] ?? 9);
      return priorityDifference || new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  }, [allRequests, assignmentFilter, categoryFilter, metric, priorityFilter, scope, search, selectedProperty, sort, statusFilter]);

  useEffect(() => setPage(1), [assignmentFilter, categoryFilter, metric, priorityFilter, scope, search, selectedProperty, sort, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(visibleRequests.length / PAGE_SIZE));
  const paginated = visibleRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const clearFilters = () => {
    setScope('active'); setMetric('open'); setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); setCategoryFilter('all'); setAssignmentFilter('all'); dispatch(setProperty(null));
  };

  const openActions = (event, request) => { setActionAnchor(event.currentTarget); setActionRequest(request); };
  const closeActions = () => { setActionAnchor(null); };
  const runAction = (callback) => { closeActions(); callback(); };

  const activeFilterCount = [statusFilter, priorityFilter, categoryFilter, assignmentFilter].filter((value) => value !== 'all').length + (selectedProperty ? 1 : 0);
  const pageStart = visibleRequests.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(page * PAGE_SIZE, visibleRequests.length);

  return (
    <Box>
      {loadError && <Alert severity="warning" sx={{ mb: 2 }}>{loadError} Existing maintenance data has been left visible.</Alert>}
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Maintenance' }]} />

      <Box sx={{ mt: 2, mb: 3, p: { xs: 2.25, md: 3 }, borderRadius: 3, color: '#fff', background: `linear-gradient(125deg, ${NAVY} 0%, #0b3555 100%)`, boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2.5}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 780 }}>Maintenance</Typography>
            <Typography sx={{ mt: 0.7, maxWidth: 650, color: alpha('#fff', 0.76), fontSize: { xs: '0.84rem', md: '0.92rem' } }}>Triage requests, coordinate vendors, and keep repairs moving across your portfolio.</Typography>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1.5 }}><RobotOutlined /><Typography sx={{ fontSize: '0.74rem', color: alpha('#fff', 0.75) }}>{kpis.triage ? `${kpis.triage} ${kpis.triage === 1 ? 'request needs' : 'requests need'} review` : 'No requests are waiting for initial review'}</Typography></Stack>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<ShopOutlined />} onClick={() => navigate('/landlord/vendors')} sx={{ color: '#fff', borderColor: alpha('#fff', 0.38), textTransform: 'none', '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}>Vendors</Button>
            <Button variant="outlined" startIcon={<SettingOutlined />} onClick={() => navigate('/landlord/ai-center/maintenance-agent')} sx={{ color: '#fff', borderColor: alpha('#fff', 0.38), textTransform: 'none', '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}>Agent settings</Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'open', label: 'Open requests', value: kpis.open, helper: 'All work still in motion', icon: <ToolOutlined />, color: theme.palette.primary.main },
          { key: 'triage', label: 'Needs triage', value: kpis.triage, helper: 'Recently submitted requests', icon: <ClockCircleOutlined />, color: theme.palette.warning.main },
          { key: 'unassigned', label: 'Unassigned', value: kpis.unassigned, helper: 'Needs a vendor or team member', icon: <UserOutlined />, color: theme.palette.info.main },
          { key: 'high', label: 'High priority', value: kpis.high, helper: 'Active urgent requests', icon: <ExclamationCircleOutlined />, color: theme.palette.error.main }
        ].map(({ key, ...cardProps }) => <Grid key={key} size={{ xs: 12, sm: 6, lg: 3 }}><MetricCard {...cardProps} active={metric === key && scope === 'active'} onClick={() => { setScope('active'); setMetric(key); }} /></Grid>)}
      </Grid>

      <Box sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, bgcolor: 'background.paper', boxShadow: `0 6px 24px ${alpha(NAVY, 0.055)}`, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.15} alignItems={{ lg: 'center' }}>
            <OutlinedInput size="small" placeholder="Search requests, properties, vendors..." value={search} onChange={(event) => setSearch(event.target.value)} startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>} sx={{ width: { xs: '100%', lg: 310 } }} />
            <FormControl size="small" sx={{ minWidth: 150 }}><Select value={selectedProperty?.id || ''} displayEmpty onChange={(event) => dispatch(setProperty(properties.find((property) => Number(property.id) === Number(event.target.value)) || null))}><MenuItem value="">All properties</MenuItem>{properties.map((property) => <MenuItem key={property.id} value={property.id}>{property.name?.trim() || property.streetAddress?.trim() || `Property ${property.id}`}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 125 }}><Select value={scope} onChange={(event) => { setScope(event.target.value); setMetric('open'); }}><MenuItem value="active">Active</MenuItem><MenuItem value="resolved">Resolved</MenuItem><MenuItem value="all">All requests</MenuItem></Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}><Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="all">All statuses</MenuItem>{STATUS_OPTIONS.map((option) => <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 125 }}><Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><MenuItem value="all">All priorities</MenuItem>{PRIORITY_OPTIONS.map((priority) => <MenuItem key={priority} value={priority}>{titleCase(priority)}</MenuItem>)}</Select></FormControl>
            <Box sx={{ flex: 1 }} />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }} sx={{ mt: 1.15 }}>
            <FormControl size="small" sx={{ minWidth: 155 }}><Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><MenuItem value="all">All categories</MenuItem>{categories.map((category) => <MenuItem key={category} value={category}>{titleCase(category)}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 145 }}><Select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}><MenuItem value="all">All assignments</MenuItem><MenuItem value="unassigned">Unassigned</MenuItem><MenuItem value="vendor">Vendor</MenuItem><MenuItem value="team">Team member</MenuItem></Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}><Select value={sort} onChange={(event) => setSort(event.target.value)}><MenuItem value="priority">Priority · oldest</MenuItem><MenuItem value="oldest">Oldest first</MenuItem><MenuItem value="newest">Newest first</MenuItem><MenuItem value="status">Workflow status</MenuItem></Select></FormControl>
            <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>{visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'}{activeFilterCount ? ` · ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'} active` : ''}</Typography>
            {(activeFilterCount > 0 || search || scope !== 'active' || metric !== 'open') && <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>Clear filters</Button>}
          </Stack>
        </Box>

        {busy ? <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : visibleRequests.length === 0 ? (
          <Box sx={{ py: 8, px: 2, textAlign: 'center' }}><Avatar sx={{ mx: 'auto', mb: 1.5, width: 52, height: 52, bgcolor: alpha(theme.palette.primary.main, 0.09), color: 'primary.main' }}><ToolOutlined /></Avatar><Typography variant="h6">No matching maintenance requests</Typography><Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: '0.82rem' }}>{allRequests.length ? 'Try clearing or changing the current filters.' : 'Tenant-submitted requests will appear here for review.'}</Typography>{allRequests.length && <Button variant="contained" startIcon={<SearchOutlined />} onClick={clearFilters} sx={{ mt: 2, textTransform: 'none' }}>Clear filters</Button>}</Box>
        ) : (
          <>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(250px, 1.35fr) minmax(190px, 1fr) minmax(145px, .72fr) minmax(150px, .78fr) 44px', gap: 2, px: 2, py: 1, bgcolor: alpha(theme.palette.background.default, 0.55), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>{['Request', 'Property & timing', 'Priority & status', 'Assigned to', ''].map((label) => <Typography key={label} sx={{ fontSize: '0.66rem', fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.55 }}>{label}</Typography>)}</Box>
            {paginated.map((request) => <MaintenanceRow key={request.id} request={request} properties={properties} onOpen={(item) => navigate(`/landlord/maintenance/${item.id}`)} onActions={openActions} />)}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2 }}><Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>Showing {pageStart}–{pageEnd} of {visibleRequests.length}</Typography><Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} size="small" color="primary" /></Stack>
          </>
        )}
      </Box>

      <Menu anchorEl={actionAnchor} open={Boolean(actionAnchor)} onClose={closeActions}>
        <MenuItem onClick={() => runAction(() => navigate(`/landlord/maintenance/${actionRequest.id}`))}><EyeOutlined style={{ marginRight: 10 }} />Open request details</MenuItem>
        <MenuItem onClick={() => runAction(() => navigate(`/landlord/maintenance/${actionRequest.id}`))}><ToolOutlined style={{ marginRight: 10 }} />Open workflow actions</MenuItem>
      </Menu>
    </Box>
  );
}
