import { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
  Grid
} from '@mui/material';
import {
  DollarCircleOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  PlayCircleOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  StopOutlined,
  WarningOutlined,
  ArrowRightOutlined,
  UserOutlined,
  SyncOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import AnimateIn from 'components/AnimateIn';
import { aiFollowUpAPI, organizationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { formatCurrency } from 'utils/formatters';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dt) {
  if (!dt) return null;
  try {
    const d = typeof dt === 'string' ? parseISO(dt) : new Date(dt);
    return `${format(d, 'MMM d, yyyy')} at ${format(d, 'h:mm a')}`;
  } catch {
    return null;
  }
}

function timeAgo(dt) {
  if (!dt) return null;
  try {
    const d = typeof dt === 'string' ? parseISO(dt) : new Date(dt);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return null;
  }
}

// ─── Stat Box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, color, loading }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 160,
        p: 2,
        borderRadius: 1.5,
        border: `1px dashed ${alpha(theme.palette.divider, 0.8)}`,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700 }}>
        {label}
      </Typography>
      {loading ? (
        <CircularProgress size={18} thickness={5} sx={{ color: c, mt: 0.25 }} />
      ) : (
        <Typography variant="h4" fontWeight={700} sx={{ color: c, lineHeight: 1 }}>
          {value ?? '—'}
        </Typography>
      )}
      {sub && !loading && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

// ─── Action Chip ──────────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  sent:     { label: 'Follow-up Sent',    color: 'success' },
  flagged:  { label: 'Flagged',           color: 'error'   },
  late_fee: { label: 'Late Fee Rec.',     color: 'warning' }
};

function ActionChip({ type, isManual }) {
  const cfg = ACTION_CONFIG[type] ?? { label: type, color: 'default' };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Chip label={cfg.label} size="small" color={cfg.color} variant="outlined"
        sx={{ fontWeight: 500, fontSize: '0.68rem', height: 20 }} />
      {isManual && (
        <Chip label="Manual" size="small" icon={<UserOutlined style={{ fontSize: 9 }} />}
          sx={{ fontSize: '0.65rem', height: 18 }} />
      )}
    </Stack>
  );
}

// ─── Sweep Result (inline) ────────────────────────────────────────────────────

