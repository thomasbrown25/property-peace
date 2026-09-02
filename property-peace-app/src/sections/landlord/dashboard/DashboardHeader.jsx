import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import { AppstoreOutlined, ArrowRightOutlined, CalendarOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import { dashboardWorkspaceTabs, getDashboardWorkspaceTab } from 'utils/dashboardWorkspace';

const dashboardNavy = '#061e35';

const tabIcons = {
  overview: AppstoreOutlined,
  calendar: CalendarOutlined,
  tasks: CheckSquareOutlined
};

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export function DashboardReminderCard({ reminders = [] }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const nextReminder = reminders[0];
  const actionColor = theme.palette.mode === 'dark' ? theme.palette.primary.light : dashboardNavy;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '62px minmax(0, 1fr) auto', sm: '68px minmax(0, 1fr) auto' },
        alignItems: 'stretch',
        minHeight: { xs: 76, sm: 82 },
        overflow: 'hidden',
        borderRadius: 2.25,
        border: `1px solid ${alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.34 : 0.2)}`,
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark' ? `0 12px 30px ${alpha('#000', 0.2)}` : `0 9px 24px ${alpha(dashboardNavy, 0.055)}`
      }}
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{
          px: 1,
          color: '#fff',
          bgcolor: dashboardNavy
        }}
      >
        <Typography sx={{ color: alpha('#fff', 0.7), fontSize: '0.58rem', fontWeight: 800, letterSpacing: 1 }}>
          {format(now, 'MMM').toUpperCase()}
        </Typography>
        <Typography
          sx={{
            color: '#fff',
            fontFamily: 'Poppins, sans-serif',
            fontSize: { xs: '1.35rem', sm: '1.5rem' },
            fontWeight: 800,
            lineHeight: 1
          }}
        >
          {format(now, 'd')}
        </Typography>
        <Typography sx={{ color: alpha('#fff', 0.7), fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.7 }}>
          {format(now, 'EEE').toUpperCase()}
        </Typography>
      </Stack>

      <Stack justifyContent="center" spacing={0.3} sx={{ minWidth: 0, px: { xs: 1.25, sm: 1.5 }, py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.7}>
          <Box
            sx={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: reminders.length ? 'success.main' : 'text.disabled',
              boxShadow: reminders.length ? `0 0 0 3px ${alpha(theme.palette.success.main, 0.12)}` : 'none'
            }}
          />
          <Typography fontWeight={800} sx={{ color: 'text.primary', fontSize: { xs: '0.8rem', sm: '0.86rem' }, lineHeight: 1.2 }}>
            Today’s reminders
          </Typography>
        </Stack>
        <Typography
          color="text.secondary"
          noWrap
          sx={{ fontSize: { xs: '0.72rem', sm: '0.78rem' }, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {reminders.length === 0
            ? 'Nothing scheduled for today.'
            : `${reminders.length} item${reminders.length === 1 ? '' : 's'} today · ${nextReminder.title}${nextReminder.type !== 'rent' ? ` at ${format(nextReminder.date, 'h:mm a')}` : ''}`}
        </Typography>
      </Stack>

      <Button
        onClick={() => navigate('/landlord/dashboard?tab=calendar')}
        endIcon={<ArrowRightOutlined />}
        aria-label="View calendar"
        sx={{
          alignSelf: 'center',
          minWidth: 0,
          mr: { xs: 0.75, sm: 1 },
          px: { xs: 0.75, sm: 1 },
          py: 0.75,
          borderRadius: 1.25,
          color: actionColor,
          fontSize: { xs: '0.68rem', sm: '0.75rem' },
          fontWeight: 800,
          textTransform: 'none',
          whiteSpace: 'nowrap',
          '& .MuiButton-endIcon': { m: 0, ml: 0.5, fontSize: '0.78rem' },
          '&:hover': { bgcolor: alpha(actionColor, theme.palette.mode === 'dark' ? 0.12 : 0.055), color: actionColor }
        }}
      >
        View calendar
      </Button>
    </Box>
  );
}

export default function DashboardHeader({ userName, activeTab: controlledActiveTab, onTabChange }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = controlledActiveTab || getDashboardWorkspaceTab(location.pathname, location.search);
  const now = useMemo(() => new Date(), []);
  const firstName = userName?.trim().split(/\s+/)[0];
  const tabAccent = theme.palette.mode === 'dark' ? theme.palette.primary.light : dashboardNavy;

  const activateTab = (tab) => {
    if (onTabChange) onTabChange(tab.key);
    else navigate(tab.path);
  };

  const handleTabKeyDown = (event, currentIndex) => {
    let nextIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % dashboardWorkspaceTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + dashboardWorkspaceTabs.length) % dashboardWorkspaceTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = dashboardWorkspaceTabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = dashboardWorkspaceTabs[nextIndex];
    activateTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`dashboard-${nextTab.key}-tab`)?.focus());
  };

  return (
    <Box
      sx={{
        mt: { xs: 2, md: 0 },
        mb: activeTab === 'tasks' ? { xs: 1.5, sm: 1.25 } : 2.5
      }}
    >
      <Stack spacing={0.45} sx={{ mb: 1.75 }}>
        <Typography
          variant="h2"
          sx={{
            color: 'text.primary',
            fontFamily: 'Poppins, Public Sans, sans-serif',
            fontWeight: 720,
            fontSize: { xs: '1.55rem', sm: '1.85rem' },
            lineHeight: 1.15,
            letterSpacing: '-0.035em'
          }}
        >
          {getGreeting(now)}
          {firstName ? `, ${firstName}` : ''}
        </Typography>
      </Stack>

      <Box
        component="nav"
        aria-label="Dashboard workspace"
        role="tablist"
        sx={{
          position: 'relative',
          isolation: 'isolate',
          display: 'flex',
          width: '100%',
          maxWidth: '100%',
          gap: { xs: 0.25, sm: 1.25 },
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 0,
            bottom: 0,
            left: 0,
            height: '1px',
            bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.12),
            pointerEvents: 'none',
            zIndex: 0
          },
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {dashboardWorkspaceTabs.map((tab, tabIndex) => {
          const Icon = tabIcons[tab.icon];
          const active = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              onClick={() => activateTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
              startIcon={<Icon style={{ fontSize: 18 }} />}
              id={`dashboard-${tab.key}-tab`}
              role="tab"
              aria-controls="dashboard-workspace-panel"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              tabIndex={active ? 0 : -1}
              sx={{
                position: 'relative',
                zIndex: 1,
                minWidth: 'max-content',
                px: { xs: 1.25, sm: 1.6 },
                py: 1.05,
                borderRadius: 0,
                borderBottom: '3px solid',
                borderBottomColor: active ? tabAccent : 'transparent',
                color: active ? tabAccent : 'text.secondary',
                backgroundColor: 'transparent',
                fontSize: '0.92rem',
                fontWeight: active ? 800 : 650,
                textTransform: 'none',
                '&:hover': { color: active ? tabAccent : 'text.primary', bgcolor: alpha(tabAccent, theme.palette.mode === 'dark' ? 0.1 : 0.055) },
                '&:focus-visible': { outline: `2px solid ${alpha(tabAccent, 0.65)}`, outlineOffset: -2 }
              }}
            >
              {tab.label}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
