import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  AlertOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DollarOutlined,
  FileProtectOutlined,
  HomeOutlined,
  ReloadOutlined,
  RiseOutlined,
  TeamOutlined,
  ToolOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts';
import axios from 'utils/axios';

const WINDOWS = [7, 30, 90];
const numberFormatter = new Intl.NumberFormat();
const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatNumber = (value) => numberFormatter.format(value ?? 0);
const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
};

function Section({ title, eyebrow, action, children, sx }) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', ...sx }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}
      >
        <Box>
          {eyebrow && (
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
              {eyebrow}
            </Typography>
          )}
          <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
        {action && <Box sx={{ maxWidth: '100%' }}>{action}</Box>}
      </Stack>
      <Divider />
      {children}
    </Paper>
  );
}

function MetricCard({ label, value, helper, icon: Icon, tone = 'primary' }) {
  return (
    <Paper
      elevation={0}
      sx={(theme) => ({
        height: '100%',
        p: 2.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 'auto 0 0',
          height: 3,
          bgcolor: theme.palette[tone]?.main || theme.palette.primary.main
        }
      })}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 750, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 650 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: theme.palette[tone]?.main || theme.palette.primary.main,
            bgcolor: alpha(theme.palette[tone]?.main || theme.palette.primary.main, 0.1),
            borderRadius: 1
          })}
        >
          <Icon style={{ fontSize: 19 }} />
        </Box>
      </Stack>
    </Paper>
  );
}

function MiniStat({ label, value, color = 'text.primary' }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h4" color={color} sx={{ fontWeight: 750 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function MixBars({ items, color = 'primary.main', emptyLabel }) {
  const total = items?.reduce((sum, item) => sum + item.count, 0) || 0;
  if (!total) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {items.map((item) => (
        <Box key={item.name}>
          <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 0.5 }}>
            <Typography variant="body2" noWrap>{item.name || 'Unspecified'}</Typography>
            <Typography variant="body2" fontWeight={700}>{formatNumber(item.count)}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={(item.count / total) * 100}
            sx={{ height: 5, borderRadius: 0, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 0 } }}
          />
        </Box>
      ))}
    </Stack>
  );
}

function LoadingState() {
  return (
    <Box aria-busy="true" aria-label="Loading command center">
      <Skeleton variant="rounded" height={190} sx={{ borderRadius: 1.5, mb: 3 }} />
      <Grid container spacing={2}>
        {[0, 1, 2, 3, 4].map((item) => (
          <Grid key={item} size={{ xs: 12, sm: 6, lg: 2.4 }}>
            <Skeleton variant="rounded" height={132} sx={{ borderRadius: 1.5 }} />
          </Grid>
        ))}
        <Grid size={{ xs: 12, lg: 8 }}><Skeleton variant="rounded" height={360} sx={{ borderRadius: 1.5 }} /></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><Skeleton variant="rounded" height={360} sx={{ borderRadius: 1.5 }} /></Grid>
      </Grid>
    </Box>
  );
}

