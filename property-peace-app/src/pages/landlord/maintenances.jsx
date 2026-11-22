import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  alpha,
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  Link,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import AppIcon from 'components/AppIcon';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import ActionsDrawer from 'components/drawers/shared/ActionsDrawer';
import { creationActionSx, managementPageHeaderActionSx, managementPageHeaderTitleSx } from 'components/headers/managementPageHeaderStyles';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { useDrawer } from 'contexts/DrawerContext';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import useFetchProperties from 'hooks/useFetchProperties';

import {
  selectHistoryMaintenances,
  selectMaintenanceLoading,
  selectMaintenanceRequests
} from 'store/maintenance/maintenance.selector';
import { setProperty } from 'store/property/property.action';
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { getManagementGridTableStyles } from 'themes/tableStyles';
import { maintenanceFilterControlSx, maintenanceFilterGridSx, maintenanceRequestColumns, maintenanceSearchControlSx } from 'utils/maintenanceListLayout';
import { clearMaintenanceListFilters, maintenanceListEmptyMessage, maintenanceScopeFromStatus } from 'utils/maintenanceWorkflow';

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
  { key: 'resolved', label: 'Resolved', color: '#41a541' }
];
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];
const SCOPES = [{ key: 'active', label: 'Active' }, { key: 'resolved', label: 'Resolved' }, { key: 'all', label: 'All requests' }];

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
  const { vendorId, assignedToUserId } = request.assignment || request;
  if (vendorId || (!request.assignment && request.vendorName)) return { name: request.vendorName || `Vendor #${vendorId}`, type: 'Vendor' };
  if (assignedToUserId || (Number(request.assignedToType) === 4 && request.assignedContactName)) {
    return { name: request.assignedContactName || `Team member #${assignedToUserId}`, type: 'Team member' };
  }
  if (request?.assignedContactName) return { name: request.assignedContactName, type: 'Assigned' };
  return null;
}

function getRequestLocation(request, property) {
  const unit = request.unitId && property?.units?.find((item) => String(item.id) === String(request.unitId));
  return [property?.name?.trim() || property?.streetAddress?.trim() || request.propertyName || 'Property not set', request.unitName || unit?.name].filter(Boolean).join(' · ');
}

const reportedAt = (request) => request.createdAtUtc || request.createdAt;

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusPresentation(status) {
  if (['cancelled', 'canceled'].includes(normalizeToken(status))) return { label: 'Cancelled', color: '#64748b' };
  const normalized = normalizeStatus(status);
  return BOARD_COLUMNS.find((column) => column.key === normalized) || BOARD_COLUMNS[0];
}

function priorityColor(priority, theme) {
  const normalized = normalizeToken(priority);
  if (normalized === 'high') return theme.palette.error.main;
  if (normalized === 'medium') return theme.palette.warning.main;
  return theme.palette.text.secondary;
}

function StatusChip({ status }) {
  const view = statusPresentation(status);
  return (
    <RequestPill color={view.color}>{view.label}</RequestPill>
  );
}

function PriorityChip({ priority }) {
  const theme = useTheme();
  const color = priorityColor(priority, theme);
  return (
    <RequestPill color={color}>{priority ? `${titleCase(priority)} priority` : 'Priority not set'}</RequestPill>
  );
}

function RequestPill({ children, color }) {
  return (
    <Typography component="span" variant="caption" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 0.85, py: 0.3, borderRadius: 10,
      bgcolor: alpha(color, 0.09), border: `1px solid ${alpha(color, 0.24)}`, fontWeight: 650, lineHeight: 1.4
    }}>
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
      {children}
    </Typography>
  );
}

function MetricCard({ label, value, icon, tone, active, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={onClick}
      sx={(theme) => ({
        display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, width: '100%', height: '100%', minHeight: 76,
        p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, font: 'inherit', color: 'text.primary', textAlign: 'left', cursor: 'pointer',
        border: '1px solid', borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'surface.nested' : 'background.paper',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'surface.nested' },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 }
      })}
    >
      <Box component="span" sx={(theme) => ({
        display: 'grid', placeItems: 'center', flexShrink: 0, width: { xs: 30, sm: 38 }, height: { xs: 30, sm: 38 }, borderRadius: 1.25,
        bgcolor: alpha(theme.palette[tone].main, 0.12), color: `${tone}.main`
      })}><AppIcon name={icon} size={18} /></Box>
      <Box component="span" minWidth={0}>
        <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: 650, color: 'text.secondary', lineHeight: 1.3 }}>{label}</Typography>
        <Typography component="span" sx={{ display: 'block', mt: 0.25, fontSize: '1.4rem', lineHeight: 1.15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      </Box>
    </Box>
  );
}

