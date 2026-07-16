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
  alpha,
  Alert
} from '@mui/material';
import {
  TranslationOutlined,
  DollarOutlined
} from '@ant-design/icons';
import useConfig from 'hooks/useConfig';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings, saveSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';
import { openSnackbar } from 'api/snackbar';

// ==============================|| TENANT GENERAL SETTINGS ||============================== //

export default function GeneralSettings() {
  const { i18n, onChangeLocalization } = useConfig();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  
  const validLanguages = ['en', 'fr', 'ro', 'zh'];
  const getDefaultLanguage = () => {
    const lang = userSettings?.language || i18n || 'en';
    return validLanguages.includes(lang) ? lang : 'en';
  };

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    language: getDefaultLanguage(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    currency: 'USD'
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
        timezone: userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        currency: userSettings?.currency || 'USD'
      }));
    }
  }, [userSettings, i18n]);

  const saveSettingsToBackend = async (settingsToSave) => {
    try {
      setLoading(true);
      
      // Map frontend settings to backend SettingsDto format
      const backendSettings = {
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
    // Save immediately to backend
    await saveSettingsToBackend(newSettings);
  };

  const handleLanguageChange = async (lang) => {
    onChangeLocalization(lang);
    await handleChange('language', lang);
  };

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona (MST)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' }
  ];

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
            Configure your language, timezone, and regional preferences.
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
              Settings saved successfully!
            </Alert>
          )}

          <form>
            <Stack spacing={3}>
              <FormControl sx={{ maxWidth: 450 }}>
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

              <FormControl sx={{ maxWidth: 450 }}>
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

              <FormControl sx={{ maxWidth: 450 }}>
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
      </Stack>
    </Box>
  );
}

