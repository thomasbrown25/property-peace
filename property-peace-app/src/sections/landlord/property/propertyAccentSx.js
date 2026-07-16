import { alpha } from '@mui/material/styles';

export const propertyAccentCardSx = (accentColor, extra = {}) => ({
  ...extra,
  position: 'relative',
  overflow: extra.overflow || 'hidden',
  bgcolor: 'background.paper',
  border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? alpha(accentColor, 0.34) : alpha(accentColor, 0.22)}`,
  boxShadow: (theme) => theme.palette.mode === 'dark'
    ? `0 18px 46px ${alpha(theme.palette.common.black, 0.26)}, 0 0 0 1px ${alpha(accentColor, 0.16)}, 0 0 30px ${alpha(accentColor, 0.13)}`
    : `0 14px 34px ${alpha(accentColor, 0.11)}, 0 0 0 1px ${alpha(accentColor, 0.08)}, 0 0 24px ${alpha(accentColor, 0.07)}`,
  backgroundImage: (theme) => theme.palette.mode === 'light'
    ? `linear-gradient(180deg, ${alpha('#ffffff', 0.95)} 0%, ${alpha(accentColor, 0.03)} 100%)`
    : undefined,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: `linear-gradient(90deg, ${alpha(accentColor, 0.85)} 0%, ${alpha(accentColor, 0.32)} 44%, transparent 100%)`,
    pointerEvents: 'none',
    zIndex: 2
  },
  '&:hover': {
    borderColor: (theme) => theme.palette.mode === 'dark' ? alpha(accentColor, 0.44) : alpha(accentColor, 0.32),
    boxShadow: (theme) => theme.palette.mode === 'dark'
      ? `0 20px 52px ${alpha(theme.palette.common.black, 0.3)}, 0 0 0 1px ${alpha(accentColor, 0.22)}, 0 0 36px ${alpha(accentColor, 0.17)}`
      : `0 16px 40px ${alpha(accentColor, 0.15)}, 0 0 0 1px ${alpha(accentColor, 0.12)}, 0 0 30px ${alpha(accentColor, 0.1)}`,
    ...(extra['&:hover'] || {})
  }
});

export const darkModeActionButtonSx = (accentColor, extra = {}) => ({
  ...extra,
  borderColor: (theme) => theme.palette.mode === 'dark' ? alpha(accentColor, 0.36) : alpha(accentColor, 0.22),
  color: 'text.primary',
  '& .MuiButton-startIcon': {
    color: (theme) => theme.palette.mode === 'dark' ? alpha(accentColor, 0.9) : 'text.secondary'
  },
  '&:hover': {
    borderColor: (theme) => theme.palette.mode === 'dark' ? alpha(accentColor, 0.6) : accentColor,
    bgcolor: (theme) => alpha(accentColor, theme.palette.mode === 'dark' ? 0.12 : 0.05),
    boxShadow: (theme) => `0 0 18px ${alpha(accentColor, theme.palette.mode === 'dark' ? 0.14 : 0.08)}`,
    ...(extra['&:hover'] || {})
  }
});