function FilterSelect({ label, children, ...props }) {
  return (
    <Select size="small" SelectDisplayProps={{ 'aria-label': label }} sx={maintenanceFilterControlSx} {...props}>
      {children}
    </Select>
  );
}

function MaintenanceRow({ request, property, rowSx }) {
  const navigate = useNavigate();
  const assignment = getAssignment(request);
  const scheduled = formatDate(request.scheduledDate);
  const reported = formatDate(reportedAt(request));
  const requestPath = `/landlord/maintenance/${request.id}`;
  const title = request.title || 'Untitled maintenance request';
  const actions = [
    { label: 'Open request details', description: 'View the request summary and maintenance history.', icon: 'document', onSelect: () => navigate(requestPath) },
    { label: 'Open workflow actions', description: 'Go directly to assignment, scheduling, and status controls.', icon: 'maintenance', onSelect: () => navigate(requestPath, { state: { openMaintenanceActions: true } }) }
  ];
  return (
    <Box component="li" sx={{
      ...rowSx,
      position: 'relative', display: 'grid',
      gridTemplateColumns: { xs: 'minmax(0, 1fr) minmax(0, 1fr) 36px', md: maintenanceRequestColumns },
      gridTemplateAreas: { xs: '"request request action" "status status status" "property assigned assigned"', md: '"request property status assigned action"' },
      gap: { xs: 1.2, md: 2 }, alignItems: { xs: 'start', md: 'center' }
    }}>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ gridArea: 'request', minWidth: 0 }}>
        <Avatar variant="rounded" sx={{ display: { xs: 'none', sm: 'flex' }, width: 38, height: 38, bgcolor: 'surface.nested', color: 'primary.main' }}><AppIcon name="maintenance" size={20} /></Avatar>
        <Box minWidth={0}>
          <Link component={RouterLink} to={requestPath} color="text.primary" underline="hover" sx={{
            fontWeight: 750, lineHeight: 1.4, overflowWrap: 'anywhere',
            '&::after': { content: '""', position: 'absolute', inset: 0 },
            '&:focus-visible::after': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
          }}>{title}</Link>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}>
            {request.orderNumber || `MR-${request.id}`} · {titleCase(getCategory(request))}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ gridArea: 'property', minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>Property</Typography>
        <Typography variant="body2" fontWeight={650}>{getRequestLocation(request, property)}</Typography>
        {reported && <Typography variant="caption" color="text.secondary">Reported {reported}</Typography>}
      </Box>
      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ gridArea: 'status' }}><StatusChip status={request.status} /><PriorityChip priority={request.priority} /></Stack>
      <Box sx={{ gridArea: 'assigned', minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>Assigned to</Typography>
        {assignment ? (
          <Stack gap={0.1}>
            <Typography variant="body2" fontWeight={650}>{assignment.name}</Typography>
            <Typography variant="caption" color="text.secondary">{assignment.type}</Typography>
          </Stack>
        ) : <Typography variant="body2" fontWeight={650}>Unassigned</Typography>}
        {scheduled && <Typography variant="caption" color="text.secondary">Scheduled {scheduled}</Typography>}
      </Box>
      <Box sx={{ gridArea: 'action', justifySelf: 'end', position: 'relative', zIndex: 1 }}>
        <ActionsDrawer id={`maintenance-request-actions-${request.id}`} title="Request actions" triggerLabel={`Actions for ${title}`} actions={actions} iconOnly />
      </Box>
    </Box>
  );
}

