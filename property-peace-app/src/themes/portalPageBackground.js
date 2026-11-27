import { alpha } from '@mui/material/styles';

export const portalPageBackground = (theme) => ({
  bgcolor: 'background.default',
  ...(theme.palette.mode === 'dark' && {
    backgroundImage: `
      radial-gradient(circle at 20% 0%, ${alpha(theme.palette.primary.main, 0.12)} 0, transparent 28%),
      radial-gradient(circle at 86% 12%, ${alpha(theme.palette.warning.main, 0.08)} 0, transparent 24%),
      linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha('#050a12', 0.98)} 100%)
    `,
    backgroundAttachment: 'fixed'
  })
});
