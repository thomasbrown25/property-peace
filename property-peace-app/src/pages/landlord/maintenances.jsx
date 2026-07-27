import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  alpha,
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
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  UserOutlined
} from '@ant-design/icons';
import { DndContext, DragOverlay, closestCenter, pointerWithin, useDraggable, useDroppable } from '@dnd-kit/core';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import MaintenanceEditDrawer from 'components/drawers/MaintenanceEditDrawer';
import VendorAssignDrawer from 'components/drawers/VendorAssignDrawer';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { useDrawer } from 'contexts/DrawerContext';
import { openSnackbar } from 'api/snackbar';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import useFetchProperties from 'hooks/useFetchProperties';
import {
  deleteMaintenance,
  reopenMaintenanceRequest,
  resolveMaintenanceRequest,
  updateMaintenance
} from 'store/maintenance/maintenance.action';
import {
  selectHistoryMaintenances,
  selectMaintenanceLoading,
  selectMaintenanceRequests
} from 'store/maintenance/maintenance.selector';
import { setProperty } from 'store/property/property.action';
import { selectProperties, selectProperty } from 'store/property/property.selector';

const NAVY = '#061e35';
const PAGE_SIZE = 10;
const ACTIVE_STATUSES = ['reported', 'acknowledged', 'scheduled', 'inprogress'];
const BOARD_COLUMNS = [
  { key: 'reported', label: 'Reported', color: '#dc2626' },
  { key: 'acknowledged', label: 'Acknowledged', color: '#d97706' },
  { key: 'scheduled', label: 'Scheduled', color: '#2563eb' },
  { key: 'inprogress', label: 'In progress', color: '#7c3aed' },
  { key: 'resolved', label: 'Resolved', color: '#16a34a' }
];
const STATUS_OPTIONS = BOARD_COLUMNS.map(({ key, label }) => ({ key, label }));
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

const normalizeToken = (value) => String(value ?? '').trim().toLowerCase().replace(/[-_\s]/g, '');

function normalizeStatus(value) {
  const status = normalizeToken(value);
  if (['reported', 'open', 'notstarted'].includes(status)) return 'reported';
  if (['acknowledged', 'triaged', 'pending', 'onhold'].includes(status)) return 'acknowledged';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'inprogress') return 'inprogress';
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

function ViewToggle({ value, onChange }) {
  return (
    <Stack direction="row" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.35, bgcolor: 'background.paper' }}>
      <Button size="small" variant={value === 'list' ? 'contained' : 'text'} startIcon={<UnorderedListOutlined />} onClick={() => onChange('list')} sx={{ minWidth: 86, textTransform: 'none', borderRadius: 1.5 }}>List</Button>
      <Button size="small" variant={value === 'board' ? 'contained' : 'text'} startIcon={<AppstoreOutlined />} onClick={() => onChange('board')} sx={{ minWidth: 90, textTransform: 'none', borderRadius: 1.5 }}>Board</Button>
    </Stack>
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

function BoardCard({ request, properties, onOpen, onActions, overlay = false }) {
  const theme = useTheme();
  const assignment = getAssignment(request);
  const content = (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <PriorityChip priority={request.priority} />
        {!overlay && <IconButton size="small" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onActions(event, request); }}><MoreOutlined /></IconButton>}
      </Stack>
      <Typography sx={{ mt: 1, fontSize: '0.68rem', fontWeight: 750, color: 'primary.main' }}>{request.orderNumber || `MR-${request.id}`}</Typography>
      <Typography sx={{ mt: 0.25, fontWeight: 720, lineHeight: 1.35 }} display="-webkit-box" overflow="hidden" style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{request.title || 'Untitled maintenance request'}</Typography>
      <Typography sx={{ mt: 0.65, fontSize: '0.73rem', color: 'text.secondary' }} noWrap>{getPropertyLabel(request, properties)}</Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.1 }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{getAge(request.createdAt).replace('Reported ', '')}</Typography>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 650, color: assignment ? 'text.secondary' : 'warning.dark' }} noWrap>{assignment?.name || 'Unassigned'}</Typography>
      </Stack>
    </>
  );
  if (overlay) return <Box sx={{ width: 250, p: 1.5, bgcolor: 'background.paper', borderRadius: 2, boxShadow: `0 12px 32px ${alpha(NAVY, 0.25)}` }}>{content}</Box>;
  return <DraggableBoardCard request={request} onOpen={onOpen}>{content}</DraggableBoardCard>;
}

