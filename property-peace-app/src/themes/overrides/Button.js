// material-ui
import { alpha } from '@mui/system';

// project imports
import getColors from 'utils/getColors';
import getShadow from 'utils/getShadow';

const FILLED_PRIMARY_NAVY = '#061e35';
const FILLED_PRIMARY_NAVY_HOVER = '#042238';

function getColorStyle({ variant, color, theme }) {
  const colors = getColors(theme, color);
  const { lighter, main, dark, darker, contrastText } = colors;

  const buttonShadow = `${color}Button`;
  const shadows = getShadow(theme, buttonShadow);

  const commonShadow = {
    '&::after': {
      boxShadow: `0 0 5px 5px ${alpha(main, 0.9)}`
    },
    '&:active::after': {
      boxShadow: `0 0 0 0 ${alpha(main, 0.9)}`
    },
    '&:focus-visible': {
      outline: `2px solid ${dark}`,
      outlineOffset: 2
    }
  };

  switch (variant) {
    case 'contained':
      return {
        '&:hover': {
          backgroundColor: dark
        },
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...commonShadow
      };
    case 'shadow':
      return {
        color: contrastText,
        backgroundColor: main,
        boxShadow: shadows,
        '&:hover': {
          boxShadow: 'none',
          backgroundColor: dark
        },
        ...commonShadow
      };
    case 'outlined':
      return {
        borderColor: main,
        borderWidth: 2,
        '&:hover': {
          color: dark,
          backgroundColor: 'transparent',
          borderColor: dark,
          borderWidth: 2,
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(main, 0.2)}`
        },
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...commonShadow
      };
    case 'dashed':
      return {
        color: main,
        borderColor: main,
        backgroundColor: lighter,
        '&:hover': {
          color: dark,
          borderColor: dark
        },
        ...commonShadow
      };
    case 'text':
    default:
      return {
        color: dark,
        '&:hover': {
          color: darker,
          backgroundColor: 'transparent',
          textDecoration: 'underline'
        },
        ...commonShadow
      };
  }
}

// ==============================|| OVERRIDES - BUTTON ||============================== //

export default function Button(theme) {
  const primaryDashed = getColorStyle({ variant: 'dashed', color: 'primary', theme });
  const primaryShadow = getColorStyle({ variant: 'shadow', color: 'primary', theme });
  const successContained = getColorStyle({ variant: 'contained', color: 'success', theme });

  const disabledStyle = {
    backgroundColor: theme.palette.grey[200],
    '&:hover': {
      backgroundColor: theme.palette.grey[200]
    }
  };
  const iconStyle = {
    '&>*:nth-of-type(1)': {
      fontSize: 'inherit'
    }
  };

  return {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: 'small'
      },
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontFamily: theme.typography.fontFamily,
          borderRadius: 8,
          textTransform: 'none', // Marketing buttons don't capitalize
          '&::after': {
            content: '""',
            display: 'block',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            borderRadius: 8,
            opacity: 0,
            transition: 'all 0.5s'
          },

          '&:active::after': {
            position: 'absolute',
            borderRadius: 8,
            left: 0,
            top: 0,
            opacity: 1,
            transition: '0s'
          }
        },
        contained: {
          border: 'none',
          outline: 'none',
          '&:focus': { outline: 'none' },
          '&:focus-visible': { outline: 'none' },
          '&::after': { boxShadow: 'none' },
          '&:active::after': { boxShadow: 'none' },
          '&.Mui-disabled': {
            ...disabledStyle
          }
        },
        outlined: {
          '&.Mui-disabled': {
            ...disabledStyle,
            '&:hover': {
              backgroundColor: theme.palette.grey[200],
              color: `${theme.palette.grey[300]} !important`,
              borderColor: 'inherit'
            }
          }
        },
        text: {
          boxShadow: 'none',
          ...(theme.palette.mode === 'dark' && {
            color: theme.palette.text.secondary
          }),
          '&:hover': {
            boxShadow: 'none',
            backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
            color: theme.palette.mode === 'dark' ? theme.palette.text.primary : undefined,
            textDecoration: theme.palette.mode === 'dark' ? 'none' : 'underline'
          }
        },
        endIcon: {
          ...iconStyle
        },
        startIcon: {
          ...iconStyle
        },
        dashed: {
          border: '1px dashed',
          ...primaryDashed,
          '&.MuiButton-dashedPrimary': getColorStyle({ variant: 'dashed', color: 'primary', theme }),
          '&.MuiButton-dashedSecondary': getColorStyle({ variant: 'dashed', color: 'secondary', theme }),
          '&.MuiButton-dashedError': getColorStyle({ variant: 'dashed', color: 'error', theme }),
          '&.MuiButton-dashedSuccess': getColorStyle({ variant: 'dashed', color: 'success', theme }),
          '&.MuiButton-dashedInfo': getColorStyle({ variant: 'dashed', color: 'info', theme }),
          '&.MuiButton-dashedWarning': getColorStyle({ variant: 'dashed', color: 'warning', theme }),
          '&.Mui-disabled': {
            color: `${theme.palette.grey[300]} !important`,
            borderColor: `${theme.palette.grey[400]} !important`,
            backgroundColor: `${theme.palette.grey[200]} !important`
          }
        },
        shadow: {
          ...primaryShadow,
          '&.MuiButton-shadowPrimary': getColorStyle({ variant: 'shadow', color: 'primary', theme }),
          '&.MuiButton-shadowSecondary': getColorStyle({ variant: 'shadow', color: 'secondary', theme }),
          '&.MuiButton-shadowError': getColorStyle({ variant: 'shadow', color: 'error', theme }),
          '&.MuiButton-shadowSuccess': getColorStyle({ variant: 'shadow', color: 'success', theme }),
          '&.MuiButton-shadowInfo': getColorStyle({ variant: 'shadow', color: 'info', theme }),
          '&.MuiButton-shadowWarning': getColorStyle({ variant: 'shadow', color: 'warning', theme }),
          '&.Mui-disabled': {
            color: `${theme.palette.grey[300]} !important`,
            borderColor: `${theme.palette.grey[400]} !important`,
            backgroundColor: `${theme.palette.grey[200]} !important`
          }
        },
        containedPrimary: {
          ...getColorStyle({ variant: 'contained', color: 'primary', theme }),
          backgroundImage: 'none',
          backgroundColor: FILLED_PRIMARY_NAVY,
          color: '#fff',
          border: 'none',
          outline: 'none',
          boxShadow: `0 2px 8px ${alpha(FILLED_PRIMARY_NAVY, 0.3)}`,
          '&:hover': {
            backgroundImage: 'none',
            backgroundColor: FILLED_PRIMARY_NAVY_HOVER,
            color: '#fff',
            boxShadow: `0 4px 14px ${alpha(FILLED_PRIMARY_NAVY, 0.45)}`,
            transform: 'translateY(-1px)'
          },
          '&::after': { boxShadow: 'none' },
          '&:active::after': { boxShadow: 'none' },
          '&:focus': { outline: 'none' },
          '&:focus-visible': { outline: 'none' },
        },
        containedSecondary: getColorStyle({ variant: 'contained', color: 'secondary', theme }),
        containedError: getColorStyle({ variant: 'contained', color: 'error', theme }),
        containedSuccess: {
          ...successContained,
          color: FILLED_PRIMARY_NAVY,
          '&:hover': {
            ...successContained['&:hover'],
            backgroundColor: theme.palette.success.main,
            color: FILLED_PRIMARY_NAVY
          }
        },
        containedInfo: getColorStyle({ variant: 'contained', color: 'info', theme }),
        containedWarning: getColorStyle({ variant: 'contained', color: 'warning', theme }),
        outlinedPrimary: getColorStyle({ variant: 'outlined', color: 'primary', theme }),
        outlinedSecondary: getColorStyle({ variant: 'outlined', color: 'secondary', theme }),
        outlinedError: getColorStyle({ variant: 'outlined', color: 'error', theme }),
        outlinedSuccess: getColorStyle({ variant: 'outlined', color: 'success', theme }),
        outlinedInfo: getColorStyle({ variant: 'outlined', color: 'info', theme }),
        outlinedWarning: getColorStyle({ variant: 'outlined', color: 'warning', theme }),
        textPrimary: getColorStyle({ variant: 'text', color: 'primary', theme }),
        textSecondary: getColorStyle({ variant: 'text', color: 'secondary', theme }),
        textError: getColorStyle({ variant: 'text', color: 'error', theme }),
        textSuccess: getColorStyle({ variant: 'text', color: 'success', theme }),
        textInfo: getColorStyle({ variant: 'text', color: 'info', theme }),
        textWarning: getColorStyle({ variant: 'text', color: 'warning', theme }),
        sizeExtraSmall: {
          minWidth: 56,
          fontSize: '0.625rem',
          padding: '2px 8px'
        },
        loading: {
          pointerEvents: 'none !important',
          '& svg': {
            width: 'inherit',
            height: 'inherit'
          },
          '&.MuiButton-loadingPositionCenter': {
            color: 'transparent !important'
          }
        }
      }
    }
  };
}
