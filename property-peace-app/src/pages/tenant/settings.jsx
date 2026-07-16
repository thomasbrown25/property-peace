import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, Divider, alpha, useMediaQuery, Select, MenuItem, FormControl, Stack } from '@mui/material';
import { 
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  HighlightOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import NotificationSettings from 'sections/tenant/settings/NotificationSettings';
import GeneralSettings from 'sections/tenant/settings/GeneralSettings';
import AppearanceSettings from 'sections/tenant/settings/AppearanceSettings';
import AccountSettings from 'sections/tenant/settings/AccountSettings';
import ProfileSettings from 'sections/tenant/settings/ProfileSettings';

// ==============================|| TENANT SETTINGS PAGE ||============================== //

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`settings-tabpanel-${index}`} aria-labelledby={`settings-tab-${index}`} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function TenantSettings() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  
  // Tab mapping
  const tabMap = {
    profile: 0,
    general: 1,
    account: 2,
    notifications: 3,
    appearance: 4
  };

  // Tab configuration with icons and labels
  const tabConfig = [
    { label: 'Profile', icon: ProfileOutlined },
    { label: 'General', icon: SettingOutlined },
    { label: 'Account Settings', icon: UserOutlined },
    { label: 'Notifications', icon: BellOutlined },
    { label: 'Appearance', icon: HighlightOutlined }
  ];

  // Get initial tab index from URL param or default to 0 (profile)
  const getInitialTab = () => {
    if (tabParam && tabMap[tabParam.toLowerCase()] !== undefined) {
      return tabMap[tabParam.toLowerCase()];
    }
    return 0;
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

  const handleMenuChange = (event) => {
    setTab(event.target.value);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage your account settings and preferences
        </Typography>
      </Box>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {isMobile ? (
            <FormControl fullWidth sx={{ py: 2, px: 2 }}>
              <Select
                value={tab}
                onChange={handleMenuChange}
                displayEmpty
                aria-label="settings menu"
                sx={{ minWidth: 200 }}
              >
                {tabConfig.map((tab, index) => {
                  const IconComponent = tab.icon;
                  return (
                    <MenuItem key={index} value={index}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <IconComponent style={{ fontSize: 20 }} />
                        <Typography>{tab.label}</Typography>
                      </Stack>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          ) : (
            <Tabs value={tab} onChange={handleChange} aria-label="settings tabs" variant="scrollable" scrollButtons="auto">
              {tabConfig.map((tabItem, index) => {
                const IconComponent = tabItem.icon;
                return (
                  <Tab
                    key={index}
                    label={tabItem.label}
                    icon={<IconComponent />}
                    iconPosition="start"
                    id={`settings-tab-${index}`}
                    aria-controls={`settings-tabpanel-${index}`}
                  />
                );
              })}
            </Tabs>
          )}
        </Box>

        <TabPanel value={tab} index={0}>
          <ProfileSettings />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <GeneralSettings />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <AccountSettings />
        </TabPanel>
        <TabPanel value={tab} index={3}>
          <NotificationSettings />
        </TabPanel>
        <TabPanel value={tab} index={4}>
          <AppearanceSettings />
        </TabPanel>
      </MainCard>
    </Box>
  );
}
