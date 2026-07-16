import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MaintenanceAgentDrawer from './MaintenanceAgentDrawer';
import TenantMaintenanceFormDrawer from 'components/drawers/TenantMaintenanceFormDrawer';

// material-ui
import {
  Box,
  Typography,
  Stack,
  Button,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Avatar,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Divider
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
  CalendarOutlined,
  EyeOutlined,
  HomeOutlined
} from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatDate, formatRelativeTime, formatDateAndTime } from 'utils/formatters';
import { getPriorityColor, getStatusColor } from 'utils/helper-methods';
import { openSnackbar } from 'api/snackbar';
import TenantMaintenanceDetail from './maintenance-detail';

// ==============================|| TENANT - MAINTENANCE ||============================== //

function LeaseListItem({ lease, selected, onClick }) {
  const theme = useTheme();
  const normalizedPropertyType = String(lease.propertyType || lease.PropertyType || lease.unit?.property?.propertyType || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const unitName = lease.unitName || lease.UnitName || lease.unit?.name || '';
  const normalizedUnitName = String(unitName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const showUnitName = unitName && normalizedPropertyType !== 'singlefamily' && normalizedUnitName !== 'unit1';
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        borderRadius: 1.5,
        border: `1.5px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        transition: 'all 0.15s',
        '&:hover': {
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.action.hover, 0.5),
          border: `1.5px solid ${selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`
        }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          src={lease.propertyImageUrl || undefined}
          sx={{
            width: 42,
            height: 42,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            flexShrink: 0,
            fontSize: 18
          }}
        >
          {!lease.propertyImageUrl && <HomeOutlined />}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {lease.propertyName || 'Property'}
            </Typography>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: lease.isActive ? 'success.main' : 'text.disabled',
                flexShrink: 0
              }}
            />
          </Stack>
          {showUnitName && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {unitName}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function formatCategoryLabel(category) {
  if (!category) return '—';
  return category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatStatusLabel(status) {
  if (!status) return 'N/A';
  if (status === 'in-progress') return 'In Progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function MaintenanceRequestCard({ request, tab, onOpen }) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: 'pointer',
        borderColor: alpha(theme.palette.divider, 0.12),
        bgcolor: alpha(theme.palette.background.paper, 0.72),
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        '&:active': { transform: 'scale(0.99)' },
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.28),
          boxShadow: `0 10px 26px ${alpha(theme.palette.primary.main, 0.12)}`
        }
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
            aria-label="View maintenance request"
          >
            <EyeOutlined style={{ fontSize: 16 }} />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
          <Chip
            label={formatStatusLabel(request.status)}
            color={getStatusColor(request.status)}
            size="small"
            sx={{ fontSize: '0.72rem', height: 24, fontWeight: 700 }}
          />
          <Chip
            label={request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : 'N/A'}
            color={getPriorityColor(request.priority)}
            size="small"
            sx={{ fontSize: '0.72rem', height: 24, fontWeight: 700 }}
          />
          {request.category && (
            <Chip
              label={formatCategoryLabel(request.category)}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.72rem', height: 24, maxWidth: '100%' }}
            />
          )}
        </Stack>

        <Divider />

        <Stack direction="row" alignItems="center" spacing={1} color="text.secondary">
          <CalendarOutlined style={{ fontSize: 14 }} />
          <Typography variant="caption">
            {request.createdAt
              ? tab === 'current'
                ? formatRelativeTime(request.createdAt)
                : formatDateAndTime(request.createdAt)
              : 'Submitted date unavailable'}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function TenantMaintenance() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { maintenanceId } = useParams();

  const [leases, setLeases] = useState([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [currentRequests, setCurrentRequests] = useState([]);
  const [historyRequests, setHistoryRequests] = useState([]);
  const [tab, setTab] = useState('current');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [maintenanceAgentEnabled, setMaintenanceAgentEnabled] = useState(true);
  const [error, setError] = useState(null);

  const selectedLease = useMemo(
    () => leases.find((l) => l.id === selectedLeaseId) || null,
    [leases, selectedLeaseId]
  );

  // Fetch leases + all requests
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const leasesResponse = await axiosServices.get('/api/lease/tenant/my-leases');
        if (leasesResponse.data?.success && leasesResponse.data?.data) {
          const all = leasesResponse.data.data;
          setLeases(all);
          const active = all.find((l) => l.isActive) || all[0];
          if (active) setSelectedLeaseId(active.id);
        }

        // Fetch requests + agent settings in parallel
        const [currentRes, historyRes, agentRes] = await Promise.allSettled([
          axiosServices.get('/api/maintenance-request/tenant/current'),
          axiosServices.get('/api/maintenance-request/tenant/history'),
          axiosServices.get('/api/maintenance-agent/settings')
        ]);

        if (currentRes.status === 'fulfilled' && currentRes.value.data?.success) {
          setCurrentRequests(currentRes.value.data.data || []);
        }
        if (historyRes.status === 'fulfilled' && historyRes.value.data?.success) {
          setHistoryRequests(historyRes.value.data.data || []);
        }
        if (agentRes.status === 'fulfilled' && agentRes.value.data?.success) {
          setMaintenanceAgentEnabled(agentRes.value.data.data?.isMaintenanceAgentEnabled ?? true);
        }
      } catch (err) {
        const status = err?.response?.status || err?.status;
        if (status !== 404) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load data');
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?.Id || user?.id) fetchData();
  }, [user]);

  const refetchRequests = async () => {
    try {
      const [currentRes, historyRes] = await Promise.allSettled([
        axiosServices.get('/api/maintenance-request/tenant/current'),
        axiosServices.get('/api/maintenance-request/tenant/history')
      ]);
      if (currentRes.status === 'fulfilled' && currentRes.value.data?.success) {
        setCurrentRequests(currentRes.value.data.data || []);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.data?.success) {
        setHistoryRequests(historyRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Error refetching requests:', err);
    }
  };

  // Filter requests to the selected lease's unit
  const filterByLease = (requests) => {
    if (!selectedLease) return requests;
    return requests.filter((r) => {
      if (selectedLease.unitId) return r.unitId === selectedLease.unitId;
      return r.propertyId === selectedLease.propertyId;
    });
  };

  const source = filterByLease(tab === 'current' ? currentRequests : historyRequests);

  // Search
  const filtered = useMemo(() => {
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter((r) =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q) ||
      (r.priority || '').toLowerCase().includes(q)
    );
  }, [source, search]);

  // Sort
  const sorted = useMemo(() => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return [...filtered].sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case 'title':
          av = (a.title || '').toLowerCase();
          bv = (b.title || '').toLowerCase();
          break;
        case 'priority':
          av = priorityWeight[a.priority] || 0;
          bv = priorityWeight[b.priority] || 0;
          break;
        case 'status':
          av = (a.status || '').toLowerCase();
          bv = (b.status || '').toLowerCase();
          break;
        case 'category':
          av = (a.category || '').toLowerCase();
          bv = (b.category || '').toLowerCase();
          break;
        default: // createdAt
          av = new Date(a.createdAt || 0).getTime();
          bv = new Date(b.createdAt || 0).getTime();
      }
      if (sortOrder === 'asc') return av > bv ? 1 : av < bv ? -1 : 0;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
  }, [filtered, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Count helpers for tab labels
  const currentCount = filterByLease(currentRequests).length;
  const historyCount = filterByLease(historyRequests).length;

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

  // ── Main layout ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pb: { xs: 8, md: 0 } }}>
      {/* Page header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}>Maintenance Requests</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Submit and track maintenance requests across your properties.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 2.5 }, flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
        {/* ── Left: Property list ──────────────────────────────────────────────── */}
        <Paper
          variant="outlined"
          sx={{
            width: { xs: '100%', md: 260 },
            flexShrink: 0,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
            overflow: 'hidden',
            position: { xs: 'relative', md: 'sticky' },
            top: { md: 0 },
            boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {leases.length} {leases.length === 1 ? 'Property' : 'Properties'}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'row', md: 'column' }}
            spacing={0.5}
            sx={{
              p: 1,
              overflowX: { xs: 'auto', md: 'visible' },
              WebkitOverflowScrolling: 'touch',
              '& > *': { minWidth: { xs: 224, md: 'auto' } }
            }}
          >
            {leases.map((lease) => (
              <LeaseListItem
                key={lease.id}
                lease={lease}
                selected={lease.id === selectedLeaseId}
                onClick={() => {
                  setSelectedLeaseId(lease.id);
                  setSearch('');
                  setTab('current');
                }}
              />
            ))}
          </Stack>
        </Paper>

        {/* ── Right: Requests table ────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              overflow: 'hidden',
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            {/* Panel header */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              spacing={1.5}
              sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedLease?.propertyName || 'Property'}
                  {selectedLease?.unitName && selectedLease?.propertyType?.toLowerCase() !== 'singlefamily' && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      · {selectedLease.unitName}
                    </Typography>
                  )}
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<PlusOutlined />}
                onClick={() => setAgentDrawerOpen(true)}
                sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
              >
                New Request
              </Button>
            </Stack>

            {/* Search + Tabs */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              spacing={1.5}
              sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 0 }}
            >
              <Box sx={{ borderBottom: 1, borderColor: 'divider', flex: 1, width: '100%' }}>
                <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(''); }} aria-label="maintenance tabs">
                  <Tab label={`Current (${currentCount})`} value="current" sx={{ textTransform: 'none' }} />
                  <Tab label={`History (${historyCount})`} value="history" sx={{ textTransform: 'none' }} />
                </Tabs>
              </Box>
              <TextField
                placeholder="Search..."
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined style={{ fontSize: 16, opacity: 0.55 }} />
                    </InputAdornment>
                  )
                }}
                sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}
              />
            </Stack>

            {/* Table */}
            {sorted.length > 0 ? (
              <>
              <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <TableCell sx={{ width: '35%', fontWeight: 600, fontSize: '0.75rem' }}>
                        <TableSortLabel
                          active={sortField === 'title'}
                          direction={sortField === 'title' ? sortOrder : 'asc'}
                          onClick={() => handleSort('title')}
                        >
                          Title
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: '15%', fontWeight: 600, fontSize: '0.75rem' }}>
                        <TableSortLabel
                          active={sortField === 'category'}
                          direction={sortField === 'category' ? sortOrder : 'asc'}
                          onClick={() => handleSort('category')}
                        >
                          Category
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: '12%', fontWeight: 600, fontSize: '0.75rem' }}>
                        <TableSortLabel
                          active={sortField === 'priority'}
                          direction={sortField === 'priority' ? sortOrder : 'asc'}
                          onClick={() => handleSort('priority')}
                        >
                          Priority
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: '13%', fontWeight: 600, fontSize: '0.75rem' }}>
                        <TableSortLabel
                          active={sortField === 'status'}
                          direction={sortField === 'status' ? sortOrder : 'asc'}
                          onClick={() => handleSort('status')}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: '18%', fontWeight: 600, fontSize: '0.75rem' }}>
                        <TableSortLabel
                          active={sortField === 'createdAt'}
                          direction={sortField === 'createdAt' ? sortOrder : 'asc'}
                          onClick={() => handleSort('createdAt')}
                        >
                          Submitted
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: '7%' }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sorted.map((request) => (
                      <TableRow
                        key={request.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:last-child td': { borderBottom: 0 }
                        }}
                        onClick={() => navigate(`/tenant/maintenance/${request.id}`)}
                      >
                        {/* Title + description snippet */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {request.title || 'Maintenance Request'}
                          </Typography>
                          {request.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ display: 'block', mt: 0.25, maxWidth: '100%' }}
                            >
                              {request.description.length > 80
                                ? `${request.description.substring(0, 80)}…`
                                : request.description}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Category */}
                        <TableCell sx={{ py: 1.5 }}>
                          {request.category ? (
                            <Chip
                              label={formatCategoryLabel(request.category)}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 22 }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>

                        {/* Priority */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : 'N/A'}
                            color={getPriorityColor(request.priority)}
                            size="small"
                            sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                          />
                        </TableCell>

                        {/* Status */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={formatStatusLabel(request.status)}
                            color={getStatusColor(request.status)}
                            size="small"
                            sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                          />
                        </TableCell>

                        {/* Date */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {request.createdAt
                              ? tab === 'current'
                                ? formatRelativeTime(request.createdAt)
                                : formatDateAndTime(request.createdAt)
                              : '—'}
                          </Typography>
                        </TableCell>

                        {/* Action */}
                        <TableCell sx={{ py: 1.5 }} align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/tenant/maintenance/${request.id}`);
                            }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <EyeOutlined style={{ fontSize: 15 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' }, p: 2 }}>
                {sorted.map((request) => (
                  <MaintenanceRequestCard
                    key={request.id}
                    request={request}
                    tab={tab}
                    onOpen={() => navigate(`/tenant/maintenance/${request.id}`)}
                  />
                ))}
              </Stack>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <ToolOutlined style={{ fontSize: 48, color: theme.palette.text.disabled, marginBottom: 12 }} />
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                  {search ? 'No requests match your search' : `No ${tab === 'current' ? 'active' : 'completed'} requests for this property`}
                </Typography>
                {!search && tab === 'current' && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PlusOutlined />}
                    onClick={() => setAgentDrawerOpen(true)}
                    sx={{ mt: 2, textTransform: 'none' }}
                  >
                    Submit a Request
                  </Button>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {maintenanceAgentEnabled ? (
        <MaintenanceAgentDrawer
          open={agentDrawerOpen}
          onClose={() => setAgentDrawerOpen(false)}
          onRequestCreated={() => {
            setAgentDrawerOpen(false);
            axiosServices.get('/api/maintenance-request/tenant/current')
              .then((res) => { if (res.data?.success) setCurrentRequests(res.data.data || []); })
              .catch(() => {});
          }}
        />
      ) : (
        <TenantMaintenanceFormDrawer
          open={agentDrawerOpen}
          onClose={() => setAgentDrawerOpen(false)}
          unitId={selectedLease?.unitId ?? null}
          onRequestCreated={() => {
            setAgentDrawerOpen(false);
            axiosServices.get('/api/maintenance-request/tenant/current')
              .then((res) => { if (res.data?.success) setCurrentRequests(res.data.data || []); })
              .catch(() => {});
          }}
        />
      )}
    </Box>
  );
}
