// material-ui
import { alpha } from '@mui/material/styles';

// ==============================|| OVERRIDES - CARD ||============================== //

export default function Card(theme) {
  return {
    MuiCard: {
      styleOverrides: {
        root: {
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16, // Rounded-2xl equivalent (marketing uses rounded-2xl = 16px)
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? alpha('#dbe7f3', 0.2) : alpha(theme.palette.divider, 0.1),
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : theme.palette.background.paper,
          backgroundImage: theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha(theme.palette.primary.main, 0.025)} 100%)`
            : 'none',
          boxShadow: theme.palette.mode === 'dark'
            ? `0 18px 46px ${alpha(theme.palette.common.black, 0.22)}`
            : `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`, // Similar to filter component shadow
          transition: 'all 0.3s ease',
          ...(theme.palette.mode === 'dark' && {
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '0 0 auto 0',
              height: 2,
              pointerEvents: 'none',
              background: `linear-gradient(90deg, var(--card-accent, ${theme.palette.primary.main}) 0%, ${alpha(theme.palette.primary.main, 0.34)} 42%, transparent 100%)`,
              opacity: 0.9
            }
          }),
          '&:hover': {
            borderColor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.42) : alpha(theme.palette.primary.main, 0.22),
            boxShadow: theme.palette.mode === 'dark'
              ? `0 16px 42px ${alpha(theme.palette.primary.main, 0.18)}`
              : `0 6px 24px ${alpha(theme.palette.primary.main, 0.2)}`
          }
        }
      }
    }
  };
}