export default function Maintenances() {
  const theme = useTheme();
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
  const { refetch, loadError } = useFetchMaintenances();

  const [scope, setScope] = useState('active');
  const [metric, setMetric] = useState('open');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

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
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    if (priority) setPriorityFilter(normalizeToken(priority));
    if (status) setScope(maintenanceScopeFromStatus(status));
  }, [searchParams]);

  const allRequests = useMemo(() => {
    const map = new Map();
    [...requests, ...historyRequests].forEach((request) => map.set(String(request.id), request));
    return [...map.values()];
  }, [requests, historyRequests]);
  const propertiesById = useMemo(() => new Map(properties.map((property) => [String(property.id), property])), [properties]);

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
        const property = propertiesById.get(String(request.propertyId));
        const haystack = [request.orderNumber || `MR-${request.id}`, request.title, request.description,
          getRequestLocation(request, property), property?.streetAddress, getCategory(request), assignment?.name].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return filtered.sort((a, b) => {
      const oldestFirst = (Date.parse(reportedAt(a)) || 0) - (Date.parse(reportedAt(b)) || 0);
      if (sort === 'newest') return -oldestFirst;
      if (sort === 'oldest') return oldestFirst;
      if (sort === 'status') return BOARD_COLUMNS.findIndex(({ key }) => key === normalizeStatus(a.status)) - BOARD_COLUMNS.findIndex(({ key }) => key === normalizeStatus(b.status)) || oldestFirst;
      const priorityDifference = (priorityRank[normalizeToken(a.priority)] ?? 9) - (priorityRank[normalizeToken(b.priority)] ?? 9);
      return priorityDifference || oldestFirst;
    });
  }, [allRequests, assignmentFilter, categoryFilter, metric, priorityFilter, propertiesById, scope, search, selectedProperty, sort]);

  useEffect(() => setPage(1), [assignmentFilter, categoryFilter, metric, priorityFilter, scope, search, selectedProperty, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleRequests.length / PAGE_SIZE));
  const paginated = visibleRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const clearFilters = () => {
    const cleared = clearMaintenanceListFilters({ scope });
    setScope(cleared.scope);
    setMetric('open');
    setSearch(cleared.search);
    setPriorityFilter(cleared.priority);
    setCategoryFilter(cleared.category);
    setAssignmentFilter(cleared.assignment);
    dispatch(setProperty(null));
  };

  const hasRefinements = Boolean(selectedProperty || search || metric !== 'open')
    || [priorityFilter, categoryFilter, assignmentFilter].some((value) => value !== 'all');
  const hasResolvedRequests = allRequests.some((request) => !ACTIVE_STATUSES.includes(normalizeStatus(request.status)));
  const emptyMessage = maintenanceListEmptyMessage({
    hasRequests: allRequests.length > 0,
    hasRefinements,
    scope,
    hasResolvedRequests
  });
  const pageStart = visibleRequests.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(page * PAGE_SIZE, visibleRequests.length);
  const tableStyles = getManagementGridTableStyles(theme);

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 4 }}>
      <Stack
        component="header" direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}
        sx={{ mb: 2.5, bgcolor: 'transparent' }}
      >
        <Typography component="h1" variant="h3" sx={{ ...managementPageHeaderTitleSx, fontWeight: 750, letterSpacing: -0.4 }}>Maintenance</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<AppIcon name="shop" />} onClick={() => navigate('/landlord/vendors')}
            sx={managementPageHeaderActionSx}>Vendors</Button>
          <Button variant="contained" color="primary" startIcon={<AppIcon name="add" />} onClick={() => drawer.openMaintenanceAddDrawer()}
            sx={creationActionSx}>New request</Button>
        </Stack>
      </Stack>

      {loadError && <Alert severity="warning" action={<Button onClick={refetch} color="inherit" size="small">Retry</Button>} sx={{ mb: 2.5 }}>{loadError}</Alert>}

      <Grid container spacing={1.25} sx={{ mb: 3 }}>
        {[
          { key: 'open', label: 'Open requests', icon: 'maintenance', tone: 'primary' },
          { key: 'triage', label: 'Needs triage', icon: 'activity', tone: 'warning' },
          { key: 'unassigned', label: 'Unassigned', icon: 'team', tone: 'info' },
          { key: 'high', label: 'High priority', icon: 'warning', tone: 'error' }
        ].map(({ key, ...cardProps }) => (
          <Grid key={key} size={{ xs: 6, sm: 3 }}>
            <MetricCard {...cardProps} value={kpis[key]} active={metric === key && scope === 'active'} onClick={() => { setScope('active'); setMetric(key); }} />
          </Grid>
        ))}
      </Grid>

      <Box component="section" aria-labelledby="maintenance-requests-heading">
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" gap={1.25} sx={{ mb: 1.5 }}>
          <Typography id="maintenance-requests-heading" component="h2" variant="h5" fontWeight={750}>Requests</Typography>
          <Stack role="group" aria-label="Request scope" direction="row" spacing={0.4}
            sx={{ p: 0.4, maxWidth: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
            {SCOPES.map(({ key, label }) => (
              <Button key={key} color="inherit" size="small" aria-pressed={scope === key}
                onClick={() => { setScope(key); setMetric('open'); }}
                sx={{ px: 1.25, textTransform: 'none', whiteSpace: 'nowrap', bgcolor: scope === key ? 'action.selected' : 'transparent', color: scope === key ? 'primary.main' : 'text.secondary' }}>
                {label}
              </Button>
            ))}
          </Stack>
        </Stack>

        <Box data-testid="maintenance-filters" sx={{ mb: 1.5 }}>
          <Box sx={maintenanceFilterGridSx}>
            <OutlinedInput
              size="small" placeholder="Search maintenance requests" value={search}
              onChange={(event) => setSearch(event.target.value)} inputProps={{ 'aria-label': 'Search maintenance requests, properties, or vendors' }}
              startAdornment={<InputAdornment position="start"><AppIcon name="magnifier" /></InputAdornment>} sx={maintenanceSearchControlSx}
            />
            <FilterSelect label="Property" value={selectedProperty?.id || ''} displayEmpty
              onChange={(event) => dispatch(setProperty(propertiesById.get(String(event.target.value)) || null))}>
              <MenuItem value="">All properties</MenuItem>
              {properties.map((property) => <MenuItem key={property.id} value={property.id}>{property.name?.trim() || property.streetAddress?.trim() || `Property ${property.id}`}</MenuItem>)}
            </FilterSelect>
            <FilterSelect label="Priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <MenuItem value="all">All priorities</MenuItem>
              {PRIORITY_OPTIONS.map((priority) => <MenuItem key={priority} value={priority}>{titleCase(priority)}</MenuItem>)}
            </FilterSelect>
            <FilterSelect label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <MenuItem value="all">All categories</MenuItem>
              {categories.map((category) => <MenuItem key={category} value={category}>{titleCase(category)}</MenuItem>)}
            </FilterSelect>
            <FilterSelect label="Assignment" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}>
              <MenuItem value="all">All assignments</MenuItem><MenuItem value="unassigned">Unassigned</MenuItem>
              <MenuItem value="vendor">Vendor</MenuItem><MenuItem value="team">Team member</MenuItem>
            </FilterSelect>
            <FilterSelect label="Sort requests" value={sort} onChange={(event) => setSort(event.target.value)}>
              <MenuItem value="priority">Priority · oldest</MenuItem><MenuItem value="oldest">Oldest first</MenuItem>
              <MenuItem value="newest">Newest first</MenuItem><MenuItem value="status">Workflow status</MenuItem>
            </FilterSelect>
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ pt: 0.75, minHeight: 34 }}>
            <Typography variant="body2" color="text.secondary" role="status">
              {busy ? 'Loading requests…' : `${visibleRequests.length} ${visibleRequests.length === 1 ? 'request' : 'requests'}`}
            </Typography>
            {hasRefinements && <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>Clear filters</Button>}
          </Stack>
        </Box>

        <Box data-testid="maintenance-table" sx={tableStyles.container} aria-busy={busy}>
          {busy ? <Box sx={{ minHeight: 200, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} aria-label="Loading maintenance requests" /></Box> : visibleRequests.length === 0 ? (
            <Box sx={{ py: 5, px: 2, textAlign: 'center' }}>
              <Avatar variant="rounded" sx={{ mx: 'auto', mb: 1.25, width: 44, height: 44, bgcolor: 'surface.nested', color: 'primary.main' }}><AppIcon name="maintenance" size={22} /></Avatar>
              <Typography component="h3" variant="h6">{hasRefinements ? 'No matching requests' : 'No requests to show'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{emptyMessage}</Typography>
            </Box>
          ) : (
            <>
              <Box aria-hidden="true" sx={{ ...tableStyles.header, gridTemplateColumns: maintenanceRequestColumns }}>
                {['Request', 'Property & timing', 'Status & priority', 'Assigned to'].map((label) => <Typography key={label} sx={tableStyles.heading}>{label}</Typography>)}
              </Box>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {paginated.map((request) => <MaintenanceRow key={request.id} request={request} property={propertiesById.get(String(request.propertyId))} rowSx={tableStyles.row} />)}
              </Box>
              {pageCount > 1 && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
                  <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>Showing {pageStart}–{pageEnd} of {visibleRequests.length}</Typography>
                  <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
                </Stack>
              )}
            </>
          )}
        </Box>
      </Box>

      <LandlordMaintenanceDrawer onAddSuccess={refetch} />
    </Box>
  );
}
