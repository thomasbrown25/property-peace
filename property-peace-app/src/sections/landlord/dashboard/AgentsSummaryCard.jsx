import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  alpha, Box, Button, Chip, Divider, Menu, MenuItem, Stack, Switch,
  Tooltip, Typography, useTheme
} from '@mui/material';
import MainCard from 'components/MainCard';
import { RobotOutlined, ToolOutlined, ShopOutlined, AuditOutlined, SettingOutlined, DownOutlined } from '@ant-design/icons';
import { aiFollowUpAPI } from 'api';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import moment from 'moment';
import { isOpenMaintenanceRequest } from 'utils/maintenanceStatus';

// Square diamond-style agent icon matching the mockup
function AgentIcon({ icon, active, color }) {
  const theme = useTheme();
  const bg = active ? (color || theme.palette.text.primary) : alpha(theme.palette.text.primary, 0.08);
  const iconColor = active ? '#fff' : alpha(theme.palette.text.primary, 0.35);
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        bgcolor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: active ? 'none' : `1px solid ${alpha(theme.palette.text.primary, 0.15)}`
      }}
    >
      {icon && <Box component="span" sx={{ color: iconColor, fontSize: 16, display: 'flex' }}>{icon}</Box>}
    </Box>
  );
}

export default function AgentsSummaryCard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [configAnchor, setConfigAnchor] = useState(null);
  const COMING_SOON = ['listing', 'inspection'];

  const [agentToggles, setAgentToggles] = useState({
    collections: true,
    maintenance: true,
    listing: false,
    inspection: false
  });

  const maintenanceRequests = useSelector(selectMaintenanceRequests);

  const maintenanceStats = useMemo(() => {
    const open = (maintenanceRequests || []).filter(isOpenMaintenanceRequest);
    return { open: open.length, drafted: open.filter((m) => m.isDraft || m.IsDraft).length };
  }, [maintenanceRequests]);

  useEffect(() => {
    let cancelled = false;
    aiFollowUpAPI.getAgentDashboardSummary()
      .then((res) => { if (!cancelled) setSummary(res?.data ?? res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const followUpsSent = summary?.collections?.followUpsSentThisMonth ?? 0;
  const actionsThisMonth = summary?.collections?.actionsThisMonth ?? 0;
  const collectionsLastRun = summary?.collections?.lastRunAt || null;
  const maintenanceLastRun = summary?.maintenance?.lastRunAt || null;

  const agents = [
    {
      key: 'collections',
      label: 'Collections',
      icon: <RobotOutlined />,
      lastRun: collectionsLastRun,
      subtext: followUpsSent > 0
        ? `Sent ${followUpsSent} reminder${followUpsSent !== 1 ? 's' : ''}${actionsThisMonth > 0 ? ` · flagged ${actionsThisMonth} issue${actionsThisMonth !== 1 ? 's' : ''}` : ''}`
        : 'No activity this month',
      route: '/landlord/ai-center/collections-history'
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      icon: <ToolOutlined />,
      lastRun: maintenanceLastRun,
      subtext: maintenanceStats.open > 0
        ? `Drafted ${maintenanceStats.open} ticket${maintenanceStats.open !== 1 ? 's' : ''} · awaiting review`
        : 'No open tickets',
      route: '/landlord/maintenances'
    },
    {
      key: 'listing',
      label: 'Listing',
      icon: <ShopOutlined />,
      lastRun: null,
      subtext: 'Coming soon',
      comingSoon: true,
      route: null
    },
    {
      key: 'inspection',
      label: 'Inspection',
      icon: <AuditOutlined />,
      lastRun: null,
      subtext: 'Coming soon',
      comingSoon: true,
      route: null
    }
  ];

  const handleToggle = (key) => {
    setAgentToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <MainCard
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.875rem', letterSpacing: 1, color: (t) => t.palette.mode === 'dark' ? t.palette.text.secondary : 'rgba(0,0,0,0.48)' }}>
          AI AGENTS · TODAY
        </Typography>
      }
      secondary={
        <>
          <Button
            size="small"
            variant="outlined"
            endIcon={<DownOutlined style={{ fontSize: 10 }} />}
            onClick={(e) => setConfigAnchor(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
              px: 1.5,
              py: 0.4,
              color: 'text.secondary',
              borderColor: alpha(theme.palette.divider, 0.4),
              '&:hover': { borderColor: 'text.secondary' }
            }}
          >
            configure
          </Button>
          <Menu
            anchorEl={configAnchor}
            open={Boolean(configAnchor)}
            onClose={() => setConfigAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: { mt: 0.75, minWidth: 190, borderRadius: 2, boxShadow: (t) => `0 4px 16px ${alpha(t.palette.common.black, 0.12)}` }
            }}
          >
            {agents.map((a) => (
              <MenuItem
                key={a.key}
                onClick={() => !a.comingSoon && handleToggle(a.key)}
                disabled={a.comingSoon}
                sx={{ py: 0.75, px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={500}>{a.label}</Typography>
                  {a.comingSoon && (
                    <Chip label="Soon" size="small" sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }} />
                  )}
                </Stack>
                <Switch
                  size="small"
                  checked={agentToggles[a.key]}
                  disabled={a.comingSoon}
                  onChange={() => handleToggle(a.key)}
                  onClick={(e) => e.stopPropagation()}
                />
              </MenuItem>
            ))}
          </Menu>
        </>
      }
      contentSX={{ pt: 1 }}
      sx={{ height: '100%', '& .MuiCardHeader-root': { pb: 1 } }}
    >
      <Stack divider={<Box sx={{ borderBottom: (t) => `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.9 : 0.6)}` }} />}>
        {agents.map((agent) => {
          const active = agentToggles[agent.key];
          const timeAgo = agent.lastRun ? moment(agent.lastRun).fromNow() : null;
          return (
            <Tooltip key={agent.key} title={agent.subtext} arrow placement="top">
              <Box
                onClick={() => !agent.comingSoon && agent.route && navigate(agent.route)}
                sx={{
                  py: 1.5,
                  cursor: agent.comingSoon ? 'default' : 'pointer',
                  borderRadius: 1,
                  mx: -1,
                  px: 1,
                  transition: 'background 0.15s',
                  ...(!agent.comingSoon && { '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } })
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <AgentIcon icon={agent.icon} active={active && !agent.comingSoon} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ color: agent.comingSoon ? 'text.disabled' : 'text.primary' }}>
                          {agent.label}
                        </Typography>
                        {agent.comingSoon && (
                          <Chip
                            label="Coming soon"
                            size="small"
                            sx={{ height: 16, fontSize: '0.6rem', color: 'text.disabled', bgcolor: alpha(theme.palette.text.primary, 0.06), '& .MuiChip-label': { px: 0.75 } }}
                          />
                        )}
                      </Stack>
                      {timeAgo && !agent.comingSoon && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', flexShrink: 0, ml: 1 }}>
                          {timeAgo}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
    </MainCard>
  );
}
