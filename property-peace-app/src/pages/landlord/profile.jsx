import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, alpha, Stack, Paper, Avatar } from '@mui/material';
import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import NotificationSettings from 'sections/landlord/settings/NotificationSettings';
import GeneralSettings from 'sections/landlord/settings/GeneralSettings';
import AppearanceSettings from 'sections/landlord/settings/AppearanceSettings';
import AccountSettings from 'sections/landlord/settings/AccountSettings';
import PaymentsSettings from 'sections/landlord/settings/PaymentsSettings';
import FeedbackSettings from 'sections/landlord/settings/FeedbackSettings';
import avatar1 from 'assets/images/users/avatar-1.png';

// ==============================|| PROFILE PAGE ||============================== //

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`profile-tabpanel-${index}`} aria-labelledby={`profile-tab-${index}`} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  // Tab mapping
  const tabMap = {
    general: 0,
    account: 1,
    payments: 2,
    notifications: 3,
    appearance: 4,
    feedback: 5
  };

  // Get initial tab index from URL param or default to 0 (general)
  const getInitialTab = () => {
    if (tabParam && tabMap[tabParam.toLowerCase()] !== undefined) {
      return tabMap[tabParam.toLowerCase()];
    }
    return 0; // Default to General tab
  };

  const [tab, setTab] = useState(getInitialTab());

  useEffect(() => {
    if (tabParam && tabMap[tabParam.toLowerCase()] !== undefined) {
      setTab(tabMap[tabParam.toLowerCase()]);
    }
  }, [tabParam]);

  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

  const displayName = `${user?.FirstName || user?.firstname || ''} ${user?.LastName || user?.lastname || ''}`.trim();
  const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl || avatar1;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage your profile and account settings
        </Typography>
      </Box>

      {/* User Info Section */}
      <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'transparent' }}>
          <Stack direction="row" spacing={3} alignItems="center">
            <Avatar alt="profile user" src={profileImageUrl} sx={{ width: 80, height: 80 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                {displayName || 'No name'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <MailOutlined style={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
                <Typography variant="body2" color="text.secondary">
                  {user?.Email || user?.email || 'No email'}
                </Typography>
              </Stack>
              {user?.PhoneNumber || user?.phoneNumber ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <PhoneOutlined style={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
                  <Typography variant="body2" color="text.secondary">
                    {user?.PhoneNumber || user?.phoneNumber}
                  </Typography>
                </Stack>
              ) : null}
            </Box>
          </Stack>
        </Paper>
      </MainCard>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={handleChange} aria-label="profile tabs" variant="scrollable" scrollButtons="auto">
            <Tab label="General" id="profile-tab-0" aria-controls="profile-tabpanel-0" />
            <Tab label="Account Settings" id="profile-tab-1" aria-controls="profile-tabpanel-1" />
            <Tab label="Rent Collection" id="profile-tab-2" aria-controls="profile-tabpanel-2" />
            <Tab label="Notifications" id="profile-tab-3" aria-controls="profile-tabpanel-3" />
            <Tab label="Appearance" id="profile-tab-4" aria-controls="profile-tabpanel-4" />
            <Tab label="Feedback" id="profile-tab-5" aria-controls="profile-tabpanel-5" />
          </Tabs>
        </Box>

        <TabPanel value={tab} index={0}>
          <GeneralSettings />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <AccountSettings />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <PaymentsSettings />
        </TabPanel>
        <TabPanel value={tab} index={3}>
          <NotificationSettings />
        </TabPanel>
        <TabPanel value={tab} index={4}>
          <AppearanceSettings />
        </TabPanel>
        <TabPanel value={tab} index={5}>
          <FeedbackSettings />
        </TabPanel>
      </MainCard>
    </Box>
  );
}

