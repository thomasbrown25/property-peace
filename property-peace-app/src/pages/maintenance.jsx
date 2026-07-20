import { useMemo } from 'react';
import { Box, Button, Paper, Stack, Typography, alpha, useTheme } from '@mui/material';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import logo from 'assets/images/logos/property-peace.png';

const DEFAULT_STATUS = {
  maintenanceTitle: 'Property Peace is getting a quick tune-up',
  maintenanceMessage: 'We’re making updates to improve reliability and performance. Please check back shortly.',
  maintenanceSupportEmail: 'support@propertypeace.io'
};

function loadStatus() {
  try {
    return { ...DEFAULT_STATUS, ...JSON.parse(sessionStorage.getItem('maintenanceStatus') || '{}') };
  } catch {
    return DEFAULT_STATUS;
  }
}

export default function MaintenancePage() {
  const theme = useTheme();
  const status = useMemo(loadStatus, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 5,
        bgcolor: '#061e35',
        backgroundImage: `radial-gradient(circle at top left, ${alpha('#22c55e', 0.22)}, transparent 34%), radial-gradient(circle at bottom right, ${alpha('#22c55e', 0.14)}, transparent 32%)`
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 560,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          textAlign: 'center',
          border: `1px solid ${alpha('#fff', 0.12)}`,
          boxShadow: `0 28px 80px ${alpha('#020617', 0.38)}`
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Box component="img" src={logo} alt="Property Peace" sx={{ height: 44, width: 'auto' }} />

          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: '#16a34a',
              bgcolor: alpha(theme.palette.success.main, 0.1),
              border: `1px solid ${alpha(theme.palette.success.main, 0.22)}`
            }}
          >
            <ToolOutlined style={{ fontSize: 30 }} />
          </Box>

          <Stack spacing={1.25}>
            <Typography variant="h2" fontWeight={800} sx={{ color: '#061e35' }}>
              {status.maintenanceTitle}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {status.maintenanceMessage}
            </Typography>
          </Stack>

          <Stack spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              startIcon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
              sx={{
                textTransform: 'none',
                borderRadius: 999,
                px: 3,
                bgcolor: '#22c55e',
                boxShadow: `0 14px 28px ${alpha('#22c55e', 0.24)}`,
                '&:hover': { bgcolor: '#16a34a' }
              }}
            >
              Try again
            </Button>
            {status.maintenanceSupportEmail && (
              <Typography variant="caption" color="text.secondary">
                Need help? Contact {status.maintenanceSupportEmail}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
