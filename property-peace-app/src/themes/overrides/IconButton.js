// ==============================|| OVERRIDES - ICON BUTTON ||============================== //

export default function IconButton(theme) {
  return {
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          color: theme.palette.mode === 'dark' ? theme.palette.text.secondary : 'inherit',
          '&:hover': {
            color: theme.palette.mode === 'dark' ? theme.palette.text.primary : 'inherit',
            backgroundColor: theme.palette.mode === 'dark' ? theme.palette.action.hover : undefined
          },
          '& svg': {
            color: 'inherit'
          },
          '&.MuiIconButton-loading': {
            pointerEvents: 'none !important',
            '& svg': {
              width: 'inherit !important',
              height: 'inherit !important'
            }
          }
        },
        sizeLarge: {
          width: theme.spacing(5.5),
          height: theme.spacing(5.5),
          fontSize: '1.25rem'
        },
        sizeMedium: {
          width: theme.spacing(4.5),
          height: theme.spacing(4.5),
          fontSize: '1rem'
        },
        sizeSmall: {
          width: theme.spacing(3.75),
          height: theme.spacing(3.75),
          fontSize: '0.75rem'
        }
      }
    }
  };
}