function SweepResult({ data }) {
  const theme = useTheme();
  const [forceState, setForceState] = useState({});

  const reviewed = data.leasesReviewed ?? 0;
  const sent = data.messagesSent ?? 0;
  const suppressed = data.suppressed ?? 0;
  const flagged = data.flaggedForReview ?? 0;
  const feeRecs = data.lateFeeRecommendations ?? 0;
  const allGood = reviewed > 0 && sent === 0 && flagged === 0 && feeRecs === 0;

  const handleForce = async (leaseId) => {
    setForceState((s) => ({ ...s, [leaseId]: 'loading' }));
    try {
      await axiosServices.post(`/api/ai-copilot/agents/force-followup/${leaseId}`);
      setForceState((s) => ({ ...s, [leaseId]: 'sent' }));
      openSnackbar({ open: true, message: 'Follow-up sent.', variant: 'alert', alert: { color: 'success' } });
    } catch {
      setForceState((s) => ({ ...s, [leaseId]: 'error' }));
      openSnackbar({ open: true, message: 'Failed to send.', variant: 'alert', alert: { color: 'error' } });
    }
  };

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`, bgcolor: alpha(theme.palette.success.main, 0.04), mb: 2 }}>
      <Typography variant="caption" fontWeight={700} color="success.main" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mb: 1.5 }}>
        Sweep Complete
      </Typography>
      <Stack direction="row" spacing={0} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        {[
          { label: 'Reviewed', value: reviewed, color: 'text.primary' },
          { label: 'Sent', value: sent, color: 'success.main' },
          { label: 'Suppressed', value: suppressed, color: 'text.secondary' },
          { label: 'Flagged', value: flagged, color: 'error.main' },
          { label: 'Fee recs', value: feeRecs, color: 'warning.main' }
        ].map((s) => (
          <Box key={s.label} sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.7), border: `1px solid ${alpha(theme.palette.divider, 0.08)}`, textAlign: 'center', minWidth: 62 }}>
            <Typography variant="subtitle2" fontWeight={700} color={s.color} lineHeight={1}>{s.value}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>{s.label}</Typography>
          </Box>
        ))}
      </Stack>
      {allGood && (
        <Typography variant="caption" color="text.secondary">
          All {reviewed} lease{reviewed !== 1 ? 's' : ''} reviewed — everything looks good.
        </Typography>
      )}
      {data.actionLogEntries?.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: data.suppressedLeases?.length ? 1.5 : 0 }}>
          {data.actionLogEntries.map((entry, i) => (
            <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CheckCircleFilled style={{ fontSize: 11, color: theme.palette.success.main, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                {entry.message}{' '}
                <Link to={`/landlord/leases/${entry.leaseId}`} style={{ color: theme.palette.primary.main, fontWeight: 600, textDecoration: 'none' }}>
                  View lease →
                </Link>
              </span>
            </Typography>
          ))}
        </Stack>
      )}
      {data.suppressedLeases?.length > 0 && (
        <Box sx={{ mt: data.actionLogEntries?.length > 0 ? 1.5 : 0, p: 1.5, borderRadius: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.04), border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}` }}>
          <Typography variant="caption" fontWeight={600} color="warning.dark" sx={{ display: 'block', mb: 1 }}>
            {data.suppressedLeases.length} lease{data.suppressedLeases.length !== 1 ? 's' : ''} skipped — follow-up already sent recently.
          </Typography>
          <Stack spacing={0.75}>
            {data.suppressedLeases.map((s) => {
              const st = forceState[s.leaseId];
              return (
                <Stack key={s.leaseId} direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
                    {s.tenantNames} · <span style={{ color: theme.palette.text.disabled }}>{s.propertyName}</span>
                  </Typography>
                  {st === 'sent' ? (
                    <Typography variant="caption" color="success.main" fontWeight={600}>Sent ✓</Typography>
                  ) : (
                    <Button size="small" variant="outlined" color="warning" disabled={st === 'loading'} onClick={() => handleForce(s.leaseId)}
                      startIcon={st === 'loading' ? <CircularProgress size={11} color="inherit" /> : null}
                      sx={{ px: 1.5, py: 0.25, fontSize: '0.72rem', textTransform: 'none', minWidth: 0, lineHeight: 1.4 }}>
                      {st === 'loading' ? 'Sending…' : 'Follow up anyway'}
                    </Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

// ─── Decision Step ────────────────────────────────────────────────────────────

function DecisionStep({ icon, color, title, description }) {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: alpha(color, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
        <Box sx={{ fontSize: 14, color }}>{icon}</Box>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{description}</Typography>
      </Box>
    </Stack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionsAgentPage() {
  const theme = useTheme();
  const [fadeIn, setFadeIn] = useState(false);

  // Summary stats
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Recent history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Agent enabled state
  const [enabled, setEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Run state
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    setFadeIn(true);
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.allSettled([loadSummary(), loadHistory(), loadSettings()]);
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await aiFollowUpAPI.getAgentDashboardSummary();
      setSummary(res?.data ?? res ?? null);
    } catch {
      // non-fatal
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await aiFollowUpAPI.getCollectionsHistory(1, 5);
      const data = res?.data;
      setHistory(data?.items ?? []);
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await organizationAPI.getCurrentOrganization();
      if (res?.success && res?.data) {
        setEnabled(res.data.isCollectionsAgentEnabled ?? true);
      }
    } catch {
      // non-fatal
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleToggle = async (value) => {
    setToggling(true);
    const prev = enabled;
    setEnabled(value);
    try {
      const orgRes = await organizationAPI.getCurrentOrganization();
      const maintenanceEnabled = orgRes?.data?.isMaintenanceAgentEnabled ?? true;
      await organizationAPI.updateAgentSettings({
        isCollectionsAgentEnabled: value,
        isMaintenanceAgentEnabled: maintenanceEnabled
      });
      openSnackbar({ open: true, message: `Collections Agent ${value ? 'enabled' : 'disabled'}.`, variant: 'alert', alert: { color: 'success' } });
    } catch {
      setEnabled(prev);
      openSnackbar({ open: true, message: 'Failed to update setting.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setToggling(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await aiFollowUpAPI.runOverdueRentSweep();
      const data = res?.data;
      if (data) {
        setRunResult({ success: true, data });
        const sent = data.messagesSent ?? 0;
        const msg = sent > 0
          ? `Sweep complete — ${sent} message${sent !== 1 ? 's' : ''} sent.`
          : 'Sweep complete — no messages needed right now.';
        openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'success' } });
        // Refresh stats and history after a successful run
        await Promise.allSettled([loadSummary(), loadHistory()]);
      } else {
        setRunResult({ success: true, data: null });
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to run sweep. Please try again.';
      setRunResult({ success: false, message });
      openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setRunning(false);
    }
  };

  const lastRunAt = summary?.lastRunAt ?? summary?.LastRunAt ?? null;
  const followUpsSentThisMonth = summary?.followUpsSentThisMonth ?? summary?.FollowUpsSentThisMonth ?? null;
  const leasesMonitored = summary?.leasesMonitored ?? summary?.LeasesMonitored ?? null;
  const flaggedCount = summary?.flaggedForReview ?? summary?.FlaggedForReview ?? null;

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box>
        {/* ── Header ── */}
        <AnimateIn direction="bottom" delay={80} distance={120}>
          <Box sx={{ mb: 2 }}>
            <PageBreadcrumbs
              items={[
                { label: 'Dashboard', path: '/landlord/dashboard' },
                { label: 'Percy', path: '/landlord/ai-center' },
                { label: 'Collections Agent' }
              ]}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'flex-start' }} justifyContent="space-between" spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Typography variant="h3" fontWeight={700}>Collections Agent</Typography>
                  {settingsLoading ? (
                    <CircularProgress size={14} />
                  ) : enabled ? (
                    <Chip label="Active" size="small" color="success" variant="filled" sx={{ fontWeight: 600 }} />
                  ) : (
                    <Chip label="Disabled" size="small" sx={{ bgcolor: alpha(theme.palette.text.disabled, 0.12), color: 'text.disabled', fontWeight: 500 }} />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                  Reviews active leases each morning, sends tenant-safe payment follow-ups, and flags exceptions for your review.
                  {lastRunAt && <> Last run <strong>{timeAgo(lastRunAt)}</strong>.</>}
                </Typography>
              </Box>

              {/* Controls */}
              <Stack direction="row" alignItems="center" spacing={1.5} flexShrink={0}>
                <Tooltip title={enabled ? 'Disable agent' : 'Enable agent'}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enabled}
                        onChange={(e) => handleToggle(e.target.checked)}
                        disabled={toggling || settingsLoading}
                        size="small"
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="caption" color="text.secondary">
                        {toggling ? 'Saving…' : enabled ? 'Enabled' : 'Disabled'}
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Tooltip>

                <Button
                  variant="contained"
                  size="medium"
                  startIcon={running ? <SyncOutlined spin /> : <PlayCircleOutlined />}
                  onClick={handleRun}
                  disabled={running || !enabled}
                  sx={{
                    px: 2.5,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: 'none' }
                  }}
                >
                  {running ? 'Running…' : 'Run Now'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </AnimateIn>

        {/* ── Stats row ── */}
        <AnimateIn direction="bottom" delay={140} distance={100}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
            <StatBox
              label="Sent This Month"
              value={followUpsSentThisMonth}
              sub="follow-ups"
              color={theme.palette.success.main}
              icon={<SendOutlined />}
              loading={summaryLoading}
            />
            <StatBox
              label="Leases Monitored"
              value={leasesMonitored}
              sub="active leases"
              color={theme.palette.primary.main}
              icon={<DollarCircleOutlined />}
              loading={summaryLoading}
            />
            <StatBox
              label="Flagged for Review"
              value={flaggedCount}
              sub="need attention"
              color={flaggedCount > 0 ? theme.palette.error.main : theme.palette.text.disabled}
              icon={<ExclamationCircleOutlined />}
              loading={summaryLoading}
            />
            <StatBox
              label="Next Run"
              value="9:00 AM"
              sub="daily schedule"
              color={theme.palette.warning.main}
              icon={<ClockCircleOutlined />}
              loading={false}
            />
          </Stack>
        </AnimateIn>

        {/* ── Run result ── */}
        {(running || runResult) && (
          <AnimateIn direction="bottom" delay={0} distance={60}>
            {running ? (
              <Box sx={{ mb: 2.5, p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`, bgcolor: alpha(theme.palette.primary.main, 0.04), display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={18} thickness={5} />
                <Box>
                  <Typography variant="body2" fontWeight={600} color="primary">Running Collections Agent…</Typography>
                  <Typography variant="caption" color="text.secondary">Reviewing leases and sending follow-ups. This may take up to 30 seconds.</Typography>
                </Box>
              </Box>
            ) : runResult?.success && runResult?.data ? (
              <SweepResult data={runResult.data} />
            ) : runResult && !runResult.success ? (
              <Alert severity="error" sx={{ mb: 2.5 }}>{runResult.message}</Alert>
            ) : null}
          </AnimateIn>
        )}

        <Grid container spacing={2.5}>
          {/* ── Left column ── */}
          <Grid size={{ xs: 12, lg: 8 }}>

            {/* Recent activity */}
            <AnimateIn direction="bottom" delay={200} distance={100}>
              <MainCard
                title={
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.68rem', letterSpacing: 1, display: 'block', lineHeight: 1.4 }}>RECENT ACTIVITY</Typography>
                      <Typography variant="h5" fontWeight={700}>Latest Agent Actions</Typography>
                    </Box>
                    <Link
                      to="/landlord/ai-center/collections-history"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: theme.palette.primary.main, fontWeight: 600, textDecoration: 'none' }}
                    >
                      <HistoryOutlined style={{ fontSize: 13 }} />
                      View Full History
                    </Link>
                  </Stack>
                }
                sx={{ mb: 2.5, border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 'none' }}
              >
                {historyLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : history.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <HistoryOutlined style={{ fontSize: 32, color: theme.palette.text.disabled, marginBottom: 8 }} />
                    <Typography variant="body2" color="text.secondary">No activity yet. Run the agent to get started.</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PlayCircleOutlined />}
                      onClick={handleRun}
                      disabled={running || !enabled}
                      sx={{ mt: 1.5, textTransform: 'none' }}
                    >
                      Run Now
                    </Button>
                  </Box>
                ) : (
                  <Stack spacing={0}>
                    {history.map((item, idx) => (
                      <Box
                        key={item.id}
                        sx={{
                          py: 1.5,
                          px: 0.5,
                          borderBottom: idx < history.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.06)}` : 'none'
                        }}
                      >
                        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }} flexWrap="wrap" gap={0.5}>
                              <ActionChip type={item.actionType} isManual={item.isManual} />
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                {item.createdAt ? timeAgo(item.createdAt) : '—'}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" fontWeight={500}>{item.tenantNames || '—'}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.propertyName || '—'}</Typography>
                            {item.message && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5, fontStyle: 'italic' }}
                              >
                                &ldquo;{item.message}&rdquo;
                              </Typography>
                            )}
                          </Box>
                          <Link
                            to={`/landlord/leases/${item.leaseId}`}
                            style={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none', flexShrink: 0, paddingTop: 2 }}
                          >
                            View →
                          </Link>
                        </Stack>
                      </Box>
                    ))}
                    <Box sx={{ pt: 1.5, textAlign: 'center' }}>
                      <Link
                        to="/landlord/ai-center/collections-history"
                        style={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        View all history <ArrowRightOutlined />
                      </Link>
                    </Box>
                  </Stack>
                )}
              </MainCard>
            </AnimateIn>

          </Grid>

          {/* ── Right column ── */}
          <Grid size={{ xs: 12, lg: 4 }}>

            {/* How it decides */}
            <AnimateIn direction="bottom" delay={240} distance={100}>
              <MainCard sx={{ mb: 2.5, border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 'none' }}>
                <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.68rem', letterSpacing: 1, display: 'block', lineHeight: 1.4 }}>DECISION LOGIC</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>How the Agent Decides</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, lineHeight: 1.5 }}>
                  On each run, the agent reviews every active lease and picks the right action based on your lease rules, payment history, and grace periods.
                </Typography>

                <Stack spacing={2}>
                  <DecisionStep
                    icon={<SendOutlined />}
                    color={theme.palette.success.main}
                    title="Friendly Reminder"
                    description="Rent is due soon or just overdue. No prior history of issues. Agent sends a polite reminder with payment instructions."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <DecisionStep
                    icon={<ClockCircleOutlined />}
                    color={theme.palette.info.main}
                    title="Hold — Grace Period Active"
                    description="Rent is overdue but still within the grace period defined in the lease. Agent waits and will follow up once the grace window closes."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <DecisionStep
                    icon={<WarningOutlined />}
                    color={theme.palette.warning.main}
                    title="Late Notice"
                    description="Grace period has passed. Agent drafts a firm late notice and notes that fees may apply, per the lease agreement."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <DecisionStep
                    icon={<DollarCircleOutlined />}
                    color={theme.palette.warning.dark}
                    title="Fee Recommendation"
                    description="Tenant is significantly overdue. Agent flags a late fee recommendation for your approval — it never applies fees automatically."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <DecisionStep
                    icon={<ExclamationCircleOutlined />}
                    color={theme.palette.error.main}
                    title="Flagged for Review"
                    description="Repeat late payer, escalating pattern, or unusual situation. Agent surfaces the lease for your direct attention."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <DecisionStep
                    icon={<StopOutlined />}
                    color={theme.palette.text.disabled}
                    title="Suppressed — Skip"
                    description="A follow-up was already sent recently. Agent skips to avoid messaging tenants too frequently."
                  />
                </Stack>
              </MainCard>
            </AnimateIn>

            {/* Guardrails */}
            <AnimateIn direction="bottom" delay={280} distance={100}>
              <MainCard
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  boxShadow: 'none'
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <ThunderboltOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
                  <Typography variant="subtitle2" fontWeight={700}>Guardrails</Typography>
                </Stack>
                <Stack spacing={1}>
                  {[
                    'Never applies fees or escalates without your explicit approval',
                    'Suppression prevents messaging tenants more than once per window',
                    'Grace period rules are read directly from your lease terms',
                    'All messages are personalized per tenant by Claude Sonnet 4.6',
                    'Full history of every action is logged and searchable'
                  ].map((item, i) => (
                    <Stack key={i} direction="row" spacing={0.75} alignItems="flex-start">
                      <CheckCircleFilled style={{ fontSize: 12, color: theme.palette.success.main, flexShrink: 0, marginTop: 3 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </MainCard>
            </AnimateIn>

          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
}
