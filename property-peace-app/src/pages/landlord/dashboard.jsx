import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, useMediaQuery } from '@mui/material';
import { useLocation, useSearchParams } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import CalendarPage from 'pages/landlord/calendar';
import DashboardOverview from 'pages/landlord/dashboard-overview';
import TasksPage from 'pages/landlord/tasks';
import DashboardHeader from 'sections/landlord/dashboard/DashboardHeader';
import { getDashboardWorkspaceTab } from 'utils/dashboardWorkspace';

const workspaceComponents = {
  overview: DashboardOverview,
  calendar: CalendarPage,
  tasks: TasksPage
};

export default function DashboardWorkspace() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const activeTab = getDashboardWorkspaceTab(location.pathname, location.search);
  const ActiveComponent = workspaceComponents[activeTab] || DashboardOverview;

  useEffect(() => {
    if (searchParams.get('tab') === activeTab) return;

    const canonicalSearchParams = new URLSearchParams(searchParams);
    canonicalSearchParams.set('tab', activeTab);
    setSearchParams(canonicalSearchParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', nextTab);
    setSearchParams(nextSearchParams);
  };

  return (
    <Box sx={{ mt: { xs: 2, md: 0 } }}>
      <DashboardHeader
        userName={user?.firstname || user?.Firstname}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <AnimatePresence mode="wait" initial={false}>
        <Box
          key={activeTab}
          component={motion.section}
          id="dashboard-workspace-panel"
          role="tabpanel"
          aria-labelledby={`dashboard-${activeTab}-tab`}
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
