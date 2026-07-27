import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { Box, Typography, alpha, Stack, useMediaQuery, Select, MenuItem, FormControl, Grid, Chip } from '@mui/material';
import {
  SettingOutlined,
  UserOutlined,
  DollarOutlined,
  CreditCardOutlined,
  BellOutlined,
  HighlightOutlined,
  ProfileOutlined,
  RobotOutlined,
  MobileOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import NotificationSettings from 'sections/landlord/settings/NotificationSettings';
import GeneralSettings from 'sections/landlord/settings/GeneralSettings';
import AppearanceSettings from 'sections/landlord/settings/AppearanceSettings';
import AccountSettings from 'sections/landlord/settings/AccountSettings';
import PaymentsSettings from 'sections/landlord/settings/PaymentsSettings';
import ProfileSettings from 'sections/landlord/settings/ProfileSettings';
import AISummarySettings from 'sections/landlord/settings/AISummarySettings';
import SmsNumberSettings from 'sections/landlord/settings/SmsNumberSettings';
import SubscriptionSettings from 'sections/landlord/settings/SubscriptionSettings';

// ==============================|| SETTINGS PAGE ||============================== //

const tabMap = {
  profile: 0,
  general: 1,
  account: 2,
  subscription: 3,
  payments: 4,
  smsnumber: 5,
  notifications: 6,
  appearance: 7,
  aisummary: 8
};

const tabKeys = Object.keys(tabMap);

const tabConfig = [
  { key: 'profile', label: 'Profile', description: 'Your name, contact details, and public identity.', icon: ProfileOutlined, component: ProfileSettings },
  { key: 'general', label: 'General', description: 'Default app behavior and landlord preferences.', icon: SettingOutlined, component: GeneralSettings },
  { key: 'account', label: 'Account Settings', description: 'Login, security, and account-level controls.', icon: UserOutlined, component: AccountSettings },
  { key: 'subscription', label: 'Manage Subscription', description: 'Plans, portfolio usage, billing details, and invoices.', icon: CreditCardOutlined, component: SubscriptionSettings },
  { key: 'payments', label: 'Bank Settings', description: 'Payment accounts, payouts, and billing rails.', icon: DollarOutlined, component: PaymentsSettings },
  { key: 'smsnumber', label: 'SMS Number Settings', description: 'Dedicated tenant texting number, routing, and setup.', icon: MobileOutlined, component: SmsNumberSettings },
  { key: 'notifications', label: 'Notifications', description: 'Alerts, reminders, and communication preferences.', icon: BellOutlined, component: NotificationSettings },
  { key: 'appearance', label: 'Appearance', description: 'Theme, color, and display customization.', icon: HighlightOutlined, component: AppearanceSettings },
  { key: 'aisummary', label: 'AI Summary', description: 'Configure automated summaries and AI assistance.', icon: RobotOutlined, component: AISummarySettings }
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const { setSettingsLoading } = useDashboardLoading();

  useEffect(() => {
    setSettingsLoading(false);
  }, [setSettingsLoading]);

  const getInitialTab = () => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabMap[tabParam.toLowerCase()] !== undefined) {
      return tabMap[tabParam.toLowerCase()];
    }
    return 0;
  };

  const [tab, setTab] = useState(() => getInitialTab());

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const normalizedTab = tabParam.toLowerCase();
      if (tabMap[normalizedTab] !== undefined) {
        const newTab = tabMap[normalizedTab];
        setTab((prevTab) => (prevTab !== newTab ? newTab : prevTab));
      }
    } else {
      setTab((prevTab) => (prevTab !== 0 ? 0 : prevTab));
    }
  }, [searchParams]);

  const updateTab = (newValue) => {
    setTab(newValue);
    const tabKey = tabKeys.find((key) => tabMap[key] === newValue);
    if (tabKey) {
      setSearchParams({ tab: tabKey });
    }
  };

  const activeTabConfig = tabConfig[tab] ?? tabConfig[0];
  const ActiveSettingsPanel = activeTabConfig.component;
  const ActiveIcon = activeTabConfig.icon;

  return (
    <Box>
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 3 }}>
          <MainCard
            content={false}
            sx={{
              position: { lg: 'sticky' },
              top: { lg: 88 },
              borderRadius: 2,
              border: (t) => `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.22 : 0.16)}`,
              boxShadow: 'none',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ p: 2, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.16)}` }}>
              <Typography variant="h6" fontWeight={800}>Settings</Typography>
              <Typography variant="caption" color="text.secondary">Choose the area you want to manage.</Typography>
            </Box>

            {isMobile ? (
              <FormControl fullWidth sx={{ p: 2 }}>
                <Select value={tab} onChange={(event) => updateTab(event.target.value)} displayEmpty aria-label="settings menu">
                  {tabConfig.map((tabItem, index) => {
                    const IconComponent = tabItem.icon;
                    return (
                      <MenuItem key={tabItem.key} value={index}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconComponent style={{ fontSize: 18 }} />
                          <Typography>{tabItem.label}</Typography>
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            ) : (
              <Stack spacing={0}>
                {tabConfig.map((tabItem, index) => {
                  const IconComponent = tabItem.icon;
                  const selected = tab === index;
                  return (
                    <Box
                      key={tabItem.key}
                      component="button"
                      type="button"
                      onClick={() => updateTab(index)}
                      sx={{
                        width: '100%',
                        border: 0,
                        borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.12)}`,
                        bgcolor: selected ? (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.14 : 0.07) : 'background.paper',
                        color: 'text.primary',
                        textAlign: 'left',
                        p: 1.5,
                        cursor: 'pointer',
                        borderLeft: (t) => (selected ? `3px solid ${t.palette.primary.main}` : '3px solid transparent'),
                        transition: 'background-color 0.15s ease, border-color 0.15s ease',
                        '&:hover': {
                          bgcolor: (t) => (selected ? alpha(t.palette.primary.main, 0.16) : alpha(t.palette.primary.main, 0.05))
                        }
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1.25,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: selected ? 'primary.main' : 'text.secondary',
                            bgcolor: (t) => (selected ? alpha(t.palette.primary.main, 0.12) : alpha(t.palette.text.secondary, 0.06))
                          }}
                        >
                          <IconComponent style={{ fontSize: 16 }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={selected ? 800 : 700}>{tabItem.label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>
                            {tabItem.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </MainCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 9 }}>
          <MainCard content={false} sx={{ borderRadius: 2, border: (t) => `1px solid ${alpha(t.palette.divider, 0.16)}`, boxShadow: 'none', overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.14)}`, bgcolor: (t) => alpha(t.palette.background.paper, 0.86) }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.main',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12)
                  }}
                >
                  <ActiveIcon style={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800}>{activeTabConfig.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{activeTabConfig.description}</Typography>
                </Box>
              </Stack>
            </Box>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <ActiveSettingsPanel />
            </Box>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
