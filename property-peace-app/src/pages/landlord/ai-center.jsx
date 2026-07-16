import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Fade,
  alpha,
  useTheme,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Divider,
  Alert
} from '@mui/material';
import {
  ArrowRightOutlined,
  BellOutlined,
  CheckCircleFilled,
  DollarCircleOutlined,
  HistoryOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SyncOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import AnimateIn from 'components/AnimateIn';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import { aiFollowUpAPI, organizationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { useSelector } from 'react-redux';
import { selectMaintenanceLoading } from 'store/maintenance/maintenance.selector';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

const NAVY = '#061e35';
const GREEN = '#16a34a';
const BLUE = '#2563eb';
const AMBER = '#d97706';
const RED = '#dc2626';

function safeDate(dt) {
  if (!dt) return null;
  try {
    const d = typeof dt === 'string' ? parseISO(dt) : new Date(dt);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function timeAgo(dt) {
  const d = safeDate(dt);
  if (!d) return null;
  return formatDistanceToNow(d, { addSuffix: true });
}

function formatShortDate(dt) {
  const d = safeDate(dt);
  if (!d) return 'No date yet';
  return format(d, 'MMM d');
}

function getStatusColor(status) {
  const normalized = (status || '').toLowerCase();
  if (['completed', 'resolved', 'closed', 'done', 'paid', 'sent'].includes(normalized)) return 'success';
  if (['high', 'urgent', 'overdue', 'failed', 'error'].includes(normalized)) return 'error';
  if (['inprogress', 'in-progress', 'active', 'pending', 'open', 'scheduled'].includes(normalized)) return 'warning';
  return 'default';
}

function getPriorityColor(priority) {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'high' || normalized === 'urgent') return 'error';
  if (normalized === 'medium') return 'warning';
  if (normalized === 'low') return 'success';
  return 'default';
}

function MetricTile({ label, value, sub, color, loading }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: alpha(c, theme.palette.mode === 'dark' ? 0.14 : 0.07),
        border: `1px solid ${alpha(c, theme.palette.mode === 'dark' ? 0.26 : 0.16)}`,
        minHeight: 110,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800 }}>
        {label}
      </Typography>
      {loading ? (
        <CircularProgress size={20} thickness={5} sx={{ color: c, mt: 1 }} />
      ) : (
        <Typography variant="h3" fontWeight={800} sx={{ color: c, lineHeight: 1, mt: 1 }}>
          {value ?? '—'}
        </Typography>
      )}
      {sub && !loading && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.35 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

function PercyHero({ activeAgentCount, settingsLoading }) {
  const theme = useTheme();

  return (
    <MainCard
      content={false}
      sx={{
        overflow: 'hidden',
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.12)}`,
        boxShadow: theme.palette.mode === 'dark' ? `0 22px 55px ${alpha('#000', 0.35)}` : `0 22px 55px ${alpha(NAVY, 0.08)}`
      }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 2.25, md: 3 },
          bgcolor: theme.palette.mode === 'dark' ? alpha(NAVY, 0.92) : alpha(NAVY, 0.97),
          color: '#fff'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.35,
            background: `radial-gradient(circle at 18% 15%, ${alpha('#7ee3a3', 0.65)} 0, transparent 27%), radial-gradient(circle at 84% 18%, ${alpha('#38bdf8', 0.45)} 0, transparent 28%), linear-gradient(135deg, transparent 0%, ${alpha('#ffffff', 0.06)} 100%)`
          }}
        />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2.5} sx={{ position: 'relative' }}>
          <Box sx={{ maxWidth: 760 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha('#fff', 0.12),
                  border: `1px solid ${alpha('#fff', 0.18)}`,
                  color: '#7ee3a3'
                }}
              >
                <RobotOutlined style={{ fontSize: 24 }} />
              </Box>
              <Chip
                label={settingsLoading ? 'Checking status' : `${activeAgentCount} active Percy workflows`}
                size="small"
                sx={{ bgcolor: alpha('#fff', 0.12), border: `1px solid ${alpha('#fff', 0.18)}`, color: '#fff', fontWeight: 700 }}
              />
            </Stack>
            <Typography variant="h2" fontWeight={800} sx={{ color: '#fff', letterSpacing: -0.7, mb: 1 }}>
              Percy
            </Typography>
            <Typography variant="body1" sx={{ color: alpha('#fff', 0.78), maxWidth: 700, lineHeight: 1.7 }}>
              Your rental operations assistant for the two workflows that create the most noise: collection follow-ups and maintenance work. Review what Percy has done, run a collections pass, and monitor maintenance history without jumping between separate agent pages.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'row', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', md: 'auto' }, flexWrap: 'wrap', gap: 1 }}>
            <Button
              component={Link}
              to="/landlord/ai-center/collections-history"
              variant="outlined"
              startIcon={<HistoryOutlined />}
              sx={{ color: '#fff', borderColor: alpha('#fff', 0.28), '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
            >
              Collections history
            </Button>
            <Button
              component={Link}
              to="/landlord/maintenances"
              variant="contained"
              startIcon={<ToolOutlined />}
              sx={{ bgcolor: '#7ee3a3', color: NAVY, boxShadow: 'none', '&:hover': { bgcolor: '#69d991', boxShadow: 'none' } }}
            >
              Maintenance board
            </Button>
          </Stack>
        </Stack>
      </Box>
    </MainCard>
  );
}

function WorkstreamCard({ icon, title, description, enabled, toggling, loading, onToggle, color, children }) {
  const theme = useTheme();
  const isActive = loading ? true : enabled;

  return (
    <MainCard
      content={false}
      sx={{
        height: '100%',
        borderRadius: 2.5,
        border: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.3 : 0.16)}`,
        overflow: 'hidden',
        boxShadow: 'none'
      }}
    >
      <Box sx={{ p: 2.25 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(color, 0.1),
                border: `1px solid ${alpha(color, 0.18)}`,
                color
              }}
            >
              {icon}
            </Box>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="h5" fontWeight={800}>
                  {title}
                </Typography>
                <Chip
                  label={loading ? 'Loading' : isActive ? 'Active' : 'Paused'}
                  size="small"
                  color={isActive ? 'success' : 'default'}
                  variant={isActive ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>
                {description}
              </Typography>
            </Box>
          </Stack>
          <Tooltip title={isActive ? 'Pause this Percy workflow' : 'Resume this Percy workflow'}>
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => onToggle(e.target.checked)} disabled={loading || toggling} size="small" color="success" />}
              label={<Typography variant="caption" color="text.secondary">{toggling ? 'Saving…' : isActive ? 'On' : 'Off'}</Typography>}
              sx={{ m: 0, flexShrink: 0 }}
            />
          </Tooltip>
        </Stack>
        {children}
      </Box>
    </MainCard>
  );
}

