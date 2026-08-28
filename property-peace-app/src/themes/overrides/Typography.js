// ==============================|| OVERRIDES - TYPOGRAPHY ||============================== //

export default function Typography(theme) {
  return {
    MuiTypography: {
      styleOverrides: {
        gutterBottom: {
          marginBottom: 12
        },
        h1: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        h2: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        h3: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        h4: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        h5: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        h6: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        body1: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        body2: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        caption: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        subtitle1: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        },
        subtitle2: {
          fontFamily: theme.typography.fontFamily,
          color: theme.palette.text.primary
        }
      }
    }
  };
}
