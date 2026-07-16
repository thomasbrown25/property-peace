import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  alpha,
  Alert
} from '@mui/material';
import {
  TranslationOutlined,
  CalendarOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import useConfig from 'hooks/useConfig';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings, saveSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';
import { openSnackbar } from 'api/snackbar';
import { buildTimezoneOptions, DEFAULT_TIMEZONE, getBrowserTimezone } from 'utils/browserTimezone';

// ==============================|| GENERAL SETTINGS ||============================== //

export default function GeneralSettings() {
  const { i18n, onChangeLocalization } = useConfig();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const validLanguages = ['en', 'fr', 'ro', 'zh'];
  const getDefaultLanguage = () => {
    const lang = userSettings?.language || i18n || 'en';
    return validLanguages.includes(lang) ? lang : 'en';
  };

  const [settings, setSettings] = useState({
    language: getDefaultLanguage(),
    timezone: getBrowserTimezone(),
    currency: 'USD',
    emailDigest: 'daily', // daily, weekly, never
    dataRetentionDays: 365,
    exportFormat: 'csv' // csv, excel, json
  });

  // Load settings on mount
  useEffect(() => {
    dispatch(getSettings());
  }, [dispatch]);

  // Update local settings when userSettings change
  useEffect(() => {
    if (userSettings) {
      const lang = userSettings?.language || i18n || 'en';
      const validLang = validLanguages.includes(lang) ? lang : 'en';
      setSettings(prev => ({ 
        ...prev, 
        language: validLang,
        timezone: userSettings?.timezone || getBrowserTimezone(),
        currency: userSettings?.currency || 'USD'
      }));
    }
  }, [userSettings, i18n]);

  const saveSettingsToBackend = async (settingsToSave) => {
    try {
      setLoading(true);
      
      // Map frontend settings to backend SettingsDto format
      const backendSettings = {
        ...userSettings,
        language: settingsToSave.language,
        timezone: settingsToSave.timezone,
        currency: settingsToSave.currency,
        darkMode: userSettings?.darkMode ?? false,
        sidenavMini: userSettings?.sidenavMini ?? false,
        navbarFixed: userSettings?.navbarFixed ?? false,
        sidenavType: userSettings?.sidenavType,
        propertyLayout: userSettings?.propertyLayout
      };
      
      await dispatch(saveSettings(backendSettings));
      
      openSnackbar({
        open: true,
        message: 'Settings saved successfully!',
        variant: 'alert',
        alert: {
          color: 'success'
        }
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving general settings:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save settings',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (field, value) => {
    const newSettings = {
      ...settings,
      [field]: value
    };
    setSettings(newSettings);
    // Save immediately to backend (only for regional settings)
    if (['language', 'timezone', 'currency'].includes(field)) {
      await saveSettingsToBackend(newSettings);
    }
  };

  const handleLanguageChange = async (lang) => {
    onChangeLocalization(lang);
    await handleChange('language', lang);
  };

  const handleExportData = () => {
    // TODO: Implement data export functionality
    alert('Data export functionality will be implemented here');
  };

  const timezones = buildTimezoneOptions(settings.timezone || DEFAULT_TIMEZONE);

  const currencies = [
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' }
  ];

  return (
    <Box>
      <Stack spacing={3}>
        {/* Language & Regional Settings */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TranslationOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Language & Regional Settings
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure your language, timezone, and regional preferences. Your timezone is used for daily summaries and date-based reminders.
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
              Settings saved successfully!
            </Alert>
          )}

          <form>
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={settings.language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  label="Language"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="fr">Français (French)</MenuItem>
                  <MenuItem value="ro">Română (Romanian)</MenuItem>
                  <MenuItem value="zh">中国人 (Chinese)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  label="Timezone"
                >
                  {timezones.map((tz) => (
                    <MenuItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={settings.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  label="Currency"
                >
                  {currencies.map((curr) => (
                    <MenuItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </form>
        </Paper>

        {/* Email Preferences */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CalendarOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Email Digest Preferences
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose how often you receive summary emails.
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Email Digest Frequency</InputLabel>
            <Select
              value={settings.emailDigest}
              onChange={(e) => handleChange('emailDigest', e.target.value)}
              label="Email Digest Frequency"
            >
              <MenuItem value="never">Never</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
            </Select>
          </FormControl>
        </Paper>

        {/* Data Management */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <DownloadOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Data Management
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Export your data or manage data retention settings.
          </Typography>

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Export Data
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Download a copy of your account data including properties, tenants, leases, and financial records.
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Export Format</InputLabel>
                <Select
                  value={settings.exportFormat}
                  onChange={(e) => handleChange('exportFormat', e.target.value)}
                  label="Export Format"
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={handleExportData}
              >
                Export Data
              </Button>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Data Retention
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Data Retention Period</InputLabel>
                <Select
                  value={settings.dataRetentionDays}
                  onChange={(e) => handleChange('dataRetentionDays', e.target.value)}
                  label="Data Retention Period"
                >
                  <MenuItem value={90}>90 days</MenuItem>
                  <MenuItem value={180}>180 days</MenuItem>
                  <MenuItem value={365}>1 year</MenuItem>
                  <MenuItem value={730}>2 years</MenuItem>
                  <MenuItem value={1095}>3 years</MenuItem>
                  <MenuItem value={-1}>Indefinitely</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                How long to keep deleted records and archived data
              </Typography>
            </Box>
          </Stack>
        </Paper>

      </Stack>
    </Box>
  );
}
