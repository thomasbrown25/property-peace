import { alpha } from '@mui/material/styles';

export function getStatusPillSx(theme, tone = 'default') {
  const { palette } = theme;
  const neutral = palette.statusChip.neutral;
  const semanticColor = palette[tone]?.main;
  const borderColor = tone === 'success' || tone === 'primary'
    ? palette.surface.accentBorder
    : semanticColor ? alpha(semanticColor, palette.mode === 'dark' ? 0.44 : 0.24) : neutral.border;

  return {
    '&.MuiChip-root': {
      height: 23,
      fontSize: '0.68rem',
      fontWeight: 700,
      backgroundColor: neutral.background,
      color: neutral.foreground,
      border: '1px solid',
      borderColor
    }
  };
}
