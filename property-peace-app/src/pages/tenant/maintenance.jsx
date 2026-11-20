import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import TenantMaintenanceFormDrawer from 'components/drawers/TenantMaintenanceFormDrawer';
import MaintenanceAgentDrawer from './MaintenanceAgentDrawer';

// material-ui
import {
  Box,
  Typography,
  Stack,
  Button,
  Paper,
  Avatar,
  Chip,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  DownOutlined,
  EyeOutlined
} from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import { formatRelativeTime, formatDateAndTime } from 'utils/formatters';
import { getTenantMaintenanceLeases, maintenanceWorkflowAPI } from 'api/maintenanceWorkflow';
import { normalizeWorkflowToken } from 'utils/maintenanceWorkflow';
import TenantMaintenanceDetail from './maintenance-detail';
import TenantLeaseFilter from 'components/filters/TenantLeaseFilter';
import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';
import PortalListPagination from 'components/table/PortalListPagination';
import { paginateRows } from 'components/table/paginateRows.mjs';
import { filterControlSx } from 'themes/filterControlStyles';
import { getPortalListTableSx } from 'themes/tableStyles';
import { getMaintenanceRequestDate, getMaintenanceRows } from './maintenanceList.mjs';
import { getLeaseOrganizationId, organizationRequestOptions } from './tenantDocumentScope.mjs';

// ==============================|| TENANT - MAINTENANCE ||============================== //

