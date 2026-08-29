// ==============================|| DEFAULT THEME - TYPOGRAPHY ||============================== //

export default function Typography(fontFamily) {
  return {
    htmlFontSize: 16,
    fontFamily: "'Inter', sans-serif", // Default to Inter for body text
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    h1: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 700, // Bold
      fontSize: '2.5rem', // Match marketing: text-4xl to text-6xl (responsive sizing handled via sx prop)
      lineHeight: 1.1 // Tighter for headings
    },
    h2: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 700, // Bold
      fontSize: '2rem', // Match marketing: text-4xl to text-5xl (responsive sizing handled via sx prop)
      lineHeight: 1.2
    },
    h3: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 600, // SemiBold
      fontSize: '1.875rem',
      lineHeight: 1.3
    },
    h4: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 600, // SemiBold
      fontSize: '1.5rem',
      lineHeight: 1.4
    },
    h5: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 600, // SemiBold
      fontSize: '1.25rem',
      lineHeight: 1.5
    },
    h6: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 500, // Medium
      fontSize: '1rem',
      lineHeight: 1.57
    },
    caption: {
      fontWeight: 400,
      fontSize: '0.75rem',
      lineHeight: 1.66
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.57
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.66
    },
    subtitle1: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.57
    },
    subtitle2: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.66
    },
    overline: {
      lineHeight: 1.66
    },
    button: {
      fontFamily: "'Inter', sans-serif", // Buttons use Inter
      textTransform: 'none', // Marketing buttons don't capitalize
      fontWeight: 500 // Medium weight
    }
  };
}
