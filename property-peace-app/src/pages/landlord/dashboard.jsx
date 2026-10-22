import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, useMediaQuery } from '@mui/material';
import { useLocation, useSearchParams } from 'react-router-dom';
import CalendarPage from 'pages/landlord/calendar';
import DashboardOverview from 'pages/landlord/dashboard-overview';
import TasksPage from 'pages/landlord/tasks';
import { getDashboardWorkspaceTab } from 'utils/dashboardWorkspace';

const workspaceComponents = {
  overview: DashboardOverview,
  calendar: CalendarPage,
  tasks: TasksPage
};

export default function DashboardWorkspace() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const activeTab = getDashboardWorkspaceTab(location.pathname, location.search);
  const ActiveComponent = workspaceComponents[activeTab] || DashboardOverview;

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (location.pathname === '/landlord/calendar' && requestedTab !== 'calendar') return;
    if (activeTab === 'overview' ? requestedTab === null : requestedTab === activeTab) return;

    const canonicalSearchParams = new URLSearchParams(searchParams);
    if (activeTab === 'overview' || location.pathname === '/landlord/calendar') canonicalSearchParams.delete('tab');
    else canonicalSearchParams.set('tab', activeTab);
    setSearchParams(canonicalSearchParams, { replace: true });
  }, [activeTab, location.pathname, searchParams, setSearchParams]);

  return (
    <Box>
      <AnimatePresence mode="wait" initial={false}>
        <Box
          key={activeTab}
          component={motion.section}
          id="dashboard-workspace-panel"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <ActiveComponent embedded />
        </Box>
      </AnimatePresence>
    </Box>
  );
}