function formatCategoryLabel(category) {
  if (!category) return '—';
  return category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getSubmittedLabel(request, tab, fallback = '—') {
  const date = getMaintenanceRequestDate(request);
  if (!date) return fallback;
  return tab === 'current' ? formatRelativeTime(date) : formatDateAndTime(date);
}

function MaintenanceRequestCard({ request, tab, onOpen }) {
  return (
    <Box
      onClick={onOpen}
      sx={{
        p: 2,
        cursor: 'pointer',
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 },
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {request.title || 'Maintenance Request'}
            </Typography>
            {request.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {request.description}
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            sx={{ color: 'text.secondary', mt: -0.5 }}
            aria-label={'View ' + (request.title || 'maintenance request')}
          >
            <EyeOutlined style={{ fontSize: 16 }} />
          </IconButton>
        </Stack>

        {request.category && (
          <Chip
            label={formatCategoryLabel(request.category)}
            size="small"
            variant="outlined"
            sx={{ alignSelf: 'flex-start', fontSize: '0.72rem', height: 24, maxWidth: '100%' }}
          />
        )}

        <Stack direction="row" alignItems="center" spacing={1} color="text.secondary">
          <CalendarOutlined style={{ fontSize: 14 }} />
          <Typography variant="caption">
            {getSubmittedLabel(request, tab, 'Submitted date unavailable')}
          </Typography>
        </Stack>
        {request.location && (
          <Stack direction="row" alignItems="center" spacing={1} color="text.secondary">
            <EnvironmentOutlined />
            <Typography variant="caption">{request.location}</Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default function TenantMaintenance() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { maintenanceId } = useParams();

  const [leaseSelection, setSelectedLeaseId] = useState(null);
  const [tab, setTab] = useState('current');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [agentFailed, setAgentFailed] = useState(false);

  const userId = user?.id ?? user?.Id;
  const { data: leases = [], isLoading: leasesLoading, error: leasesError } = useSWR(
    userId ? ['tenant-maintenance-leases', userId] : null,
    async () => {
      const { data } = await getTenantMaintenanceLeases();
      return data?.success && Array.isArray(data.data) ? data.data : [];
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const selectedLease = leases.find((lease) => lease.id === leaseSelection) ?? leases.find((lease) => lease.isActive) ?? leases[0];
  const selectedLeaseId = selectedLease?.id ?? null;
  const organizationId = getLeaseOrganizationId(selectedLease);
  const { data: requests = [], isLoading: requestsLoading, error: requestsError, mutate: refreshRequests } = useSWR(
    userId && organizationId ? ['tenant-maintenance-requests', userId, organizationId] : null,
    async ([, , selectedOrganizationId]) => {
      const result = await maintenanceWorkflowAPI.list(organizationRequestOptions(selectedOrganizationId));
      if (!Array.isArray(result)) throw new Error('Maintenance response was incomplete.');
      return result;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const loading = leasesLoading || requestsLoading;
  const loadError = leasesError || requestsError;
  const error = loadError && loadError.status !== 404
    ? loadError.detail || loadError.message || 'Maintenance requests could not be loaded.'
    : selectedLease && !organizationId ? 'The organization for this lease could not be verified.' : '';
  const refetchRequests = () => refreshRequests().catch(() => {});

  const [current, history] = useMemo(() => {
    if (!selectedLease) return [[], []];
    const matching = requests.filter((request) => selectedLease.unitId
      ? request.unitId === selectedLease.unitId
      : request.propertyId === selectedLease.propertyId);
    const isHistory = (request) => ['resolved', 'cancelled'].includes(normalizeWorkflowToken(request.status));
    return [matching.filter((request) => !isHistory(request)), matching.filter(isHistory)];
  }, [requests, selectedLease]);

  const source = tab === 'current' ? current : history;
  const sorted = useMemo(() => getMaintenanceRows(source, { search }), [source, search]);
  const { page: visiblePage, pageCount, rows: visibleRows, start, end } = paginateRows(sorted, page, pageSize);
  const hasSearch = Boolean(search.trim());

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleLeaseChange = (leaseId) => {
    setSelectedLeaseId(leaseId);
    setPage(0);
  };

  const handleViewChange = (view) => {
    setTab(view);
    setPage(0);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(0);
  };

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (maintenanceId) {
    return (
      <TenantMaintenanceDetail
        maintenanceId={maintenanceId}
        onBack={() => {
          navigate('/tenant/maintenance');
          refetchRequests();
        }}
      />
    );
  }

  // ── States ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>Maintenance Requests</Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!leases.length) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>Maintenance Requests</Typography>
        <Alert severity="info">
          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>Lease Not Set Up</Typography>
          <Typography variant="body2">
            Your landlord has not set up the lease yet. Maintenance requests will be available once your landlord creates and assigns a lease to your account.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: { xs: 3, md: 0 } }}>
      <ManagementPageHeader
        title="Maintenance Requests"
        description="Submit and track maintenance requests for your leases."
        showBreadcrumbs={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlusOutlined />}
            onClick={() => { setAgentFailed(false); setAgentDrawerOpen(true); }}
            sx={{ ...managementPageHeaderActionSx, display: 'flex', ml: 'auto' }}
          >
            New request
          </Button>
        }
      />

      <Stack spacing={1.25} sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} alignItems={{ sm: 'center' }}>
          <TenantLeaseFilter
            leases={leases}
            selectedLeaseId={selectedLeaseId}
            onChange={handleLeaseChange}
            labelInline
            sx={{ flexShrink: 0 }}
          />
          <TextField
            placeholder="Search requests by title, location, or description"
            type="search"
            size="small"
            value={search}
            onChange={handleSearchChange}
            slotProps={{
              htmlInput: { 'aria-label': 'Search maintenance requests' },
              input: {
                sx: filterControlSx,
                startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment>
              }
            }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Select
            size="small"
            value={tab}
            onChange={(event) => handleViewChange(event.target.value)}
            inputProps={{ 'aria-label': 'View' }}
            IconComponent={DownOutlined}
            sx={{ ...filterControlSx, minWidth: { sm: 144 }, flexShrink: 0 }}
          >
            <MenuItem value="current">Current ({current.length})</MenuItem>
            <MenuItem value="history">History ({history.length})</MenuItem>
          </Select>
        </Stack>

        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {sorted.length} of {source.length} {source.length === 1 ? 'request' : 'requests'}
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: (t) => alpha(t.palette.divider, 0.16),
          borderRadius: 3,
          boxShadow: (t) => '0 8px 28px ' + alpha(t.palette.text.primary, 0.055),
          overflow: 'hidden'
        }}
      >
        {visibleRows.length > 0 ? (
          <>
            <TableContainer sx={{
              display: { xs: 'none', md: 'block' },
              border: 0,
              borderRadius: 0,
              '& .MuiTable-root': { tableLayout: 'fixed' }
            }}>
              <Table size="small" sx={getPortalListTableSx} aria-label="Maintenance requests">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '48%' }}>Request</TableCell>
                    <TableCell sx={{ width: '27%' }}>Location</TableCell>
                    <TableCell sx={{ width: '18%' }}>Submitted</TableCell>
                    <TableCell sx={{ width: '7%' }} align="right" aria-label="Actions" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((request) => {
                    const title = request.title || 'Maintenance request';
                    const detailsPath = '/tenant/maintenance/' + request.id;

                    return (
                      <TableRow
                        key={request.id}
                        hover
                        sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                        onClick={() => navigate(detailsPath)}
                      >
                        <TableCell sx={{ py: 1.35 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar sx={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                              color: 'primary.main',
                              fontSize: 17
                            }}>
                              <ToolOutlined aria-hidden="true" />
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" fontWeight={700} noWrap title={title}>
                                {title}
                              </Typography>
                              {request.description && (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                                  {request.description}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell sx={{ py: 1.35 }}>
                          {request.location ? (
                            <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
                              <EnvironmentOutlined aria-hidden="true" />
                              <Typography variant="body2" color="text.primary" noWrap title={request.location}>
                                {request.location}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {formatCategoryLabel(request.category)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{getSubmittedLabel(request, tab)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label={'View ' + title}
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(detailsPath);
                            }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <EyeOutlined />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack sx={{ display: { xs: 'flex', md: 'none' } }}>
              {visibleRows.map((request) => (
                <MaintenanceRequestCard
                  key={request.id}
                  request={request}
                  tab={tab}
                  onOpen={() => navigate('/tenant/maintenance/' + request.id)}
                />
              ))}
            </Stack>

            <PortalListPagination
              page={visiblePage}
              pageCount={pageCount}
              pageSize={pageSize}
              start={start}
              end={end}
              total={sorted.length}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        ) : (
          <Box sx={{ textAlign: 'center', px: 2, py: 7 }}>
            <ToolOutlined style={{ fontSize: 32, color: theme.palette.text.disabled }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {hasSearch ? 'No requests match your search.' : tab === 'current' ? 'No current requests for this lease.' : 'No past requests for this lease.'}
            </Typography>
          </Box>
        )}
      </Paper>

      {agentFailed ? <TenantMaintenanceFormDrawer
        open={agentDrawerOpen}
        leaseId={selectedLease?.id}
        unitId={selectedLease?.unitId ?? null}
        onClose={() => setAgentDrawerOpen(false)}
        onRequestCreated={refetchRequests}
      /> : <MaintenanceAgentDrawer
        key={organizationId}
        open={agentDrawerOpen}
        organizationId={organizationId}
        onClose={() => setAgentDrawerOpen(false)}
        onUnavailable={() => setAgentFailed(true)}
        onRequestCreated={refetchRequests}
      />}
    </Box>
  );
}
