import PropTypes from 'prop-types';
import { Drawer, alpha, useTheme } from '@mui/material';

const DARK_SURFACE = '#061E35';
const DARK_ACCENT = '#7EE3A3';
const DARK_ACCENT_HOVER = '#96E9B4';

export const getThemeAdaptiveDrawerStyles = (theme) => {
  const isDarkMode = theme.palette.mode === 'dark';
  const accent = isDarkMode ? DARK_ACCENT : theme.palette.primary.main;
  const primaryText = isDarkMode ? '#FFFFFF' : theme.palette.text.primary;
  const secondaryText = isDarkMode ? 'rgba(255, 255, 255, 0.68)' : theme.palette.text.secondary;
  const divider = isDarkMode ? 'rgba(255, 255, 255, 0.16)' : theme.palette.divider;

  return {
    isDarkMode,
    accent,
    primaryText,
    secondaryText,
    divider,
    backdrop: {
      bgcolor: isDarkMode ? 'rgba(1, 11, 22, 0.62)' : 'rgba(6, 30, 53, 0.32)',
      backdropFilter: 'blur(2px)'
    },
    paper: {
      display: 'flex',
      flexDirection: 'column',
      color: primaryText,
      bgcolor: isDarkMode ? DARK_SURFACE : theme.palette.background.paper,
      backgroundImage: isDarkMode
        ? 'linear-gradient(155deg, rgba(126, 227, 163, 0.08) 0%, rgba(6, 30, 53, 0) 34%)'
        : 'none',
      borderLeft: isDarkMode ? '1px solid rgba(126, 227, 163, 0.48)' : `1px solid ${theme.palette.divider}`,
      boxShadow: isDarkMode ? '-24px 0 64px rgba(0, 0, 0, 0.42)' : '-18px 0 48px rgba(6, 30, 53, 0.14)',

      '& .MuiDivider-root': { borderColor: divider },
      '& .MuiInputLabel-root': { color: isDarkMode ? 'rgba(255, 255, 255, 0.72)' : theme.palette.text.secondary },
      '& .MuiInputLabel-root.Mui-focused': { color: accent },
      '& .MuiFormLabel-root:not(.Mui-error)': { color: isDarkMode ? 'rgba(255, 255, 255, 0.72)' : theme.palette.text.secondary },
      '& .MuiFormLabel-root.Mui-focused:not(.Mui-error)': { color: accent },
      '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
        color: primaryText,
        borderRadius: 1,
        bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : theme.palette.background.default,
        '& fieldset, & .MuiOutlinedInput-notchedOutline': {
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.42)' : theme.palette.divider
        },
        '&:hover fieldset, &:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: isDarkMode ? 'rgba(126, 227, 163, 0.78)' : theme.palette.primary.main
        },
        '&.Mui-focused': { bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : theme.palette.background.paper },
        '&.Mui-focused fieldset, &.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: accent,
          borderWidth: 2
        },
        '&.Mui-error fieldset, &.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.error.main },
        '&.Mui-disabled': {
          color: theme.palette.text.disabled,
          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.035)' : theme.palette.action.disabledBackground
        },
        '& input::placeholder, & textarea::placeholder': {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.58)' : theme.palette.text.secondary,
          opacity: 1
        }
      },
      '& .MuiFilledInput-root, & .MuiInputBase-root:not(.MuiOutlinedInput-root):not(.MuiPickersOutlinedInput-root)': {
        color: primaryText
      },
      '& .MuiSelect-icon, & .MuiInputAdornment-root, & .MuiIconButton-root': {
        color: isDarkMode ? 'rgba(255, 255, 255, 0.78)' : theme.palette.text.secondary
      },
      '& .MuiFormHelperText-root:not(.Mui-error), & .MuiFormControlLabel-label': { color: secondaryText },
      '& .MuiTypography-colorTextSecondary': { color: secondaryText },
      '& .MuiCheckbox-root:not(.Mui-error), & .MuiRadio-root:not(.Mui-error)': {
        color: isDarkMode ? 'rgba(255, 255, 255, 0.58)' : theme.palette.text.secondary,
        '&.Mui-checked': { color: accent }
      },
      '& .MuiSwitch-switchBase.Mui-checked': {
        color: accent,
        '& + .MuiSwitch-track': { bgcolor: accent }
      },
      '& .MuiPaper-outlined': {
        color: primaryText,
        bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.055)' : theme.palette.background.paper,
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.16)' : theme.palette.divider
      },
      '& .MuiButton-containedPrimary': {
        color: isDarkMode ? DARK_SURFACE : theme.palette.primary.contrastText,
        bgcolor: isDarkMode ? DARK_ACCENT : theme.palette.primary.main,
        fontWeight: 700,
        textTransform: 'none',
        boxShadow: isDarkMode
          ? '0 10px 24px rgba(126, 227, 163, 0.20)'
          : `0 10px 24px ${alpha(theme.palette.primary.main, 0.22)}`,
        '&:hover': {
          bgcolor: isDarkMode ? DARK_ACCENT_HOVER : theme.palette.primary.dark,
          boxShadow: isDarkMode
            ? '0 12px 28px rgba(126, 227, 163, 0.30)'
            : `0 12px 28px ${alpha(theme.palette.primary.main, 0.30)}`
        },
        '&.Mui-disabled': {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.40)' : theme.palette.action.disabled,
          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.10)' : theme.palette.action.disabledBackground,
          boxShadow: 'none'
        }
      },
      '& .MuiButton-outlinedPrimary': {
        color: isDarkMode ? 'rgba(255, 255, 255, 0.86)' : theme.palette.primary.main,
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.30)' : theme.palette.primary.main,
        textTransform: 'none',
        '&:hover': {
          color: isDarkMode ? '#FFFFFF' : theme.palette.primary.dark,
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.58)' : theme.palette.primary.dark,
          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : alpha(theme.palette.primary.main, 0.05)
        }
      },
      '& .MuiButton-textPrimary': {
        color: isDarkMode ? DARK_ACCENT : theme.palette.primary.main
      },
      '& .MuiToolbar-root': {
        flexShrink: 0,
        color: primaryText
      },
      '& .MuiToolbar-root .MuiTypography-h5, & .MuiToolbar-root .MuiTypography-h6': {
        color: primaryText,
        fontWeight: 700
      },
      '& .MuiStepLabel-label, & .MuiTab-root': { color: secondaryText },
      '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed, & .MuiTab-root.Mui-selected': { color: primaryText },
      '& .MuiStepper-root': { counterReset: 'drawer-step' },
      '& .MuiStep-root': { counterIncrement: 'drawer-step' },
      '& .MuiStepLabel-iconContainer': {
        position: 'relative',
        width: 32,
        height: 24,
        pr: 1,
        flexShrink: 0,
        '&.MuiStepLabel-alternativeLabel': { width: 24, pr: 0 },
        '& .MuiStepIcon-root': {
          width: 24,
          height: 24,
          visibility: 'hidden'
        },
        '&::after': {
          content: 'counter(drawer-step)',
          position: 'absolute',
          top: 0,
          left: 0,
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          color: '#FFFFFF',
          bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.28)' : theme.palette.grey[400],
          fontSize: '0.75rem',
          fontWeight: 700,
          lineHeight: 1
        },
        '&.Mui-active::after, &.Mui-completed::after': {
          color: '#FFFFFF',
          bgcolor: accent
        }
      },
      '& .MuiTabs-indicator': { bgcolor: accent }
    }
  };
};

const mergeSlotSx = (...styles) => styles.filter(Boolean);

export default function ThemeAdaptiveDrawer({ PaperProps, slotProps, ...drawerProps }) {
  const theme = useTheme();
  const styles = getThemeAdaptiveDrawerStyles(theme);
  const paperSlotProps = slotProps?.paper || {};
  const mergedPaperProps = {
    ...PaperProps,
    ...paperSlotProps,
    sx: mergeSlotSx(PaperProps?.sx, paperSlotProps.sx, styles.paper)
  };

  return (
    <Drawer
      anchor="right"
      {...drawerProps}
      PaperProps={mergedPaperProps}
      slotProps={{
        ...slotProps,
        backdrop: {
          ...slotProps?.backdrop,
          sx: mergeSlotSx(slotProps?.backdrop?.sx, styles.backdrop)
        },
        paper: mergedPaperProps
      }}
    />
  );
}

ThemeAdaptiveDrawer.propTypes = {
  PaperProps: PropTypes.object,
  slotProps: PropTypes.object
};
