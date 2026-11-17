import { alpha } from '@mui/material/styles';

// Shared property-record tab strip: use on full-page landlord sections, not nested drawer tabs.
export const recordTabsSx = (theme) => ({
  mt: 0.5,
  mb: 2.5,
  position: 'relative',
  isolation: 'isolate',
  width: '100%',
  '&::after': {
    content: '""', position: 'absolute', right: 0, bottom: 0, left: 0, height: '1px',
    bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.12),
    pointerEvents: 'none', zIndex: 0
  },
  '& .MuiTabs-root': { minHeight: 42 },
  '& .MuiTab-root': {
    minHeight: 42, px: 1.25, mr: 1.5, borderRadius: 1.5, textTransform: 'none',
    fontSize: '0.875rem', fontWeight: 700, color: 'text.secondary',
    transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], { duration: theme.transitions.duration.shorter }),
    '&:hover': {
      color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
      backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
      boxShadow: theme.palette.mode === 'dark' ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}` : 'none'
    },
    '&.Mui-selected': {
      color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
      backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04)
    }
  },
  '& .MuiTabs-indicator': { zIndex: 1, height: 2, borderRadius: 2, backgroundColor: 'primary.main' }
});