function CollectionHistoryRow({ item }) {
  const theme = useTheme();
  const actionType = item.actionType || item.ActionType || item.type || 'follow-up';
  const tenant = item.tenantName || item.TenantName || item.tenantFullName || item.recipientName || 'Tenant';
  const property = item.propertyName || item.PropertyName || item.unitName || item.UnitName || item.leaseName || 'Rental account';
  const created = item.createdAt || item.CreatedAt || item.sentAt || item.SentAt;
  const preview = item.messagePreview || item.MessagePreview || item.message || item.Message || item.notes || 'Percy recorded a collections action.';

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {tenant}
            </Typography>
            <Chip label={String(actionType).replace(/_/g, ' ')} size="small" color={getStatusColor(actionType)} variant="outlined" sx={{ height: 21, fontSize: '0.68rem', fontWeight: 700 }} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
            {property} · {timeAgo(created) || formatShortDate(created)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.85, lineHeight: 1.55 }}>
            {preview}
          </Typography>
        </Box>
        <MessageOutlined style={{ color: theme.palette.primary.main, fontSize: 18, flexShrink: 0 }} />
      </Stack>
    </Box>
  );
}

function MaintenanceRow({ request, history = false }) {
  const theme = useTheme();
  const title = request.title || request.Title || request.orderNumber || 'Maintenance request';
  const status = request.status || request.Status || (history ? 'Completed' : 'Open');
  const priority = request.priority || request.Priority || 'Normal';
  const created = request.createdAt || request.CreatedAt || request.updatedAt || request.UpdatedAt;
  const property = request.propertyName || request.PropertyName || request.unitName || request.UnitName || 'Property not assigned';
  const vendor = request.vendorName || request.assignedContactName || request.AssignedContactName;

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, bgcolor: history ? alpha(theme.palette.success.main, 0.035) : 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {title}
            </Typography>
            <Chip label={status} size="small" color={getStatusColor(status)} variant="outlined" sx={{ height: 21, fontSize: '0.68rem', fontWeight: 700 }} />
            {!history && <Chip label={priority} size="small" color={getPriorityColor(priority)} variant="outlined" sx={{ height: 21, fontSize: '0.68rem', fontWeight: 700 }} />}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
            {property} · {timeAgo(created) || formatShortDate(created)}{vendor ? ` · ${vendor}` : ''}
          </Typography>
          {request.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.85, lineHeight: 1.55 }}>
              {request.description}
            </Typography>
          )}
        </Box>
        <ToolOutlined style={{ color: history ? theme.palette.success.main : AMBER, fontSize: 18, flexShrink: 0 }} />
      </Stack>
    </Box>
  );
}

