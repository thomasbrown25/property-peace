// ==============================|| OVERRIDES - TYPOGRAPHY ||============================== //

export default function Typography(theme) {
  return {
    MuiTypography: {
      styleOverrides: {
        gutterBottom: {
          marginBottom: 12
        },
        h1: {
          fontFamily: "'Poppins', sans-serif",
          color: theme.palette.text.primary
        },
        h2: {
          fontFamily: "'Poppins', sans-serif",
          color: theme.palette.text.primary
        },
        h3: {
          fontFamily: "'Poppins', sans-serif",
          color: theme.palette.text.primary
        },
        h4: {
          fontFamily: "'Poppins', sans-serif",
          color: theme.palette.text.primary
        },
        h5: {
          fontFamily: "'Poppins', sans-serif",
          color: theme.palette.text.primary
        },
        h6: {
          fontFamily: "'Poppins', sans-serif",
          color: theme.palette.text.primary
        },
        body1: {
          fontFamily: "'Inter', sans-serif",
          color: theme.palette.text.primary
        },
        body2: {
          fontFamily: "'Inter', sans-serif",
          color: theme.palette.text.primary
        },
        caption: {
          fontFamily: "'Inter', sans-serif",
          color: theme.palette.text.primary
        },
        subtitle1: {
          fontFamily: "'Inter', sans-serif",
          color: theme.palette.text.primary
        },
        subtitle2: {
          fontFamily: "'Inter', sans-serif",
          color: theme.palette.text.primary
        }
      }
    }
  };
}
