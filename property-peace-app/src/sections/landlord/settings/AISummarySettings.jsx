import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  alpha,
  Alert
} from '@mui/material';
import {
  RobotOutlined,
  UserOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { getSettings, saveSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';
import { openSnackbar } from 'api/snackbar';
import useLocalStorage from 'hooks/useLocalStorage';

// ==============================|| AI SUMMARY SETTINGS ||============================== //

export default function AISummarySettings() {
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  const [aiCopilotEnabled, setAiCopilotEnabled] = useLocalStorage('aiCopilotEnabled', true);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    aiSummaryEnabled: true,
    aiSummaryCheckTenantAccounts: true,
    aiSummaryCheckMoveInChecklist: true,
    aiSummaryCheckMoveOutChecklist: true,
    aiSummaryCheckApplicationsSentSigned: true,
    aiSummaryCheckUnpaidSecurityDeposits: true
  });

  // Load settings on mount
  useEffect(() => {
    dispatch(getSettings());
  }, [dispatch]);

  // Update local settings when userSettings change
  useEffect(() => {
    if (userSettings) {
      setSettings(prev => ({
        ...prev,
        // Use backend values if they exist, otherwise default to true for all AI summary settings
        aiSummaryEnabled: userSettings?.aiSummaryEnabled !== undefined ? userSettings.aiSummaryEnabled : (aiCopilotEnabled ?? true),
        aiSummaryCheckTenantAccounts: userSettings?.aiSummaryCheckTenantAccounts !== undefined ? userSettings.aiSummaryCheckTenantAccounts : true,
        aiSummaryCheckMoveInChecklist: userSettings?.aiSummaryCheckMoveInChecklist !== undefined ? userSettings.aiSummaryCheckMoveInChecklist : true,
        aiSummaryCheckMoveOutChecklist: userSettings?.aiSummaryCheckMoveOutChecklist !== undefined ? userSettings.aiSummaryCheckMoveOutChecklist : true,
        aiSummaryCheckApplicationsSentSigned: userSettings?.aiSummaryCheckApplicationsSentSigned !== undefined ? userSettings.aiSummaryCheckApplicationsSentSigned : true,
        aiSummaryCheckUnpaidSecurityDeposits: userSettings?.aiSummaryCheckUnpaidSecurityDeposits !== undefined ? userSettings.aiSummaryCheckUnpaidSecurityDeposits : true
      }));
      
      // Sync localStorage with backend setting for enabled state
      if (userSettings?.aiSummaryEnabled !== undefined && userSettings.aiSummaryEnabled !== aiCopilotEnabled) {
        setAiCopilotEnabled(userSettings.aiSummaryEnabled);
      }
    }
  }, [userSettings]);

  // Sync localStorage with settings when aiCopilotEnabled changes (but only if different from current setting)
  useEffect(() => {
    if (aiCopilotEnabled !== undefined && settings.aiSummaryEnabled !== aiCopilotEnabled) {
      setSettings(prev => ({ ...prev, aiSummaryEnabled: aiCopilotEnabled }));
    }
  }, [aiCopilotEnabled]);

  const saveSettingsToBackend = async (settingsToSave) => {
    try {
      setLoading(true);
      
      // Map frontend settings to backend SettingsDto format
      const backendSettings = {
        language: userSettings?.language,
        timezone: userSettings?.timezone,
        currency: userSettings?.currency,
        darkMode: userSettings?.darkMode ?? false,
        sidenavMini: userSettings?.sidenavMini ?? false,
        navbarFixed: userSettings?.navbarFixed ?? true,
        sidenavType: userSettings?.sidenavType,
        propertyLayout: userSettings?.propertyLayout,
        // AI Summary Preferences
        aiSummaryEnabled: settingsToSave.aiSummaryEnabled,
        aiSummaryCheckTenantAccounts: settingsToSave.aiSummaryCheckTenantAccounts,
        aiSummaryCheckMoveInChecklist: settingsToSave.aiSummaryCheckMoveInChecklist,
        aiSummaryCheckMoveOutChecklist: settingsToSave.aiSummaryCheckMoveOutChecklist,
        aiSummaryCheckApplicationsSentSigned: settingsToSave.aiSummaryCheckApplicationsSentSigned,
        aiSummaryCheckUnpaidSecurityDeposits: settingsToSave.aiSummaryCheckUnpaidSecurityDeposits
      };
      
      await dispatch(saveSettings(backendSettings));
      
      // Sync localStorage with enabled state (only if aiSummaryEnabled changed)
      if (settingsToSave.aiSummaryEnabled !== aiCopilotEnabled) {
        setAiCopilotEnabled(settingsToSave.aiSummaryEnabled);
      }
      
      openSnackbar({
        open: true,
        message: 'AI Summary settings saved successfully!',
        variant: 'alert',
        alert: {
          color: 'success'
        }
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving AI summary settings:', error);
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

  const handleChange = (field, value) => {
    const newSettings = {
      ...settings,
      [field]: value
    };
    // Update state immediately for responsive UI
    setSettings(newSettings);
    // Save to backend asynchronously without blocking
    saveSettingsToBackend(newSettings).catch((error) => {
      // Error is already handled in saveSettingsToBackend
      // This catch is just to prevent unhandled promise rejections
      console.error('Error saving settings (non-blocking):', error);
    });
  };

  return (
    <Box>
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Enabled Switch */}
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <RobotOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Typography variant="h6" fontWeight="bold">
                  AI Summary Enabled
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Turn the AI summary feature on or off. This works the same as toggling it on the dashboard page.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.aiSummaryEnabled}
                  onChange={(e) => handleChange('aiSummaryEnabled', e.target.checked)}
                  disabled={loading}
                  color="primary"
                />
              }
              label=""
            />
          </Stack>
        </Paper>

        <Divider />

        {/* Feature Switches */}
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
          }}
        >
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            Summary Checks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enable or disable specific checks. When disabled, the AI summary will ignore these items and not show them as concerns.
          </Typography>

          <Stack spacing={3}>
            {/* Check Tenant Accounts */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <UserOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                    <Typography variant="subtitle1" fontWeight="600">
                      Check for Tenant Accounts
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Show warnings for tenants who have not created user accounts. Disabling this will ignore tenants without accounts.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.aiSummaryCheckTenantAccounts}
                      onChange={(e) => handleChange('aiSummaryCheckTenantAccounts', e.target.checked)}
                      disabled={loading || !settings.aiSummaryEnabled}
                      color="primary"
                    />
                  }
                  label=""
                />
              </Stack>
            </Box>

            <Divider />

            {/* Check Move-In Checklist */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <CheckCircleOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                    <Typography variant="subtitle1" fontWeight="600">
                      Check Move-In Checklist
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Show warnings for incomplete or missing move-in checklists. Disabling this will ignore move-in checklist status.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.aiSummaryCheckMoveInChecklist}
                      onChange={(e) => handleChange('aiSummaryCheckMoveInChecklist', e.target.checked)}
                      disabled={loading || !settings.aiSummaryEnabled}
                      color="primary"
                    />
                  }
                  label=""
                />
              </Stack>
            </Box>

            <Divider />

            {/* Check Move-Out Checklist */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <CheckCircleOutlined style={{ fontSize: 18, color: '#faad14' }} />
                    <Typography variant="subtitle1" fontWeight="600">
                      Check Move-Out Checklist
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Show warnings for incomplete or missing move-out checklists. Disabling this will ignore move-out checklist status.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.aiSummaryCheckMoveOutChecklist}
                      onChange={(e) => handleChange('aiSummaryCheckMoveOutChecklist', e.target.checked)}
                      disabled={loading || !settings.aiSummaryEnabled}
                      color="primary"
                    />
                  }
                  label=""
                />
              </Stack>
            </Box>

            <Divider />

            {/* Check Applications Sent/Signed */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <FileTextOutlined style={{ fontSize: 18, color: '#722ed1' }} />
                    <Typography variant="subtitle1" fontWeight="600">
                      Check Applications Sent/Signed
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Show warnings for leases that haven't been sent for signature or are unsigned. Disabling this will ignore lease signing status.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.aiSummaryCheckApplicationsSentSigned}
                      onChange={(e) => handleChange('aiSummaryCheckApplicationsSentSigned', e.target.checked)}
                      disabled={loading || !settings.aiSummaryEnabled}
                      color="primary"
                    />
                  }
                  label=""
                />
              </Stack>
            </Box>

            <Divider />

            {/* Check Unpaid Security Deposits */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <DollarOutlined style={{ fontSize: 18, color: '#eb2f96' }} />
                    <Typography variant="subtitle1" fontWeight="600">
                      Check Unpaid Security Deposits
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Show warnings for unpaid or partially paid security deposits. Disabling this will ignore deposit payment status.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.aiSummaryCheckUnpaidSecurityDeposits}
                      onChange={(e) => handleChange('aiSummaryCheckUnpaidSecurityDeposits', e.target.checked)}
                      disabled={loading || !settings.aiSummaryEnabled}
                      color="primary"
                    />
                  }
                  label=""
                />
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* Info Alert */}
        <Alert severity="info" icon={<InfoCircleOutlined />}>
          <Typography variant="body2">
            <strong>Note:</strong> When "AI Summary Enabled" is turned off, the entire AI summary feature is disabled and these individual check settings won't apply.
          </Typography>
        </Alert>
      </Stack>
    </Box>
  );
}
