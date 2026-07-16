import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  alpha,
  useTheme,
  Tooltip
} from '@mui/material';
import { BellOutlined, MailOutlined, PhoneOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';
import { saveNotificationSettings, getNotificationSettings } from 'store/user/user.action';
import FormInput from 'components/input/FormInput';

// ==============================|| NOTIFICATION SETTINGS ||============================== //

const NOTIFICATION_TYPES = [
  { key: 'overdueAlerts', label: 'Overdue Alerts', description: 'One-time alert when rent becomes overdue' },
  { key: 'paymentConfirmations', label: 'Payment Confirmations', description: 'When payments are received from tenants' },
  { key: 'maintenanceUpdates', label: 'Maintenance Updates', description: 'Maintenance request status changes' },
  { key: 'leaseExpiration', label: 'Lease Expiration', description: 'Reminders before lease expiration dates' },
  { key: 'newTenantNotifications', label: 'New Tenants', description: 'When new tenants are added' },
  { key: 'applicationCompletion', label: 'Applications', description: 'When rental applications are submitted' },
  { key: 'tenantMessages', label: 'Tenant Messages', description: 'When tenants send you messages' }
];

const ADMIN_NOTIFICATION_TYPES = [
  { key: 'adminSubscriptionNotifications', label: 'Subscription Events', description: 'Users subscribing or cancelling plans' },
  { key: 'adminNewUserNotifications', label: 'New Registrations', description: 'When new user accounts are created' }
];

export default function NotificationSettings() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    emailEnabled: true,
    phoneEnabled: true,
    emailAddress: user?.Email || user?.email || '',
    phoneNumber: user?.PhoneNumber || user?.phoneNumber || '',
    // Notification preferences
    overdueAlerts: { email: true, phone: true, inApp: true },
    paymentConfirmations: { email: true, phone: true, inApp: true },
    maintenanceUpdates: { email: true, phone: false, inApp: true },
    leaseExpiration: { email: true, phone: true, inApp: true },
    newTenantNotifications: { email: true, phone: false, inApp: true },
    applicationCompletion: { email: true, phone: false, inApp: true },
    tenantMessages: { email: true, phone: false, inApp: true },
    dailySummaryEmail: true,
    // Admin notification preferences
    adminSubscriptionNotifications: { email: true, phone: false, inApp: true },
    adminNewUserNotifications: { email: true, phone: false, inApp: true }
  });

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Try to load settings from API, fallback to user data
      try {
        const response = await dispatch(getNotificationSettings());
        if (response?.payload) {
          setSettings((prev) => ({
            ...prev,
            ...response.payload,
            emailAddress: response.payload.emailAddress || user?.Email || user?.email || '',
            phoneNumber: response.payload.phoneNumber || user?.PhoneNumber || user?.phoneNumber || ''
          }));
        }
      } catch (apiError) {
        // If API call fails, use defaults with user's email/phone
        console.log('API call failed, using defaults:', apiError);
        setSettings((prev) => ({
          ...prev,
          emailAddress: user?.Email || user?.email || '',
          phoneNumber: user?.PhoneNumber || user?.phoneNumber || ''
        }));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => async (event) => {
    const newSettings = {
      ...settings,
      [field]: event.target.checked
    };
    setSettings(newSettings);
    // Save immediately
    await saveSettings(newSettings);
  };

  const handlePreferenceToggle = (category, type) => async (event) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [type]: event.target.checked
      }
    };
    setSettings(newSettings);
    // Save immediately
    await saveSettings(newSettings);
  };

  const handleFieldChange = (field) => async (event) => {
    const newSettings = {
      ...settings,
      [field]: event.target.value
    };
    setSettings(newSettings);
    // Save immediately with debounce (wait for user to finish typing)
    clearTimeout(handleFieldChange.saveTimeout);
    handleFieldChange.saveTimeout = setTimeout(() => {
      saveSettings(newSettings);
    }, 500);
  };

  const saveSettings = async (settingsToSave) => {
    try {
      setSaving(true);

      // Validate email if email notifications are enabled
      if (settingsToSave.emailEnabled && !settingsToSave.emailAddress) {
        openSnackbar({
          open: true,
          message: 'Please provide an email address to enable email notifications',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setSaving(false);
        return;
      }

      // Validate phone if phone notifications are enabled
      if (settingsToSave.phoneEnabled && !settingsToSave.phoneNumber) {
        openSnackbar({
          open: true,
          message: 'Please provide a phone number to enable phone notifications',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setSaving(false);
        return;
      }

      await dispatch(saveNotificationSettings(settingsToSave));

      openSnackbar({
        open: true,
        message: 'Notification settings saved successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to save notification settings',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Alert Channels */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BellOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Alert Channels
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Choose how you want to receive notifications. At least one channel must be enabled.
            </Typography>

            <Divider />

            <FormControlLabel
              control={<Switch checked={settings.emailEnabled} onChange={handleToggle('emailEnabled')} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MailOutlined />
                  <Typography>Email Notifications</Typography>
                </Box>
              }
            />

            {settings.emailEnabled && (
              <TextField
                fullWidth
                label="Email Address"
                value={settings.emailAddress}
                onChange={handleFieldChange('emailAddress')}
                type="email"
                required
                size="small"
                helperText="This email will receive notification alerts"
              />
            )}

            <FormControlLabel
              control={<Switch checked={settings.phoneEnabled} onChange={handleToggle('phoneEnabled')} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneOutlined />
                  <Typography>Phone/SMS Notifications</Typography>
                </Box>
              }
            />

            <FormInput
              name="phoneNumber"
              label="Phone Number"
              value={settings.phoneNumber || ''}
              setFieldValue={async (field, value) => {
                const newSettings = {
                  ...settings,
                  phoneNumber: value
                };
                setSettings(newSettings);
                // Save immediately with debounce (wait for user to finish typing)
                clearTimeout(handleFieldChange.saveTimeout);
                handleFieldChange.saveTimeout = setTimeout(() => {
                  saveSettings(newSettings);
                }, 500);
              }}
              required={settings.phoneEnabled}
              size="small"
              valueType="phone"
              helperText={settings.phoneEnabled ? "Format: (123) 456-7890" : "Phone number will be saved but notifications are disabled"}
            />

            {!settings.emailEnabled && !settings.phoneEnabled && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please enable at least one notification channel to receive alerts.
              </Alert>
            )}
          </Stack>
        </Paper>

        {/* Daily Summary */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">Daily Summary Email</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Get a 10:00 AM Eastern summary for properties and organizations you own, including no-activity days.
                </Typography>
              </Box>
              <Switch
                checked={settings.dailySummaryEmail !== false && settings.emailEnabled}
                onChange={handleToggle('dailySummaryEmail')}
                disabled={!settings.emailEnabled || saving}
              />
            </Box>
            {!settings.emailEnabled && (
              <Alert severity="info">Enable email notifications above to receive the daily summary email.</Alert>
            )}
          </Stack>
        </Paper>

        {/* Notification Preferences — matrix table */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">Notification Preferences</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Choose which notifications to receive and through which channels.
              </Typography>
            </Box>
          </Stack>

          {/* Column headers */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 96px',
              alignItems: 'center',
              mt: 2.5,
              mb: 0.5,
              px: 1
            }}
          >
            <Box />
            <Tooltip title="In-App notifications appear inside the dashboard">
              <Stack alignItems="center" spacing={0.5} sx={{ cursor: 'default' }}>
                <DesktopOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 11 }}>
                  In-App
                </Typography>
              </Stack>
            </Tooltip>
            <Tooltip title={settings.emailEnabled ? 'Email notifications enabled' : 'Email notifications disabled — enable in Alert Channels above'}>
              <Stack alignItems="center" spacing={0.5} sx={{ cursor: 'default', opacity: settings.emailEnabled ? 1 : 0.45 }}>
                <MailOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 11 }}>
                  Email
                </Typography>
              </Stack>
            </Tooltip>
            <Tooltip title={settings.phoneEnabled ? 'SMS notifications enabled' : 'SMS notifications disabled — enable in Alert Channels above'}>
              <Stack alignItems="center" spacing={0.5} sx={{ cursor: 'default', opacity: settings.phoneEnabled ? 1 : 0.45 }}>
                <MobileOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 11 }}>
                  Phone/SMS
                </Typography>
              </Stack>
            </Tooltip>
          </Box>

          <Divider />

          {/* Notification rows */}
          {NOTIFICATION_TYPES.map((type, idx) => (
            <Box key={type.key}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 80px 96px',
                  alignItems: 'center',
                  py: 1.25,
                  px: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) }
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>{type.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{type.description}</Typography>
                </Box>
                <Stack alignItems="center">
                  <Switch
                    size="small"
                    checked={settings[type.key]?.inApp !== false}
                    onChange={handlePreferenceToggle(type.key, 'inApp')}
                  />
                </Stack>
                <Stack alignItems="center">
                  <Switch
                    size="small"
                    checked={!!(settings[type.key]?.email && settings.emailEnabled)}
                    onChange={handlePreferenceToggle(type.key, 'email')}
                    disabled={!settings.emailEnabled}
                  />
                </Stack>
                <Stack alignItems="center">
                  <Switch
                    size="small"
                    checked={!!(settings[type.key]?.phone && settings.phoneEnabled)}
                    onChange={handlePreferenceToggle(type.key, 'phone')}
                    disabled={!settings.phoneEnabled}
                  />
                </Stack>
              </Box>
              {idx < NOTIFICATION_TYPES.length - 1 && <Divider />}
            </Box>
          ))}

          {/* Admin section */}
          {isAdmin && (
            <>
              <Divider sx={{ mt: 1, mb: 0 }} />
              <Box sx={{ px: 1, pt: 2, pb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Admin Only
                </Typography>
              </Box>
              {ADMIN_NOTIFICATION_TYPES.map((type, idx) => (
                <Box key={type.key}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 80px 80px 96px',
                      alignItems: 'center',
                      py: 1.25,
                      px: 1,
                      borderRadius: 1,
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) }
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{type.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{type.description}</Typography>
                    </Box>
                    <Stack alignItems="center">
                      <Switch
                        size="small"
                        checked={settings[type.key]?.inApp !== false}
                        onChange={handlePreferenceToggle(type.key, 'inApp')}
                      />
                    </Stack>
                    <Stack alignItems="center">
                      <Switch
                        size="small"
                        checked={!!(settings[type.key]?.email && settings.emailEnabled)}
                        onChange={handlePreferenceToggle(type.key, 'email')}
                        disabled={!settings.emailEnabled}
                      />
                    </Stack>
                    <Stack alignItems="center">
                      <Switch
                        size="small"
                        checked={!!(settings[type.key]?.phone && settings.phoneEnabled)}
                        onChange={handlePreferenceToggle(type.key, 'phone')}
                        disabled={!settings.phoneEnabled}
                      />
                    </Stack>
                  </Box>
                  {idx < ADMIN_NOTIFICATION_TYPES.length - 1 && <Divider />}
                </Box>
              ))}
            </>
          )}
        </Paper>

      </Stack>
    </Box>
  );
}

