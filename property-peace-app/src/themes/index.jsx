import PropTypes from 'prop-types';
import { useMemo } from 'react';

// material-ui
import { createTheme, ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/system';

import { CssBaseline } from '@mui/material';

// project imports
import useConfig from 'hooks/useConfig';
import Palette from './palette';
import Typography from './typography';
import CustomShadows from './shadows';
import componentsOverride from './overrides';

// ==============================|| DEFAULT THEME - MAIN ||============================== //

export default function ThemeCustomization({ children }) {
  const { themeDirection, mode, presetColor, fontFamily } = useConfig();

  const themes = useMemo(() => {
    const palette = Palette(mode, presetColor);
    const t = createTheme({
      breakpoints: {
        values: { xs: 0, sm: 768, md: 1024, lg: 1266, xl: 1440 }
      },
      direction: themeDirection,
      mixins: {
        toolbar: { minHeight: 60, paddingTop: 8, paddingBottom: 8 }
      },
      palette: palette.palette,
      customShadows: CustomShadows(palette),
      typography: Typography(fontFamily)
    });
    t.components = componentsOverride(t);
    return t;
  }, [mode, presetColor, themeDirection, fontFamily]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={themes}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

ThemeCustomization.propTypes = { children: PropTypes.node };
