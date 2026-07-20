import { useMemo } from 'react';
import { Box, Button, Paper, Stack, Typography, alpha } from '@mui/material';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import logo from 'assets/images/logos/property-peace-dark.png';

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
  const status = useMemo(loadStatus, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 },
        bgcolor: '#061e35',
        backgroundImage: `
          radial-gradient(circle at 14% 18%, ${alpha('#22c55e', 0.18)}, transparent 30%),
          radial-gradient(circle at 86% 82%, ${alpha('#22c55e', 0.12)}, transparent 34%),
          linear-gradient(135deg, #061e35 0%, #08233d 48%, #031426 100%)
        `
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          maxWidth: 640,
          px: { xs: 3, sm: 7 },
          py: { xs: 4, sm: 6.5 },
          borderRadius: { xs: 3, sm: 4 },
          textAlign: 'center',
          bgcolor: '#ffffff',
          border: `1px solid ${alpha('#ffffff', 0.22)}`,
          boxShadow: `0 30px 90px ${alpha('#020617', 0.42)}`,
          '&:before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, ${alpha('#22c55e', 0.08)}, transparent 32%)`
          }
        }}
      >
        <Stack spacing={{ xs: 2.5, sm: 3 }} alignItems="center" sx={{ position: 'relative' }}>
          <Box
            component="img"
            src={logo}
            alt="Property Peace"
            sx={{
              height: { xs: 58, sm: 68 },
              width: 'auto',
              maxWidth: 'min(300px, 80vw)',
              objectFit: 'contain'
            }}
          />

          <Stack spacing={1.5} alignItems="center" sx={{ pt: { xs: 0.5, sm: 1 } }}>
            <Typography
              variant="h2"
              fontWeight={800}
              sx={{
                color: '#061e35',
                maxWidth: 520,
                lineHeight: 1.12,
                fontSize: { xs: '2rem', sm: '2.75rem' },
                letterSpacing: '-0.04em'
              }}
            >
              {status.maintenanceTitle}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 500,
                mx: 'auto',
                lineHeight: 1.75,
                fontSize: { xs: '0.98rem', sm: '1.05rem' }
              }}
            >
              {status.maintenanceMessage}
            </Typography>
          </Stack>

          <Stack spacing={1.75} alignItems="center" sx={{ pt: 1 }}>
            <Button
              variant="contained"
              startIcon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
              sx={{
                textTransform: 'none',
                borderRadius: 999,
                px: 3.5,
                py: 1,
                fontWeight: 700,
                bgcolor: '#22c55e',
                boxShadow: `0 16px 32px ${alpha('#22c55e', 0.28)}`,
                '&:hover': { bgcolor: '#16a34a', boxShadow: `0 18px 36px ${alpha('#22c55e', 0.34)}` }
              }}
            >
              Try again
            </Button>
            {status.maintenanceSupportEmail && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                Need help? Contact{' '}
                <Box component="span" sx={{ color: '#061e35', fontWeight: 600 }}>
                  {status.maintenanceSupportEmail}
                </Box>
              </Typography>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