export default function AdminDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [windowDays, setWindowDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const activeRequestRef = useRef({ controller: null, sequence: 0 });

  const loadSummary = useCallback(async (days, background = false) => {
    activeRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const sequence = activeRequestRef.current.sequence + 1;
    activeRequestRef.current = { controller, sequence };

    background ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/admin/dashboard/summary', {
        params: { windowDays: days },
        signal: controller.signal
      });
      if (activeRequestRef.current.sequence === sequence) {
        setSummary(response.data?.data || response.data);
      }
    } catch (requestError) {
      if (!controller.signal.aborted && activeRequestRef.current.sequence === sequence) {
        setError(requestError.response?.data?.message || 'The command center could not load production aggregates.');
      }
    } finally {
      if (activeRequestRef.current.sequence === sequence) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadSummary(windowDays);
    return () => {
      activeRequestRef.current.controller?.abort();
      activeRequestRef.current = { controller: null, sequence: activeRequestRef.current.sequence + 1 };
    };
  }, [loadSummary, windowDays]);

  const chartData = useMemo(
    () => summary?.growth?.map((bucket) => ({
      date: dateFormatter.format(new Date(bucket.dateUtc)),
      users: bucket.users,
      organizations: bucket.organizations
    })) || [],
    [summary]
  );

  const handleWindowChange = (_event, value) => {
    if (value) setWindowDays(value);
  };

  if (loading && !summary) return <LoadingState />;

  if (!summary) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, border: 1, borderColor: 'divider', borderRadius: 1.5, textAlign: 'center' }}>
        <AlertOutlined style={{ fontSize: 34, color: theme.palette.error.main }} />
        <Typography variant="h4" sx={{ mt: 2 }}>Command center unavailable</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{error}</Typography>
        <Button variant="contained" startIcon={<ReloadOutlined />} onClick={() => loadSummary(windowDays)}>Retry</Button>
      </Paper>
    );
  }

  const { accounts, subscriptions, portfolio, maintenance, support, system } = summary;
  const occupancy = portfolio.occupancyPercent == null ? '—' : `${portfolio.occupancyPercent}%`;

  return (
    <Stack spacing={3}>
      <Paper
        component="header"
        elevation={0}
        sx={(currentTheme) => ({
          p: { xs: 2.5, md: 3.5 },
          color: '#fff',
          borderRadius: 1.5,
          overflow: 'hidden',
          position: 'relative',
          background: currentTheme.palette.mode === 'dark'
            ? 'linear-gradient(120deg, #12242a 0%, #193841 62%, #1f4d52 100%)'
            : 'linear-gradient(120deg, #102f38 0%, #174b53 62%, #24656a 100%)',
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 300,
            height: 300,
            right: -90,
            top: -180,
            border: '50px solid rgba(255,255,255,0.06)',
            transform: 'rotate(18deg)'
          }
        })}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Chip
                size="small"
                icon={<CheckCircleOutlined />}
                label="PRODUCTION DATA"
                sx={{ color: '#d8ffef', bgcolor: 'rgba(72, 204, 158, 0.16)', borderRadius: 0.75, fontWeight: 750, '& .MuiChip-icon': { color: '#79dfba' } }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>Cross-tenant aggregate view</Typography>
            </Stack>
            <Typography component="h1" sx={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontSize: { xs: 28, sm: 36 }, fontWeight: 700, letterSpacing: '-0.04em' }}>
              Platform Command Center
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', mt: 0.75, maxWidth: 660 }}>
              Account growth, subscription risk, portfolio operations, and platform health from one secure operational surface.
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <ClockCircleOutlined />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                Last refreshed {dateTimeFormatter.format(new Date(summary.generatedAtUtc))}
              </Typography>
            </Stack>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={windowDays}
              onChange={handleWindowChange}
              aria-label="Reporting window"
              sx={{ bgcolor: 'rgba(0,0,0,0.18)', '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.76)', borderColor: 'rgba(255,255,255,0.2)', px: 1.6, '&.Mui-selected': { color: '#102f38', bgcolor: '#fff', '&:hover': { bgcolor: '#fff' } } } }}
            >
              {WINDOWS.map((days) => <ToggleButton key={days} value={days} aria-label={`${days} day window`}>{days}D</ToggleButton>)}
            </ToggleButtonGroup>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <ReloadOutlined />}
              onClick={() => loadSummary(windowDays, true)}
              disabled={refreshing}
              sx={{ borderColor: 'rgba(255,255,255,0.35)', borderRadius: 0.75 }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => loadSummary(windowDays, true)}>Retry</Button>}>{error}</Alert>}

      <Grid container spacing={2} aria-label="Platform key performance indicators">
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><MetricCard label="Production users" value={formatNumber(accounts.productionUsers)} helper={`+${formatNumber(accounts.newUsers)} in ${windowDays} days`} icon={TeamOutlined} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><MetricCard label="Active organizations" value={formatNumber(accounts.activeOrganizations)} helper={`+${formatNumber(accounts.newOrganizations)} in ${windowDays} days`} icon={ApartmentOutlined} tone="success" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><MetricCard label="Active paid" value={formatNumber(subscriptions.activePaid)} helper={`${formatNumber(subscriptions.trials)} trials`} icon={DollarOutlined} tone="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><MetricCard label="Portfolio units" value={formatNumber(portfolio.units)} helper={`${occupancy} occupied`} icon={HomeOutlined} tone="info" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><MetricCard label="Open maintenance" value={formatNumber(maintenance.open)} helper={`${formatNumber(maintenance.highPriority)} high priority`} icon={ToolOutlined} tone={maintenance.highPriority ? 'error' : 'success'} /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Section title="Account growth" eyebrow={`${windowDays}-day acquisition signal`} action={<Chip size="small" label={`${formatNumber(accounts.recentlyActiveUsers)} recently active`} icon={<RiseOutlined />} sx={{ borderRadius: 0.75 }} />}>
            <Box
              role="img"
              aria-label={`Account growth over ${windowDays} days. The chart compares daily new production users and organizations.`}
              sx={{ height: { xs: 260, sm: 320 }, p: { xs: 1, sm: 2 }, pl: 0 }}
            >
              {chartData.some((item) => item.users || item.organizations) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrowth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} /><stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.02} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="date" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={isMobile ? 35 : 20} />
                    <YAxis allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ChartTooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 4 }} />
                    <Area type="monotone" dataKey="users" name="New users" stroke={theme.palette.primary.main} fill="url(#userGrowth)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="organizations" name="New organizations" stroke={theme.palette.success.main} fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Stack height="100%" alignItems="center" justifyContent="center"><UserAddOutlined style={{ fontSize: 28, opacity: 0.5 }} /><Typography color="text.secondary" sx={{ mt: 1 }}>No new production accounts in this window.</Typography></Stack>
              )}
            </Box>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Section title="Attention queue" eyebrow="Actionable now" action={<Chip size="small" color={summary.attentionQueue.length ? 'warning' : 'success'} label={`${summary.attentionQueue.length} signals`} sx={{ borderRadius: 0.75 }} />} sx={{ height: '100%' }}>
            <Stack divider={<Divider flexItem />}>
              {summary.attentionQueue.length ? summary.attentionQueue.map((item) => (
                <Box key={item.key} component="button" onClick={() => navigate(item.route)} sx={{ width: '100%', p: 2, border: 0, bgcolor: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { bgcolor: 'action.hover', outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 1, color: `${item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'info'}.main`, bgcolor: (currentTheme) => alpha(currentTheme.palette[item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'info'].main, 0.1), fontWeight: 800 }}>{compactFormatter.format(item.count)}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={700}>{item.title}</Typography><Typography variant="caption" color="text.secondary">{item.detail}</Typography></Box>
                    <ArrowRightOutlined aria-hidden="true" />
                  </Stack>
                </Box>
              )) : (
                <Stack alignItems="center" justifyContent="center" sx={{ p: 5, minHeight: 250, textAlign: 'center' }}><CheckCircleOutlined style={{ fontSize: 34, color: theme.palette.success.main }} /><Typography variant="h6" sx={{ mt: 1.5 }}>No active signals</Typography><Typography variant="body2" color="text.secondary">The aggregate checks surfaced no items requiring attention.</Typography></Stack>
              )}
            </Stack>
          </Section>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <Section title="Subscription health" eyebrow="Commercial pulse" action={<Tooltip title={subscriptions.runRateLabel}><Chip icon={<DollarOutlined />} label={currencyFormatter.format(subscriptions.activePaidListPriceMonthlyRunRate)} size="small" sx={{ borderRadius: 0.75 }} /></Tooltip>}>
            <Grid container spacing={2} sx={{ p: 2.5 }}>
              <Grid size={6}><MiniStat label="Past due / unpaid" value={formatNumber(subscriptions.pastDueOrUnpaid)} color={subscriptions.pastDueOrUnpaid ? 'error.main' : 'success.main'} /></Grid>
              <Grid size={6}><MiniStat label="Scheduled cancellation" value={formatNumber(subscriptions.scheduledCancellation)} /></Grid>
              <Grid size={6}><MiniStat label="Trials ending in 7d" value={formatNumber(subscriptions.trialsEndingWithin7Days)} color={subscriptions.trialsEndingWithin7Days ? 'warning.main' : 'text.primary'} /></Grid>
              <Grid size={6}><MiniStat label="Active trials" value={formatNumber(subscriptions.trials)} /></Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2.5, pb: 2.5 }}>
              {subscriptions.runRateLabel}. This is list-price run rate, not recognized revenue.
            </Typography>
            <Divider />
            <Box sx={{ p: 2.5 }}><Typography variant="subtitle2" sx={{ mb: 2 }}>Current plan mix</Typography><MixBars items={subscriptions.planMix} color="success.main" emptyLabel="No active or trial subscriptions." /></Box>
            <Divider />
            <Box sx={{ p: 2.5 }}><Typography variant="subtitle2" sx={{ mb: 2 }}>Status mix</Typography><MixBars items={subscriptions.statusMix} emptyLabel="No production subscriptions." /></Box>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <Section title="Portfolio operations" eyebrow="Production footprint">
            <Grid container spacing={2} sx={{ p: 2.5 }}>
              <Grid size={6}><MiniStat label="Properties" value={formatNumber(portfolio.properties)} /></Grid>
              <Grid size={6}><MiniStat label="Units" value={formatNumber(portfolio.units)} /></Grid>
              <Grid size={6}><MiniStat label="Occupied" value={formatNumber(portfolio.occupiedUnits)} color="success.main" /></Grid>
              <Grid size={6}><MiniStat label="Vacant" value={formatNumber(portfolio.vacantUnits)} color={portfolio.vacantUnits ? 'warning.main' : 'text.primary'} /></Grid>
            </Grid>
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Unit occupancy</Typography><Typography variant="body2" fontWeight={750}>{occupancy}</Typography></Stack>
              <LinearProgress variant="determinate" value={portfolio.occupancyPercent || 0} sx={{ mt: 1, height: 8, borderRadius: 0, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: 'success.main', borderRadius: 0 } }} />
            </Box>
            <Divider />
            <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} sx={{ p: 2.5 }}>
              <Box flex={1}><MiniStat label="Active leases" value={formatNumber(portfolio.activeLeases)} /></Box>
              <Box flex={1} sx={{ pl: 2.5 }}><MiniStat label="Expiring in 30d" value={formatNumber(portfolio.leasesExpiringWithin30Days)} color={portfolio.leasesExpiringWithin30Days ? 'warning.main' : 'text.primary'} /></Box>
            </Stack>
            <Divider />
            <Box sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Maintenance workload</Typography>
              <Grid container spacing={2}>
                <Grid size={6}><MiniStat label="Open" value={formatNumber(maintenance.open)} /></Grid>
                <Grid size={6}><MiniStat label="High priority" value={formatNumber(maintenance.highPriority)} color={maintenance.highPriority ? 'error.main' : 'success.main'} /></Grid>
                <Grid size={6}><MiniStat label="Stale over 7d" value={formatNumber(maintenance.staleOver7Days)} /></Grid>
                <Grid size={6}><MiniStat label="Unassigned" value={formatNumber(maintenance.unassigned)} /></Grid>
              </Grid>
            </Box>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <Stack spacing={3}>
            <Section title="Support backlog" eyebrow="Production accounts" action={<Button size="small" endIcon={<ArrowRightOutlined />} onClick={() => navigate('/admin/messages?tab=support')}>Open support desk</Button>}>
              <Grid container spacing={2} sx={{ p: 2.5 }}>
                <Grid size={4}><MiniStat label="Unresolved" value={formatNumber(support.unresolved)} color={support.unresolved ? 'warning.main' : 'success.main'} /></Grid>
                <Grid size={4}><MiniStat label="Older than 7d" value={formatNumber(support.olderThan7Days)} /></Grid>
                <Grid size={4}><MiniStat label={`New in ${windowDays}d`} value={formatNumber(support.newWithinWindow)} /></Grid>
              </Grid>
              <Box sx={{ px: 2.5, pb: 2.5 }}><MixBars items={support.typeMix} color="warning.main" emptyLabel="No unresolved production support items." /></Box>
            </Section>

            <Section title="System pulse" eyebrow="Jobs & managed storage" action={<Tooltip title="Open background jobs"><IconButton size="small" aria-label="Open background jobs" onClick={() => navigate('/admin/jobs')}><ArrowRightOutlined /></IconButton></Tooltip>}>
              <Stack spacing={2} sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center"><CloudServerOutlined style={{ fontSize: 20, color: theme.palette.info.main }} /><Box flex={1}><Typography variant="body2" fontWeight={700}>{system.latestJobName || 'No job runs recorded'}</Typography><Typography variant="caption" color="text.secondary">Latest job {system.latestJobStartedAtUtc ? dateTimeFormatter.format(new Date(system.latestJobStartedAtUtc)) : ''}</Typography></Box><Chip size="small" label={system.latestJobStatus || 'No data'} color={system.latestJobStatus === 'Failed' ? 'error' : system.latestJobStatus === 'Completed' ? 'success' : 'default'} sx={{ borderRadius: 0.75 }} /></Stack>
                <Divider />
                <Grid container spacing={2}>
                  <Grid size={6}><MiniStat label="Jobs running" value={formatNumber(system.jobsRunning)} /></Grid>
                  <Grid size={6}><MiniStat label={`Failed in ${windowDays}d`} value={formatNumber(system.jobsFailedWithinWindow)} color={system.jobsFailedWithinWindow ? 'error.main' : 'success.main'} /></Grid>
                </Grid>
                <Divider />
                <Stack direction="row" spacing={1.5} alignItems="center"><DatabaseOutlined style={{ fontSize: 20, color: theme.palette.success.main }} /><Box flex={1}><Typography variant="body2" fontWeight={700}>{formatBytes(system.storageBytes)} managed</Typography><Typography variant="caption" color="text.secondary">{formatNumber(system.storedObjects)} active production objects</Typography></Box><Button size="small" onClick={() => navigate('/admin/storage')}>Inspect</Button></Stack>
              </Stack>
            </Section>
          </Stack>
        </Grid>
      </Grid>

      <Section title="Recent production accounts" eyebrow="Newest users" action={<Button size="small" endIcon={<ArrowRightOutlined />} onClick={() => navigate('/admin/users')}>View all</Button>}>
        {summary.recentAccounts.length ? (
          <Grid container component="ul" spacing={0} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {summary.recentAccounts.map((account, index) => (
              <Grid component="li" key={account.userId} size={{ xs: 12, md: 6 }} sx={{ borderBottom: 1, borderRight: { md: index % 2 === 0 ? 1 : 0 }, borderColor: 'divider', '&:nth-last-of-type(-n+2)': { borderBottom: { md: 0 } }, '&:last-of-type': { borderBottom: 0 } }}>
                <Box component="button" onClick={() => navigate(`/admin/users/${account.userId}`)} sx={{ width: '100%', border: 0, bgcolor: 'transparent', color: 'inherit', p: 2.25, textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { bgcolor: 'action.hover', outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.selected', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{(account.displayName || account.email || '?').charAt(0).toUpperCase()}</Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" fontWeight={750} noWrap>{account.displayName || 'Unnamed account'}</Typography>{account.isSuspended && <Chip size="small" color="error" label="Suspended" sx={{ height: 20, borderRadius: 0.5 }} />}</Stack><Typography variant="caption" color="text.secondary" noWrap display="block">{account.email}{account.company ? ` · ${account.company}` : ''}</Typography><Typography variant="caption" color="text.secondary">Joined {dateFormatter.format(new Date(account.createdAtUtc))} · Active {dateFormatter.format(new Date(account.lastActiveAtUtc))}</Typography></Box>
                    <ArrowRightOutlined aria-hidden="true" />
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Stack alignItems="center" sx={{ p: 5 }}><FileProtectOutlined style={{ fontSize: 30, opacity: 0.5 }} /><Typography color="text.secondary" sx={{ mt: 1 }}>No production accounts are available.</Typography></Stack>
        )}
      </Section>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Scope: {summary.dataScope} Subscription run rate is list-price based and is not recognized revenue. Operational counts contain no tenant, message, support-message, or maintenance-description bodies.
      </Typography>
    </Stack>
  );
}
