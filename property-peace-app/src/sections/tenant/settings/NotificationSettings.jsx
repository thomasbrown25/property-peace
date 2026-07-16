import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Switch,
  Divider,
  Paper,
  Alert,
  CircularProgress,
  TextField,
  alpha,
  useTheme,
  Tooltip
} from '@mui/material';
import { BellOutlined, MailOutlined, PhoneOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import FormInput from 'components/input/FormInput';
import axiosServices from 'utils/axios';

// ==============================|| TENANT NOTIFICATION SETTINGS ||============================== //

const NOTIFICATION_TYPES = [
  { key: 'rentReminders', label: 'Rent Reminders', description: 'Upcoming rent due date reminders' },
  { key: 'overdueAlerts', label: 'Overdue Payment Alerts', description: 'Alerts when rent payments are overdue' },
  { key: 'paymentConfirmations', label: 'Payment Confirmations', description: 'Confirmation when your payments are received' },
  { key: 'maintenanceUpdates', label: 'Maintenance Updates', description: 'Status changes on your maintenance requests' },
  { key: 'leaseExpiration', label: 'Lease Expiration', description: 'Reminders before your lease expires' },
  { key: 'tenantMessages', label: 'Messages', description: 'Messages from your landlord' }
];

const DEFAULT_SETTINGS = {
  emailEnabled: true,
  phoneEnabled: false,
  emailAddress: '',
  phoneNumber: '',
  rentReminders: { email: true, phone: false, inApp: true },
  overdueAlerts: { email: true, phone: false, inApp: true },
  paymentConfirmations: { email: true, phone: false, inApp: true },
  maintenanceUpdates: { email: true, phone: false, inApp: true },
  leaseExpiration: { email: true, phone: false, inApp: true },
  tenantMessages: { email: true, phone: false, inApp: true }
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    emailAddress: user?.Email || user?.email || '',
    phoneNumber: user?.PhoneNumber || user?.phoneNumber || ''
  });

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await axiosServices.get('/api/user/notification-settings');
      if (response.data?.success && response.data?.data) {
        const api = response.data.data;
        setSettings({
          emailEnabled: api.emailEnabled ?? true,
          phoneEnabled: api.phoneEnabled ?? false,
          emailAddress: api.emailAddress || user?.Email || user?.email || '',
          phoneNumber: api.phoneNumber || user?.PhoneNumber || user?.phoneNumber || '',
          rentReminders: api.rentReminders || DEFAULT_SETTINGS.rentReminders,
          overdueAlerts: api.overdueAlerts || DEFAULT_SETTINGS.overdueAlerts,
          paymentConfirmations: api.paymentConfirmations || DEFAULT_SETTINGS.paymentConfirmations,
          maintenanceUpdates: api.maintenanceUpdates || DEFAULT_SETTINGS.maintenanceUpdates,
          leaseExpiration: api.leaseExpiration || DEFAULT_SETTINGS.leaseExpiration,
          tenantMessages: api.tenantMessages || DEFAULT_SETTINGS.tenantMessages
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settingsToSave) => {
    try {
      setSaving(true);

      if (settingsToSave.emailEnabled && !settingsToSave.emailAddress) {
        openSnackbar({ open: true, message: 'Please provide an email address to enable email notifications', variant: 'alert', alert: { color: 'error' } });
        setSaving(false);
        return;
      }
      if (settingsToSave.phoneEnabled && !settingsToSave.phoneNumber) {
        openSnackbar({ open: true, message: 'Please provide a phone number to enable SMS notifications', variant: 'alert', alert: { color: 'error' } });
        setSaving(false);
        return;
      }

      const response = await axiosServices.post('/api/user/notification-settings', settingsToSave);
      if (!response.data?.success) throw new Error(response.data?.message || 'Save failed');

      openSnackbar({ open: true, message: 'Notification settings saved', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
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

  const handleToggle = (field) => async (event) => {
    const next = { ...settings, [field]: event.target.checked };
    setSettings(next);
    await saveSettings(next);
  };

  const handlePreferenceToggle = (category, channel) => async (event) => {
    const next = { ...settings, [category]: { ...settings[category], [channel]: event.target.checked } };
    setSettings(next);
    await saveSettings(next);
  };

  // Debounced save for text fields
  const handleFieldChange = (field) => (event) => {
    const next = { ...settings, [field]: event.target.value };
    setSettings(next);
    clearTimeout(handleFieldChange._t);
    handleFieldChange._t = setTimeout(() => saveSettings(next), 600);
  };

  const handlePhoneChange = (_, value) => {
    const next = { ...settings, phoneNumber: value };
    setSettings(next);
    clearTimeout(handlePhoneChange._t);
    handlePhoneChange._t = setTimeout(() => saveSettings(next), 600);
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BellOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight="bold">Alert Channels</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Choose how you want to receive notifications. At least one channel must be enabled.
            </Typography>

            <Divider />

            {/* Email */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={settings.emailEnabled} onChange={handleToggle('emailEnabled')} disabled={saving} />
              <MailOutlined />
              <Typography>Email Notifications</Typography>
            </Box>

            {settings.emailEnabled && (
              <TextField
                fullWidth
                label="Email Address"
                value={settings.emailAddress}
                onChange={handleFieldChange('emailAddress')}
                type="email"
                size="small"
                helperText="This email will receive notification alerts"
                disabled={saving}
              />
            )}

            {/* Phone/SMS */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={settings.phoneEnabled} onChange={handleToggle('phoneEnabled')} disabled={saving} />
              <PhoneOutlined />
              <Typography>Phone / SMS Notifications</Typography>
            </Box>

            <FormInput
              name="phoneNumber"
              label="Phone Number"
              value={settings.phoneNumber || ''}
              setFieldValue={handlePhoneChange}
              required={settings.phoneEnabled}
              size="small"
              valueType="phone"
              disabled={saving}
              helperText={settings.phoneEnabled ? 'Format: (123) 456-7890 — you can reply to SMS messages and they will appear in your landlord\'s app' : 'Enter a number to enable SMS'}
            />

            {!settings.emailEnabled && !settings.phoneEnabled && (
              <Alert severity="warning">
                Please enable at least one notification channel to receive alerts.
              </Alert>
            )}
          </Stack>
        </Paper>

        {/* Notification Preferences matrix */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Typography variant="h6" fontWeight="bold">Notification Preferences</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Choose which notifications to receive and through which channels.
          </Typography>

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
            <Tooltip title={settings.emailEnabled ? 'Email notifications enabled' : 'Enable email in Alert Channels above'}>
              <Stack alignItems="center" spacing={0.5} sx={{ cursor: 'default', opacity: settings.emailEnabled ? 1 : 0.45 }}>
                <MailOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 11 }}>
                  Email
                </Typography>
              </Stack>
            </Tooltip>
            <Tooltip title={settings.phoneEnabled ? 'SMS notifications enabled' : 'Enable SMS in Alert Channels above'}>
              <Stack alignItems="center" spacing={0.5} sx={{ cursor: 'default', opacity: settings.phoneEnabled ? 1 : 0.45 }}>
                <MobileOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 11 }}>
                  Phone/SMS
                </Typography>
              </Stack>
            </Tooltip>
          </Box>

          <Divider />

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
                    disabled={saving}
                  />
                </Stack>
                <Stack alignItems="center">
                  <Switch
                    size="small"
                    checked={!!(settings[type.key]?.email && settings.emailEnabled)}
                    onChange={handlePreferenceToggle(type.key, 'email')}
                    disabled={!settings.emailEnabled || saving}
                  />
                </Stack>
                <Stack alignItems="center">
                  <Switch
                    size="small"
                    checked={!!(settings[type.key]?.phone && settings.phoneEnabled)}
                    onChange={handlePreferenceToggle(type.key, 'phone')}
                    disabled={!settings.phoneEnabled || saving}
                  />
                </Stack>
              </Box>
              {idx < NOTIFICATION_TYPES.length - 1 && <Divider />}
            </Box>
          ))}
        </Paper>
      </Stack>
    </Box>
  );
}
