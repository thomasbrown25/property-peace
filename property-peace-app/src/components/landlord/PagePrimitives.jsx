import PropTypes from 'prop-types';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';

export function LandlordPageHeader({ title, subtitle, actions, sx = {} }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
        ...sx
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, '& > *': { flex: { xs: 1, sm: 'initial' } } }}>
          {actions}
        </Stack>
      )}
    </Box>
  );
}

export function LandlordKpiCard({ label, value, helper, color = 'text.primary', accentColor, sx = {} }) {
  return (
    <Box
      sx={{
        flex: '1 1 160px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        border: (theme) => `1px solid ${alpha(accentColor || theme.palette.divider, accentColor ? (theme.palette.mode === 'dark' ? 0.28 : 0.22) : 0.12)}`,
        boxShadow: (theme) => accentColor
          ? theme.palette.mode === 'dark'
            ? `0 16px 40px ${alpha(theme.palette.common.black, 0.22)}, 0 0 0 1px ${alpha(accentColor, 0.14)}, 0 0 24px ${alpha(accentColor, 0.12)}`
            : `0 12px 30px ${alpha(accentColor, 0.12)}, 0 0 0 1px ${alpha(accentColor, 0.08)}, 0 0 22px ${alpha(accentColor, 0.08)}`
          : `0 8px 24px ${alpha(theme.palette.common.black, 0.06)}`,
        p: 1.75,
        bgcolor: 'background.paper',
        '&::before': (theme) => ({
          content: '""',
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 2,
          pointerEvents: 'none',
          background: `linear-gradient(90deg, ${accentColor || theme.palette.primary.main} 0%, ${alpha(accentColor || theme.palette.primary.main, 0.34)} 42%, transparent 100%)`,
          opacity: accentColor ? (theme.palette.mode === 'dark' ? 0.9 : 0.72) : 0
        }),
        '&:hover': (theme) => accentColor ? ({
          borderColor: alpha(accentColor, theme.palette.mode === 'dark' ? 0.36 : 0.3),
          boxShadow: theme.palette.mode === 'dark'
            ? `0 18px 46px ${alpha(theme.palette.common.black, 0.26)}, 0 0 0 1px ${alpha(accentColor, 0.2)}, 0 0 30px ${alpha(accentColor, 0.16)}`
            : `0 14px 36px ${alpha(accentColor, 0.16)}, 0 0 0 1px ${alpha(accentColor, 0.12)}, 0 0 28px ${alpha(accentColor, 0.11)}`
        }) : ({
          boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, 0.07)}`
        }),
        ...sx
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={800}
        sx={{ textTransform: 'uppercase', letterSpacing: 1.1, fontSize: '0.68rem', display: 'block', mb: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={800} color={color} sx={{ lineHeight: 1.05 }}>
        {value}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
}

export function LandlordEmptyState({ icon, title, description, actionLabel, onAction, actionIcon, sx = {} }) {
  return (
    <Box sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', ...sx }}>
      {icon && <Box sx={{ mb: 3 }}>{icon}</Box>}
      <Typography variant="h5" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: actionLabel ? 3 : 0, maxWidth: 420, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {actionLabel && (
        <Button variant="contained" color="primary" onClick={onAction} size="large" startIcon={actionIcon} sx={{ textTransform: 'none' }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

LandlordPageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  sx: PropTypes.object
};

LandlordKpiCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  helper: PropTypes.node,
  color: PropTypes.string,
  accentColor: PropTypes.string,
  sx: PropTypes.object
};

LandlordEmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  actionLabel: PropTypes.node,
  onAction: PropTypes.func,
  actionIcon: PropTypes.node,
  sx: PropTypes.object
};
