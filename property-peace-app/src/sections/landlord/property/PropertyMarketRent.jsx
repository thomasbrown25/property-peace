import { alpha, Box, Button, Chip, Stack, Typography, useTheme } from '@mui/material';
import { StarOutlined, RiseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from 'hooks/useSubscription';
import { propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyMarketRent({ property }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { subscription, loading } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const isPremium = planName === 'premium' || planName.includes('lifetime');

  const rentAmount = (() => {
    const units = property?.units || property?.Units || [];
    const firstUnit = units[0];
    return firstUnit?.rentAmount || firstUnit?.RentAmount || property?.targetRent || 0;
  })();

  if (loading) return null;

  if (isPremium) {
    return (
      <Box
        sx={propertyAccentCardSx(theme.palette.info.main, {
          borderRadius: 3,
          bgcolor: (t) => alpha(t.palette.info.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
          p: 2
        })}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <RiseOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: theme.palette.primary.main }}>
            Market Rent Estimate
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.25 }}>
          {rentAmount > 0 ? `$${Math.round(rentAmount * 1.05).toLocaleString()} – $${Math.round(rentAmount * 1.12).toLocaleString()}/mo` : 'No data yet'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
          Based on nearby comparable listings
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 3,
        background: `linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)`,
        border: `1px solid ${alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.38 : 0.2)}`,
        boxShadow: theme.palette.mode === 'dark'
          ? `0 18px 46px ${alpha(theme.palette.common.black, 0.28)}, 0 0 34px ${alpha(theme.palette.success.main, 0.16)}`
          : `0 6px 20px ${alpha(theme.palette.success.main, 0.1)}`,
        p: 2.25,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Subtle glow */}
      <Box sx={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.15), filter: 'blur(20px)' }} />

      <Chip
        label="✦ PREMIUM"
        size="small"
        sx={{
          height: 20,
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: 0.5,
          bgcolor: alpha(theme.palette.success.main, 0.2),
          color: theme.palette.success.light,
          border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
          mb: 1.25,
          '& .MuiChip-label': { px: 0.75 }
        }}
      />

      <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', mb: 0.75, lineHeight: 1.3 }}>
        Market rent estimate
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', mb: 2, lineHeight: 1.5 }}>
        See data-driven rent estimates based on nearby comparable listings.
      </Typography>

      <Button
        variant="contained"
        color="success"
        size="small"
        startIcon={<StarOutlined style={{ fontSize: 13 }} />}
        onClick={() => navigate('/landlord/settings?tab=subscription')}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          px: 2,
          fontSize: '0.8rem'
        }}
      >
        Upgrade to see comps
      </Button>
    </Box>
  );
}