export default function AICenter() {
  const theme = useTheme();
  const [fadeIn, setFadeIn] = useState(false);

  const { maintenances = [], historyMaintenances = [] } = useFetchMaintenances();
  const maintenanceLoading = useSelector(selectMaintenanceLoading);

  const [collectionsEnabled, setCollectionsEnabled] = useState(true);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(true);
  const [collectionsToggling, setCollectionsToggling] = useState(false);
  const [maintenanceToggling, setMaintenanceToggling] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    setFadeIn(true);
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.allSettled([loadAgentSettings(), loadCollectionSummary(), loadCollectionHistory()]);
  };

  const loadAgentSettings = async () => {
    try {
      const res = await organizationAPI.getCurrentOrganization();
      if (res?.success && res?.data) {
        setCollectionsEnabled(res.data.isCollectionsAgentEnabled ?? true);
        setMaintenanceEnabled(res.data.isMaintenanceAgentEnabled ?? true);
      }
    } catch {
      // Defaults stay enabled if settings are not available.
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadCollectionSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await aiFollowUpAPI.getAgentDashboardSummary();
      setSummary(res?.data ?? res ?? null);
    } catch {
      // Non-fatal — Percy dashboard still shows maintenance state.
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadCollectionHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await aiFollowUpAPI.getCollectionsHistory(1, 5);
      const data = res?.data;
      setHistory(data?.items ?? []);
    } catch {
      // Non-fatal.
    } finally {
      setHistoryLoading(false);
    }
  };

  const updateAgentSettings = async ({ collections, maintenance }) => {
    await organizationAPI.updateAgentSettings({
      isCollectionsAgentEnabled: collections,
      isMaintenanceAgentEnabled: maintenance
    });
  };

  const handleToggleCollections = async (value) => {
    setCollectionsToggling(true);
    const prev = collectionsEnabled;
    setCollectionsEnabled(value);
    try {
      await updateAgentSettings({ collections: value, maintenance: maintenanceEnabled });
      openSnackbar({ open: true, message: `Percy collections ${value ? 'enabled' : 'paused'}.`, variant: 'alert', alert: { color: 'success' } });
    } catch {
      setCollectionsEnabled(prev);
      openSnackbar({ open: true, message: 'Failed to update Percy collections.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setCollectionsToggling(false);
    }
  };

  const handleToggleMaintenance = async (value) => {
    setMaintenanceToggling(true);
    const prev = maintenanceEnabled;
    setMaintenanceEnabled(value);
    try {
      await updateAgentSettings({ collections: collectionsEnabled, maintenance: value });
      openSnackbar({ open: true, message: `Percy maintenance ${value ? 'enabled' : 'paused'}.`, variant: 'alert', alert: { color: 'success' } });
    } catch {
      setMaintenanceEnabled(prev);
      openSnackbar({ open: true, message: 'Failed to update Percy maintenance.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setMaintenanceToggling(false);
    }
  };

  const handleRunCollections = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await aiFollowUpAPI.runOverdueRentSweep();
      const data = res?.data;
      setRunResult({ success: true, data });
      const sent = data?.messagesSent ?? 0;
      openSnackbar({
        open: true,
        message: sent > 0 ? `Percy sent ${sent} collection follow-up${sent !== 1 ? 's' : ''}.` : 'Percy checked collections — no follow-ups needed right now.',
        variant: 'alert',
        alert: { color: 'success' }
      });
      await Promise.allSettled([loadCollectionSummary(), loadCollectionHistory()]);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Percy could not run collections right now.';
      setRunResult({ success: false, message });
      openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setRunning(false);
    }
  };

  const activeMaintenance = useMemo(() => {
    return (maintenances || [])
      .filter((r) => !['completed', 'resolved', 'closed', 'cancelled'].includes((r.status || '').toLowerCase()))
      .slice(0, 5);
  }, [maintenances]);

  const recentMaintenanceHistory = useMemo(() => (historyMaintenances || []).slice(0, 5), [historyMaintenances]);

  const activeAgentCount = [collectionsEnabled, maintenanceEnabled].filter(Boolean).length;
  const lastRunAt = summary?.lastRunAt ?? summary?.LastRunAt ?? null;
  const followUpsSentThisMonth = summary?.followUpsSentThisMonth ?? summary?.FollowUpsSentThisMonth ?? null;
  const leasesMonitored = summary?.leasesMonitored ?? summary?.LeasesMonitored ?? null;
  const flaggedCount = summary?.flaggedForReview ?? summary?.FlaggedForReview ?? null;
  const highPriorityMaintenance = activeMaintenance.filter((r) => ['high', 'urgent'].includes((r.priority || '').toLowerCase())).length;

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box>
        <AnimateIn direction="bottom" delay={80} distance={100}>
          <Box sx={{ mb: 2.5 }}>
            <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Percy' }]} />
            <PercyHero activeAgentCount={activeAgentCount} settingsLoading={settingsLoading} />
          </Box>
        </AnimateIn>

        <AnimateIn direction="bottom" delay={140} distance={100}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2.5 }}>
            <MetricTile label="Collection follow-ups" value={followUpsSentThisMonth} sub="sent this month" color={GREEN} loading={summaryLoading} />
            <MetricTile label="Leases monitored" value={leasesMonitored} sub={lastRunAt ? `last checked ${timeAgo(lastRunAt)}` : 'daily sweep'} color={BLUE} loading={summaryLoading} />
            <MetricTile label="Needs review" value={flaggedCount} sub="collection exceptions" color={flaggedCount > 0 ? RED : theme.palette.text.disabled} loading={summaryLoading} />
            <MetricTile label="Open maintenance" value={activeMaintenance.length} sub={`${highPriorityMaintenance} high priority`} color={AMBER} loading={maintenanceLoading} />
          </Box>
        </AnimateIn>

        {runResult && !runResult.success && (
          <Alert severity="error" sx={{ mb: 2.5 }}>{runResult.message}</Alert>
        )}

        {runResult?.success && runResult?.data && (
          <Alert severity="success" sx={{ mb: 2.5 }}>
            Percy reviewed {runResult.data.leasesReviewed ?? 0} lease{(runResult.data.leasesReviewed ?? 0) === 1 ? '' : 's'}, sent {runResult.data.messagesSent ?? 0} follow-up{(runResult.data.messagesSent ?? 0) === 1 ? '' : 's'}, and flagged {runResult.data.flaggedForReview ?? 0} item{(runResult.data.flaggedForReview ?? 0) === 1 ? '' : 's'} for review.
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'stretch' }}>
          <AnimateIn direction="bottom" delay={200} distance={100}>
            <WorkstreamCard
              icon={<DollarCircleOutlined style={{ fontSize: 24 }} />}
              title="Collections"
              description="Percy reviews rent status, payment timing, grace periods, and prior outreach so follow-ups stay helpful instead of noisy."
              enabled={collectionsEnabled}
              toggling={collectionsToggling}
              loading={settingsLoading}
              onToggle={handleToggleCollections}
              color={GREEN}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={running ? <SyncOutlined spin /> : <PlayCircleOutlined />}
                  onClick={handleRunCollections}
                  disabled={running || !collectionsEnabled}
                  sx={{ boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
                >
                  {running ? 'Percy is checking…' : 'Run collections check'}
                </Button>
                <Button component={Link} to="/landlord/ai-center/collections-history" variant="outlined" startIcon={<HistoryOutlined />}>
                  View follow-ups
                </Button>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={800}>Recent follow-ups</Typography>
                <Typography variant="caption" color="text.secondary">Percy activity</Typography>
              </Stack>

              {historyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : history.length ? (
                <Stack spacing={1.25}>{history.map((item, index) => <CollectionHistoryRow key={item.id || item.Id || index} item={item} />)}</Stack>
              ) : (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.06), border: `1px dashed ${alpha(theme.palette.success.main, 0.24)}` }}>
                  <Typography variant="subtitle2" fontWeight={800}>No follow-ups yet</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Run Percy once payments are active and collection history will appear here.</Typography>
                </Box>
              )}
            </WorkstreamCard>
          </AnimateIn>

          <AnimateIn direction="bottom" delay={260} distance={100}>
            <WorkstreamCard
              icon={<ToolOutlined style={{ fontSize: 24 }} />}
              title="Maintenance"
              description="Percy helps turn tenant repair messages into complete work orders, then keeps the active queue and completed history visible from one place."
              enabled={maintenanceEnabled}
              toggling={maintenanceToggling}
              loading={settingsLoading}
              onToggle={handleToggleMaintenance}
              color={AMBER}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
                <Button component={Link} to="/landlord/maintenances" variant="contained" startIcon={<ToolOutlined />} sx={{ boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}>
                  Manage work orders
                </Button>
                <Button component={Link} to="/landlord/maintenances/add" variant="outlined" startIcon={<BellOutlined />}>
                  Add request
                </Button>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={800}>Active work</Typography>
                <Typography variant="caption" color="text.secondary">{activeMaintenance.length} open</Typography>
              </Stack>

              {maintenanceLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : activeMaintenance.length ? (
                <Stack spacing={1.25}>{activeMaintenance.map((request, index) => <MaintenanceRow key={request.id || request.Id || index} request={request} />)}</Stack>
              ) : (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}` }}>
                  <Typography variant="subtitle2" fontWeight={800}>No active work orders</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>When tenants submit maintenance through Percy, organized work orders appear here.</Typography>
                </Box>
              )}
            </WorkstreamCard>
          </AnimateIn>
        </Box>

        <AnimateIn direction="bottom" delay={320} distance={100}>
          <MainCard
            content={false}
            sx={{ mt: 2.5, borderRadius: 2.5, border: `1px solid ${alpha(theme.palette.divider, 0.9)}`, boxShadow: 'none' }}
          >
            <Box sx={{ p: 2.25 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h5" fontWeight={800}>Maintenance history</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    Closed and completed work so you can see what Percy helped capture over time.
                  </Typography>
                </Box>
                <Button component={Link} to="/landlord/maintenances" endIcon={<ArrowRightOutlined />} size="small">
                  Open full board
                </Button>
              </Stack>

              {maintenanceLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : recentMaintenanceHistory.length ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.25 }}>
                  {recentMaintenanceHistory.map((request, index) => <MaintenanceRow key={request.id || request.Id || index} request={request} history />)}
                </Box>
              ) : (
                <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.045), border: `1px dashed ${alpha(theme.palette.success.main, 0.2)}` }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <CheckCircleFilled style={{ color: theme.palette.success.main }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>No completed maintenance history yet</Typography>
                      <Typography variant="body2" color="text.secondary">Resolved Percy work orders will collect here once requests are completed.</Typography>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Box>
          </MainCard>
        </AnimateIn>

        <AnimateIn direction="bottom" delay={360} distance={100}>
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.06), border: `1px solid ${alpha(theme.palette.warning.main, 0.18)}` }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <WarningOutlined style={{ color: theme.palette.warning.main, fontSize: 18, marginTop: 2 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Percy keeps you in control</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.6 }}>
                  Collection outreach is suppression-aware and review-friendly, and maintenance stays as organized work history. Percy can help capture, summarize, and remind — final landlord decisions stay with you.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </AnimateIn>
      </Box>
    </Fade>
  );
}
