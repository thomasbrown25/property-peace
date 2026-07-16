import { Box, Typography, Button, Stack, alpha, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, CrownOutlined } from '@ant-design/icons';
import { useSubscription, useSubscriptionStatus } from 'hooks/useSubscription';

// Pages where the gate should not appear — these are where the user goes to fix their situation
const EXEMPT_PATHS = ['/landlord/subscription', '/landlord/properties', '/landlord/property/'];

export default function UnitLimitGate({ children }) {
  const { subscription, loading: subLoading } = useSubscription();
  const { status, loading: statusLoading } = useSubscriptionStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const isExempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));

  const isFreePlan = subscription?.plan?.name?.toLowerCase() === 'free';
  const isGracePeriodOver = isFreePlan && !subscription?.cancelAtPeriodEnd;
  const { currentTotalUnits, maxTotalUnits } = status || {};
  const isOverLimit = maxTotalUnits != null && currentTotalUnits > maxTotalUnits;

  const showGate = !subLoading && !statusLoading && isGracePeriodOver && isOverLimit && !isExempt;

  if (!showGate) return children;

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Blurred content behind the overlay */}
      <Box sx={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </Box>

      {/* Overlay */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          bgcolor: alpha(theme.palette.background.default, 0.7),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 3,
            p: { xs: 3, sm: 5 },
            maxWidth: 480,
            width: '100%',
            boxShadow: theme.shadows[24],
            textAlign: 'center'
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5
            }}
          >
            <HomeOutlined style={{ fontSize: 36, color: theme.palette.warning.main }} />
          </Box>

          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Unit Limit Reached
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
            You have <strong>{currentTotalUnits}</strong> units, but the Free plan allows a maximum of <strong>{maxTotalUnits}</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
            To continue using the app, either upgrade to Premium for unlimited units or remove some properties.
          </Typography>

          <Stack spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              startIcon={<CrownOutlined />}
              onClick={() => navigate('/landlord/subscription')}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              Upgrade to Premium
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<HomeOutlined />}
              onClick={() => navigate('/landlord/properties')}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              Manage Properties
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