function DraggableBoardCard({ request, onOpen, children }) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(request.id) });
  return (
    <Box ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(request)} sx={{ p: 1.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 2, cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.28 : 1, touchAction: 'none', userSelect: 'none', boxShadow: `0 3px 12px ${alpha(NAVY, 0.055)}`, '&:hover': { boxShadow: `0 8px 20px ${alpha(NAVY, 0.1)}` } }}>{children}</Box>
  );
}

function BoardColumn({ column, requests, properties, onOpen, onActions, wide = false }) {
  const theme = useTheme();
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        minWidth: 0,
        minHeight: 430,
        p: 1.25,
        borderRadius: 2.5,
        border: `1px solid ${alpha(column.color, isOver ? 0.48 : 0.2)}`,
        bgcolor: alpha(column.color, isOver ? 0.09 : 0.04),
        transition: 'background-color 150ms ease, border-color 150ms ease'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.4, pb: 1.1, mb: 1.1, borderBottom: `1px solid ${alpha(column.color, 0.16)}` }}>
        <Stack direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: column.color }} /><Typography sx={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.55 }}>{column.label}</Typography></Stack>
        <Chip label={requests.length} size="small" sx={{ height: 20, fontSize: '0.66rem', fontWeight: 750, bgcolor: alpha(column.color, 0.1), color: column.color }} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(235px, 1fr))' : 'minmax(0, 1fr)', gap: 1 }}>
        {requests.map((request) => <BoardCard key={request.id} request={request} properties={properties} onOpen={onOpen} onActions={onActions} />)}
      </Box>
      {requests.length === 0 && <Box sx={{ minHeight: 130, display: 'grid', placeItems: 'center' }}><Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>Drop a request here</Typography></Box>}
    </Box>
  );
}

