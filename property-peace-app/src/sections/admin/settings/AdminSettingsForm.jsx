import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  alpha,
  Switch,
  FormControlLabel
} from '@mui/material';
import { MailOutlined, SaveOutlined, ToolOutlined, UnlockOutlined } from '@ant-design/icons';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import MainCard from 'components/MainCard';

export default function AdminSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingFeatureFlag, setTogglingFeatureFlag] = useState(false);
  const [settings, setSettings] = useState({
    notificationEmail: '',
    allPremiumFeaturesOnFreePlan: false,
    maintenanceModeEnabled: false,
    maintenanceTitle: 'Property Peace is getting a quick tune-up',
    maintenanceMessage: 'We’re making updates to improve reliability and performance. Please check back shortly.',
    maintenanceSupportEmail: 'support@propertypeace.io'
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosServices.get('/api/admin/settings');
      if (response.data?.success && response.data?.data) {
        setSettings({
          notificationEmail: response.data.data.notificationEmail || '',
          allPremiumFeaturesOnFreePlan: response.data.data.allPremiumFeaturesOnFreePlan ?? false,
          maintenanceModeEnabled: response.data.data.maintenanceModeEnabled ?? false,
          maintenanceTitle: response.data.data.maintenanceTitle || 'Property Peace is getting a quick tune-up',
          maintenanceMessage: response.data.data.maintenanceMessage || 'We’re making updates to improve reliability and performance. Please check back shortly.',
          maintenanceSupportEmail: response.data.data.maintenanceSupportEmail || 'support@propertypeace.io'
        });
      }
    } catch (err) {
      console.error('Error loading admin settings:', err);
      setError(err?.response?.data?.message || 'Failed to load admin settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeatureFlag = async (checked) => {
    setSettings((prev) => ({ ...prev, allPremiumFeaturesOnFreePlan: checked }));
    setTogglingFeatureFlag(true);
    try {
      const response = await axiosServices.put('/api/admin/settings', {
        notificationEmail: settings.notificationEmail.trim(),
        allPremiumFeaturesOnFreePlan: checked,
        maintenanceModeEnabled: settings.maintenanceModeEnabled,
        maintenanceTitle: settings.maintenanceTitle,
        maintenanceMessage: settings.maintenanceMessage,
        maintenanceSupportEmail: settings.maintenanceSupportEmail
      });
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: checked ? 'Premium features unlocked for all plans.' : 'Premium features restricted to paid plans.',
          variant: 'alert',
          alert: { color: checked ? 'warning' : 'success' }
        });
      } else {
        throw new Error(response.data?.message || 'Failed to update setting');
      }
    } catch (err) {
      // Revert on failure
      setSettings((prev) => ({ ...prev, allPremiumFeaturesOnFreePlan: !checked }));
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to update feature flag',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setTogglingFeatureFlag(false);
    }
  };

  const handleSave = async () => {
    // Basic email validation only if an email is provided
    if (settings.notificationEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.notificationEmail.trim())) {
        openSnackbar({
          open: true,
          message: 'Please enter a valid email address',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      const response = await axiosServices.put('/api/admin/settings', {
        notificationEmail: settings.notificationEmail.trim(),
        allPremiumFeaturesOnFreePlan: settings.allPremiumFeaturesOnFreePlan,
        maintenanceModeEnabled: settings.maintenanceModeEnabled,
        maintenanceTitle: settings.maintenanceTitle.trim(),
        maintenanceMessage: settings.maintenanceMessage.trim(),
        maintenanceSupportEmail: settings.maintenanceSupportEmail.trim()
      });

      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: 'Admin settings saved successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error(response.data?.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving admin settings:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save admin settings');
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to save admin settings',
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
    <MainCard title="Admin Settings">
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <MailOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Notification Email
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This email will receive notifications when users submit tech support requests or feedback.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Notification Email"
              value={settings.notificationEmail}
              onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
              type="email"
              required
              size="small"
              placeholder="admin@example.com"
              helperText="Email address where support and feedback notifications will be sent"
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlined />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </Box>
          </Stack>
        </Paper>


        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ToolOutlined style={{ fontSize: 20, color: '#16a34a' }} />
            <Typography variant="h6" fontWeight="bold">
              Maintenance Mode
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Redirect app visitors to a branded maintenance page. Admins can turn this on before planned downtime and turn it off when service is restored.
          </Typography>

          {settings.maintenanceModeEnabled && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Maintenance mode is currently enabled. Users visiting the app will be redirected to /maintenance.
            </Alert>
          )}

          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.maintenanceModeEnabled}
                  onChange={(e) => setSettings({ ...settings, maintenanceModeEnabled: e.target.checked })}
                  color="warning"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Enable maintenance mode
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sends app traffic to the maintenance page until this is turned off.
                  </Typography>
                </Box>
              }
            />

            <TextField
              fullWidth
              label="Maintenance title"
              value={settings.maintenanceTitle}
              onChange={(e) => setSettings({ ...settings, maintenanceTitle: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Maintenance message"
              value={settings.maintenanceMessage}
              onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Support email"
              value={settings.maintenanceSupportEmail}
              onChange={(e) => setSettings({ ...settings, maintenanceSupportEmail: e.target.value })}
              type="email"
              size="small"
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlined />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Maintenance Settings'}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <UnlockOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <Typography variant="h6" fontWeight="bold">
              Feature Access
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Override plan-based feature gating for testing or promotional purposes.
          </Typography>

          {settings.allPremiumFeaturesOnFreePlan && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Premium features are currently unlocked for all plans. Users on free plans have full access.
            </Alert>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={settings.allPremiumFeaturesOnFreePlan}
                onChange={(e) => handleToggleFeatureFlag(e.target.checked)}
                disabled={togglingFeatureFlag}
                color="warning"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  Enable all premium features on free plan
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Grants access to LeaseShield, Rent Estimates, and Reports regardless of subscription plan. Online rent payments are included in Free but still require organization approval and setup.
                </Typography>
              </Box>
            }
          />
        </Paper>
      </Stack>
    </MainCard>
  );
}

