// project imports
import getColors from 'utils/getColors';

// ==============================|| CHIP - COLORS ||============================== //

function getColor({ color, theme }) {
  const colors = getColors(theme, color);
  const { dark } = colors;

  return {
    '&.Mui-focusVisible': {
      outline: `2px solid ${dark}`,
      outlineOffset: 2
    }
  };
}

function getColorStyle({ color, theme }) {
  const colors = getColors(theme, color);
  const { light, lighter, main, darker } = colors;
  const active = color === 'success' ? theme.palette.statusChip.active : null;
  const foregroundColor = active?.softForeground ?? main;

  return {
    color: foregroundColor,
    backgroundColor: active?.softBackground ?? lighter,
    borderColor: active?.softForeground ?? light,
    ...theme.applyStyles('dark', { color: active?.softForeground ?? darker }),
    '& .MuiChip-icon, & .MuiChip-deleteIcon': {
      color: foregroundColor,
      '&:hover': {
        color: light
      }
    }
  };
}

// ==============================|| OVERRIDES - CHIP ||============================== //

export default function Chip(theme) {
  const defaultLightChip = getColorStyle({ color: 'secondary', theme });
  return {
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16, // Rounded like marketing (rounded-2xl equivalent)
          fontFamily: "'Inter', sans-serif",
          '&:active': {
            boxShadow: 'none'
          },
          '&.MuiChip-filledDefault': {
            backgroundColor: theme.palette.statusChip.neutral.background,
            color: theme.palette.statusChip.neutral.foreground,
            '& .MuiChip-icon, & .MuiChip-deleteIcon': { color: 'inherit' }
          },
          '&.MuiChip-colorPrimary': getColor({ color: 'primary', theme }),
          '&.MuiChip-colorSecondary': getColor({ color: 'secondary', theme }),
          '&.MuiChip-colorError': getColor({ color: 'error', theme }),
          '&.MuiChip-colorInfo': getColor({ color: 'info', theme }),
          '&.MuiChip-colorSuccess': getColor({ color: 'success', theme }),
          '&.MuiChip-outlined.MuiChip-colorSuccess': {
            color: theme.palette.statusChip.active.softForeground,
            borderColor: theme.palette.statusChip.active.softForeground,
            '& .MuiChip-icon, & .MuiChip-deleteIcon': { color: 'inherit' }
          },
          '&.MuiChip-filled.MuiChip-colorSuccess': {
            backgroundColor: theme.palette.statusChip.active.background,
            color: theme.palette.statusChip.active.foreground,
            '& .MuiChip-icon, & .MuiChip-deleteIcon': {
              color: 'inherit'
            }
          },
          '&.MuiChip-colorWarning': getColor({ color: 'warning', theme })
        },
        sizeLarge: {
          fontSize: '1rem',
          height: 40
        },
        light: {
          ...defaultLightChip,
          '&.MuiChip-lightDefault': {
            backgroundColor: theme.palette.statusChip.neutral.background,
            color: theme.palette.statusChip.neutral.foreground
          },
          '&.MuiChip-lightPrimary': getColorStyle({ color: 'primary', theme }),
          '&.MuiChip-lightSecondary': getColorStyle({ color: 'secondary', theme }),
          '&.MuiChip-lightError': getColorStyle({ color: 'error', theme }),
          '&.MuiChip-lightInfo': getColorStyle({ color: 'info', theme }),
          '&.MuiChip-lightSuccess': getColorStyle({ color: 'success', theme }),
          '&.MuiChip-lightWarning': getColorStyle({ color: 'warning', theme })
        },
        combined: {
          border: '1px solid',
          ...defaultLightChip,
          '&.MuiChip-combinedDefault': {
            backgroundColor: theme.palette.statusChip.neutral.background,
            color: theme.palette.statusChip.neutral.foreground,
            borderColor: theme.palette.statusChip.neutral.border
          },
          '&.MuiChip-combinedPrimary': getColorStyle({ color: 'primary', theme }),
          '&.MuiChip-combinedSecondary': getColorStyle({ color: 'secondary', theme }),
          '&.MuiChip-combinedError': getColorStyle({ color: 'error', theme }),
          '&.MuiChip-combinedInfo': getColorStyle({ color: 'info', theme }),
          '&.MuiChip-combinedSuccess': getColorStyle({ color: 'success', theme }),
          '&.MuiChip-combinedWarning': getColorStyle({ color: 'warning', theme })
        }
      }
    }
  };
}