export default function Maintenances() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [searchParams] = useSearchParams();
  const { setMaintenancesLoading } = useDashboardLoading();
  const requests = useSelector(selectMaintenanceRequests) || [];
  const historyRequests = useSelector(selectHistoryMaintenances) || [];
  const maintenanceLoading = useSelector(selectMaintenanceLoading);
  const properties = useSelector(selectProperties) || [];
  const selectedProperty = useSelector(selectProperty);
  const { propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const { refetch } = useFetchMaintenances();

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('maintenanceViewMode') || 'list');
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
  const [statusMenuPosition, setStatusMenuPosition] = useState(null);
  const [priorityMenuPosition, setPriorityMenuPosition] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [optimisticStatus, setOptimisticStatus] = useState({});

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

  useEffect(() => {
    if (isMobile && viewMode === 'board') setViewMode('list');
  }, [isMobile, viewMode]);

  const changeView = (next) => {
    setViewMode(next);
    localStorage.setItem('maintenanceViewMode', next);
  };

  const allRequests = useMemo(() => {
    const map = new Map();
    [...requests, ...historyRequests].forEach((request) => {
      const next = optimisticStatus[request.id] ? { ...request, status: optimisticStatus[request.id] } : request;
      map.set(String(request.id), next);
    });
    return [...map.values()];
  }, [requests, historyRequests, optimisticStatus]);

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

  const showSuccess = (message) => openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'success', variant: 'filled' }, close: true });
  const showError = (message) => openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'error', variant: 'filled' }, close: true });

  const buildUpdatePayload = (request, updates = {}) => ({
    id: request.id,
    title: request.title || '',
    unitName: request.unitName || '',
    status: request.status,
    priority: request.priority,
    description: request.description || '',
    categoryId: request.categoryId || 0,
    imageUrl: request.imageUrl || '',
    completedAt: request.completedAt || null,
    scheduledDate: request.scheduledDate || null,
    vendorId: request.vendorId || null,
    assignedToType: request.assignedToType || 0,
    assignedToUserId: request.assignedToUserId || null,
    assignedContactName: request.assignedContactName || null,
    assignedContactPhone: request.assignedContactPhone || null,
    assignedContactEmail: request.assignedContactEmail || null,
    assignedAt: request.assignedAt || null,
    assignedByUserId: request.assignedByUserId || null,
    ...updates
  });

  const changeStatus = useCallback(async (request, target, notify = true) => {
    const current = normalizeStatus(request.status);
    if (current === target) return;
    const backendStatus = { reported: 'Reported', acknowledged: 'Acknowledged', scheduled: 'Scheduled', inprogress: 'InProgress', resolved: 'Resolved' }[target];
    setOptimisticStatus((currentValues) => ({ ...currentValues, [request.id]: backendStatus }));
    try {
      if (target === 'resolved') await dispatch(resolveMaintenanceRequest(request.id));
      else if (current === 'resolved') {
        await dispatch(reopenMaintenanceRequest(request.id));
        if (target !== 'reported') await dispatch(updateMaintenance(buildUpdatePayload(request, { status: backendStatus, completedAt: null })));
      } else await dispatch(updateMaintenance(buildUpdatePayload(request, { status: backendStatus, completedAt: null })));
      await refetch();
      if (notify) showSuccess(`Request moved to ${statusPresentation(backendStatus).label}`);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Failed to update request status');
    } finally {
      setOptimisticStatus((currentValues) => { const next = { ...currentValues }; delete next[request.id]; return next; });
    }
  }, [dispatch, refetch]);

  const changePriority = async (request, priority) => {
    try {
      await dispatch(updateMaintenance(buildUpdatePayload(request, { priority: titleCase(priority) })));
      await refetch();
      showSuccess(`Priority updated to ${titleCase(priority)}`);
    } catch (error) { showError(error?.response?.data?.message || error?.message || 'Failed to update priority'); }
  };

  const openActions = (event, request) => { setActionAnchor(event.currentTarget); setActionRequest(request); };
  const closeActions = () => { setActionAnchor(null); };
  const runAction = (callback) => { closeActions(); callback(); };

  const confirmDelete = async () => {
    if (!actionRequest) return;
    setDeleteOpen(false);
    try { await dispatch(deleteMaintenance(actionRequest.id)); await refetch(); showSuccess('Maintenance request deleted'); }
    catch (error) { showError(error?.response?.data?.message || error?.message || 'Failed to delete maintenance request'); }
  };

  const handleDragEnd = async ({ active, over }) => {
    setDragId(null);
    if (!over) return;
    const request = visibleRequests.find((item) => String(item.id) === String(active.id));
    if (request && BOARD_COLUMNS.some((column) => column.key === over.id)) await changeStatus(request, over.id, false);
  };

  const activeFilterCount = [statusFilter, priorityFilter, categoryFilter, assignmentFilter].filter((value) => value !== 'all').length + (selectedProperty ? 1 : 0);
  const pageStart = visibleRequests.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(page * PAGE_SIZE, visibleRequests.length);
  const boardColumns = BOARD_COLUMNS.filter((column) => scope === 'all' || (scope === 'active' ? column.key !== 'resolved' : column.key === 'resolved'));

  return (
    <Box>
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
            <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openMaintenanceAddDrawer()} sx={{ textTransform: 'none', fontWeight: 750 }}>New request</Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'open', label: 'Open requests', value: kpis.open, helper: 'All work still in motion', icon: <ToolOutlined />, color: theme.palette.primary.main },
          { key: 'triage', label: 'Needs triage', value: kpis.triage, helper: 'New requests to review', icon: <ClockCircleOutlined />, color: theme.palette.warning.main },
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
            {!isMobile && <ViewToggle value={viewMode} onChange={changeView} />}
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
          <Box sx={{ py: 8, px: 2, textAlign: 'center' }}><Avatar sx={{ mx: 'auto', mb: 1.5, width: 52, height: 52, bgcolor: alpha(theme.palette.primary.main, 0.09), color: 'primary.main' }}><ToolOutlined /></Avatar><Typography variant="h6">No matching maintenance requests</Typography><Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: '0.82rem' }}>{allRequests.length ? 'Try clearing or changing the current filters.' : 'Create your first request to start tracking repairs.'}</Typography><Button variant="contained" startIcon={allRequests.length ? <SearchOutlined /> : <PlusOutlined />} onClick={allRequests.length ? clearFilters : () => drawer.openMaintenanceAddDrawer()} sx={{ mt: 2, textTransform: 'none' }}>{allRequests.length ? 'Clear filters' : 'New request'}</Button></Box>
        ) : viewMode === 'list' || isMobile ? (
          <>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(250px, 1.35fr) minmax(190px, 1fr) minmax(145px, .72fr) minmax(150px, .78fr) 44px', gap: 2, px: 2, py: 1, bgcolor: alpha(theme.palette.background.default, 0.55), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>{['Request', 'Property & timing', 'Priority & status', 'Assigned to', ''].map((label) => <Typography key={label} sx={{ fontSize: '0.66rem', fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.55 }}>{label}</Typography>)}</Box>
            {paginated.map((request) => <MaintenanceRow key={request.id} request={request} properties={properties} onOpen={(item) => navigate(`/landlord/maintenance/${item.id}`)} onActions={openActions} />)}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2 }}><Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>Showing {pageStart}–{pageEnd} of {visibleRequests.length}</Typography><Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} size="small" color="primary" /></Stack>
          </>
        ) : (
          <DndContext collisionDetection={(args) => pointerWithin(args).length ? pointerWithin(args) : closestCenter(args)} onDragStart={({ active }) => setDragId(active.id)} onDragCancel={() => setDragId(null)} onDragEnd={handleDragEnd}>
            <Box sx={{ overflowX: 'auto', p: 2, bgcolor: alpha(theme.palette.background.default, 0.42) }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${boardColumns.length}, minmax(260px, 1fr))`,
                  gap: 1.5,
                  minWidth: boardColumns.length > 1 ? boardColumns.length * 276 : '100%',
                  alignItems: 'stretch'
                }}
              >
                {boardColumns.map((column) => (
                  <BoardColumn
                    key={column.key}
                    column={column}
                    requests={visibleRequests.filter((request) => normalizeStatus(request.status) === column.key)}
                    properties={properties}
                    onOpen={(item) => navigate(`/landlord/maintenance/${item.id}`)}
                    onActions={openActions}
                    wide={boardColumns.length === 1}
                  />
                ))}
              </Box>
            </Box>
            <DragOverlay>{dragId ? <BoardCard overlay request={visibleRequests.find((item) => String(item.id) === String(dragId))} properties={properties} onOpen={() => {}} onActions={() => {}} /> : null}</DragOverlay>
          </DndContext>
        )}
      </Box>

      <Menu anchorEl={actionAnchor} open={Boolean(actionAnchor)} onClose={closeActions}>
        <MenuItem onClick={() => runAction(() => navigate(`/landlord/maintenance/${actionRequest.id}`))}><EyeOutlined style={{ marginRight: 10 }} />View details</MenuItem>
        <MenuItem onClick={() => runAction(() => drawer.openMaintenanceEditDrawer(actionRequest))}><EditOutlined style={{ marginRight: 10 }} />Edit request</MenuItem>
        <MenuItem onClick={() => runAction(() => drawer.openVendorAssignDrawer(actionRequest, refetch))}><ShopOutlined style={{ marginRight: 10 }} />{getAssignment(actionRequest) ? 'Change assignment' : 'Assign vendor or team'}</MenuItem>
        <MenuItem onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setStatusMenuPosition({ top: rect.top, left: rect.right }); setActionAnchor(null); }}><CheckCircleOutlined style={{ marginRight: 10 }} />Change status</MenuItem>
        <MenuItem onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPriorityMenuPosition({ top: rect.top, left: rect.right }); setActionAnchor(null); }}><ExclamationCircleOutlined style={{ marginRight: 10 }} />Change priority</MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => runAction(() => setDeleteOpen(true))}><DeleteOutlined style={{ marginRight: 10 }} />Delete</MenuItem>
      </Menu>
      <Menu anchorReference="anchorPosition" anchorPosition={statusMenuPosition} open={Boolean(statusMenuPosition)} onClose={() => setStatusMenuPosition(null)}>{STATUS_OPTIONS.map((option) => <MenuItem key={option.key} selected={actionRequest && normalizeStatus(actionRequest.status) === option.key} onClick={() => { setStatusMenuPosition(null); changeStatus(actionRequest, option.key); }}><StatusChip status={option.key} /></MenuItem>)}</Menu>
      <Menu anchorReference="anchorPosition" anchorPosition={priorityMenuPosition} open={Boolean(priorityMenuPosition)} onClose={() => setPriorityMenuPosition(null)}>{PRIORITY_OPTIONS.map((priority) => <MenuItem key={priority} selected={actionRequest && normalizeToken(actionRequest.priority) === priority} onClick={() => { setPriorityMenuPosition(null); changePriority(actionRequest, priority); }}><PriorityChip priority={priority} /></MenuItem>)}</Menu>

      <ConfirmationDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} title="Delete maintenance request?" message={`Delete “${actionRequest?.title || 'this request'}”? This action cannot be undone.`} confirmText="Delete request" confirmColor="error" />
      <LandlordMaintenanceDrawer onAddSuccess={refetch} />
      <MaintenanceEditDrawer maintenance={drawer.selectedMaintenance} onUpdateSuccess={refetch} />
      <VendorAssignDrawer />
    </Box>
  );
}
