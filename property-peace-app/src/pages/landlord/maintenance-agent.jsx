import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Fade,
  alpha,
  useTheme,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
  Grid
} from '@mui/material';
import {
  ToolOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  MessageOutlined,
  BulbOutlined,
  FileTextOutlined,
  BellOutlined,
  StopOutlined,
  PictureOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  TagOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import AnimateIn from 'components/AnimateIn';
import { organizationAPI } from 'api';
import { useSelector } from 'react-redux';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import { openSnackbar } from 'api/snackbar';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { isHighPriorityMaintenanceRequest, isOpenMaintenanceRequest } from 'utils/maintenanceStatus';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Triage Step ──────────────────────────────────────────────────────────────

function TriageStep({ step, icon, color, title, description }) {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '50%',
            bgcolor: alpha(color, 0.1),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${alpha(color, 0.3)}`
          }}
        >
          <Box sx={{ fontSize: 13, color }}>{icon}</Box>
        </Box>
        <Typography
          variant="caption"
          sx={{
            position: 'absolute', top: -6, right: -6,
            width: 16, height: 16, borderRadius: '50%',
            bgcolor: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem', fontWeight: 700, lineHeight: 1
          }}
        >
          {step}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, pt: 0.25 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{description}</Typography>
      </Box>
    </Stack>
  );
}

// ─── Priority Chip ────────────────────────────────────────────────────────────

function PriorityChip({ priority }) {
  const map = {
    high:   { label: 'High',   color: 'error'   },
    medium: { label: 'Medium', color: 'warning' },
    low:    { label: 'Low',    color: 'default' }
  };
  const cfg = map[(priority || '').toLowerCase()] ?? { label: priority || '—', color: 'default' };
  return <Chip label={cfg.label} size="small" color={cfg.color} variant="outlined" sx={{ fontWeight: 500, fontSize: '0.68rem', height: 20 }} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenanceAgentPage() {
  const theme = useTheme();
  const [fadeIn, setFadeIn] = useState(false);

  const allMaintenance = useSelector(selectMaintenanceRequests);

  const [enabled, setEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    setFadeIn(true);
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await organizationAPI.getCurrentOrganization();
      if (res?.success && res?.data) {
        setEnabled(res.data.isMaintenanceAgentEnabled ?? true);
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
      const collectionsEnabled = orgRes?.data?.isCollectionsAgentEnabled ?? true;
      await organizationAPI.updateAgentSettings({
        isCollectionsAgentEnabled: collectionsEnabled,
        isMaintenanceAgentEnabled: value
      });
      openSnackbar({ open: true, message: `Maintenance Agent ${value ? 'enabled' : 'disabled'}.`, variant: 'alert', alert: { color: 'success' } });
    } catch {
      setEnabled(prev);
      openSnackbar({ open: true, message: 'Failed to update setting.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setToggling(false);
    }
  };

  // Derive stats from the maintenance store
  const recentTickets = (allMaintenance || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.CreatedAt || 0) - new Date(a.createdAt || a.CreatedAt || 0))
    .slice(0, 5);

  const totalTickets = (allMaintenance || []).length;
  const openTickets = (allMaintenance || []).filter(isOpenMaintenanceRequest).length;
  const highPriority = (allMaintenance || []).filter(isHighPriorityMaintenanceRequest).length;

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
                { label: 'Maintenance Agent' }
              ]}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'flex-start' }} justifyContent="space-between" spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Typography variant="h3" fontWeight={700}>Maintenance Agent</Typography>
                  {settingsLoading ? (
                    <CircularProgress size={14} />
                  ) : enabled ? (
                    <Chip label="Active" size="small" color="success" variant="filled" sx={{ fontWeight: 600 }} />
                  ) : (
                    <Chip label="Disabled" size="small" sx={{ bgcolor: alpha(theme.palette.text.disabled, 0.12), color: 'text.disabled', fontWeight: 500 }} />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                  Helps tenants describe maintenance issues, collects the right context, and turns conversations into organized tickets for review.
                </Typography>
              </Box>

              {/* Toggle */}
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
              </Stack>
            </Stack>
          </Box>
        </AnimateIn>

        {/* ── Stats row ── */}
        <AnimateIn direction="bottom" delay={140} distance={100}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
            <StatBox
              label="Total Tickets"
              value={totalTickets}
              sub="all time"
              color={theme.palette.primary.main}
              icon={<FileTextOutlined />}
              loading={false}
            />
            <StatBox
              label="Open Tickets"
              value={openTickets}
              sub="need attention"
              color={openTickets > 0 ? theme.palette.warning.main : theme.palette.text.disabled}
              icon={<ToolOutlined />}
              loading={false}
            />
            <StatBox
              label="High Priority"
              value={highPriority}
              sub="urgent issues"
              color={highPriority > 0 ? theme.palette.error.main : theme.palette.text.disabled}
              icon={<BellOutlined />}
              loading={false}
            />
            <StatBox
              label="Trigger"
              value="Tenant"
              sub="chat-based triage"
              color={theme.palette.info.main}
              icon={<MessageOutlined />}
              loading={false}
            />
          </Stack>
        </AnimateIn>

        <Grid container spacing={2.5}>
          {/* ── Left column ── */}
          <Grid size={{ xs: 12, lg: 8 }}>

            {/* Recent tickets */}
            <AnimateIn direction="bottom" delay={200} distance={100}>
              <MainCard
                title={
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.68rem', letterSpacing: 1, display: 'block', lineHeight: 1.4 }}>RECENT ACTIVITY</Typography>
                      <Typography variant="h5" fontWeight={700}>Latest Maintenance Tickets</Typography>
                    </Box>
                    <Link
                      to="/landlord/maintenances"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: theme.palette.primary.main, fontWeight: 600, textDecoration: 'none' }}
                    >
                      View All <ArrowRightOutlined />
                    </Link>
                  </Stack>
                }
                sx={{ mb: 2.5, border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 'none' }}
              >
                {recentTickets.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <ToolOutlined style={{ fontSize: 32, color: theme.palette.text.disabled, marginBottom: 8 }} />
                    <Typography variant="body2" color="text.secondary">No maintenance tickets yet.</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                      Tenants submit requests through the chat agent — they&apos;ll appear here.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={0}>
                    {recentTickets.map((ticket, idx) => {
                      const title = ticket.title || ticket.Title || 'Maintenance request';
                      const property = ticket.propertyName || ticket.PropertyName || ticket.property?.name || ticket.Property?.Name || '—';
                      const unit = ticket.unitName || ticket.UnitName || ticket.unit?.name || ticket.Unit?.Name || null;
                      const priority = ticket.priority || ticket.Priority || '';
                      const status = ticket.status || ticket.Status || '';
                      const createdAt = ticket.createdAt || ticket.CreatedAt || ticket.dateSubmitted || ticket.DateSubmitted;
                      const id = ticket.id || ticket.Id;

                      return (
                        <Box
                          key={id}
                          sx={{
                            py: 1.5,
                            px: 0.5,
                            borderBottom: idx < recentTickets.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.06)}` : 'none'
                          }}
                        >
                          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }} flexWrap="wrap" gap={0.5}>
                                <PriorityChip priority={priority} />
                                {status && (
                                  <Chip label={status} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 500 }} />
                                )}
                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                  {createdAt ? timeAgo(createdAt) : '—'}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" fontWeight={500}>{title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {property}{unit ? ` · ${unit}` : ''}
                              </Typography>
                            </Box>
                            <Link
                              to="/landlord/maintenances"
                              style={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none', flexShrink: 0, paddingTop: 2 }}
                            >
                              View →
                            </Link>
                          </Stack>
                        </Box>
                      );
                    })}
                    <Box sx={{ pt: 1.5, textAlign: 'center' }}>
                      <Link
                        to="/landlord/maintenances"
                        style={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        View all tickets <ArrowRightOutlined />
                      </Link>
                    </Box>
                  </Stack>
                )}
              </MainCard>
            </AnimateIn>

          </Grid>

          {/* ── Right column ── */}
          <Grid size={{ xs: 12, lg: 4 }}>

            {/* Triage flow */}
            <AnimateIn direction="bottom" delay={240} distance={100}>
              <MainCard sx={{ mb: 2.5, border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 'none' }}>
                <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.68rem', letterSpacing: 1, display: 'block', lineHeight: 1.4 }}>TRIAGE FLOW</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>How the Agent Works</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, lineHeight: 1.5 }}>
                  When a tenant starts a maintenance request, the agent guides them through a structured conversation so you receive complete, organized tickets.
                </Typography>

                <Stack spacing={2}>
                  <TriageStep
                    step={1}
                    icon={<MessageOutlined />}
                    color={theme.palette.primary.main}
                    title="Tenant Starts Chat"
                    description="Tenant opens the maintenance request flow and describes the issue in their own words."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <TriageStep
                    step={2}
                    icon={<BulbOutlined />}
                    color={theme.palette.info.main}
                    title="Agent Asks Clarifying Questions"
                    description="The agent follows up with targeted questions — location, urgency, how long the issue has been happening — to fully understand the problem."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <TriageStep
                    step={3}
                    icon={<PictureOutlined />}
                    color={theme.palette.warning.main}
                    title="Photo Upload (Optional)"
                    description="Tenants can attach photos directly in the chat to document damage or show the exact issue."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <TriageStep
                    step={4}
                    icon={<TagOutlined />}
                    color={theme.palette.warning.dark}
                    title="Auto-Categorizes & Sets Priority"
                    description="Based on the conversation, the agent determines the category (plumbing, electrical, HVAC, etc.) and priority level — no manual sorting needed."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <TriageStep
                    step={5}
                    icon={<FileTextOutlined />}
                    color={theme.palette.success.main}
                    title="Ticket Submitted"
                    description="A fully formed maintenance ticket is created with all context, so you or your team can act immediately."
                  />
                  <Divider sx={{ opacity: 0.4 }} />
                  <TriageStep
                    step={6}
                    icon={<BellOutlined />}
                    color={theme.palette.error.main}
                    title="Landlord Notified"
                    description="You receive a notification with a link to the new ticket. Vendor dispatch always requires your explicit approval."
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
                    'Never dispatches a vendor without your explicit approval',
                    'Tenants can only submit for their own unit — no cross-unit access',
                    'Priority is set by the agent, but you can always override it',
                    'Photos are stored securely and linked directly to the ticket',
                    'Agent never promises resolution timelines on your behalf',
                    'Powered by Claude Sonnet 4.6 — empathetic, accurate, on-brand'
                  ].map((item, i) => (
                    <Stack key={i} direction="row" spacing={0.75} alignItems="flex-start">
                      <CheckCircleFilled style={{ fontSize: 12, color: theme.palette.success.main, flexShrink: 0, marginTop: 3 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Divider sx={{ my: 2, opacity: 0.5 }} />

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <StopOutlined style={{ fontSize: 14, color: theme.palette.text.disabled }} />
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Disabled Agent Behavior</Typography>
                </Stack>
                <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
                  When disabled, tenants are directed to submit requests manually. Existing tickets are not affected.
                </Typography>
              </MainCard>
            </AnimateIn>

          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
}
