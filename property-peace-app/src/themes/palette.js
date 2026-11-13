// material-ui
import { createTheme } from '@mui/material';
import { alpha } from '@mui/system';
// third-party
import { presetDarkPalettes, presetPalettes } from '@ant-design/colors';

// project imports
import ThemeOption from './theme';
import { brand, portalSurfaces } from './brand';
import { ThemeMode } from 'config';

// ==============================|| DEFAULT THEME - PALETTE ||============================== //

const secondaryGreen = {
  lighter: '#edf7ed',
  light: '#78c578',
  main: '#41a541',
  dark: '#347f34',
  darker: '#235b23',
  contrastText: '#fff'
};

export default function Palette(mode, presetColor) {
  const colors = mode === ThemeMode.DARK ? presetDarkPalettes : presetPalettes;

  let greyPrimary = [
    '#ffffff', // 0 - white
    '#f5f5f5', // 1 - very light gray (F5F5F5)
    '#e5e5e5', // 2 - light gray (E5E5E5)
    '#f0f0f0', // 3
    '#d9d9d9', // 4
    '#bfbfbf', // 5
    '#737373', // 6 - marketing gray
    '#595959', // 7
    brand.slate, // 8 - portal secondary ink
    brand.forest, // 9 - brand forest
    brand.forest // 10 - darkest portal ink
  ];
  let greyAscent = ['#fafafa', '#bfbfbf', '#434343', '#1f1f1f'];
  let greyConstant = ['#fafafb', '#e6ebf1'];

  if (mode === ThemeMode.DARK) {
    greyPrimary = ['#101f1e', '#1a302d', '#24403b', '#34514a', '#47655e', '#78948a', '#a6bdb2', '#c5d7cb', '#e0eae0', brand.ivory, '#ffffff'];
    greyAscent = [brand.ivory, '#c5d7cb', '#34514a', brand.forest];
    greyConstant = [brand.forest, '#e0eae0'];
  }
  colors.grey = [...greyPrimary, ...greyAscent, ...greyConstant];

  const paletteColor = ThemeOption(colors, presetColor, mode);
  const darkAccent = mode === ThemeMode.DARK ? paletteColor.primary.main : null;
  const dark = mode === ThemeMode.DARK;
  const surfaces = dark ? portalSurfaces.dark : portalSurfaces.light;

  return createTheme({
    palette: {
      mode,
      common: {
        black: brand.forest,
        white: '#fff'
      },
      ...paletteColor,
      brand,
      // Status pills are a separate semantic surface from success/payment colors.
      // Filled active pills share the primary Add/Create action color.
      statusChip: {
        neutral: {
          background: dark ? alpha(brand.mint, 0.14) : '#E9F1EB',
          foreground: dark ? brand.ivory : brand.forest,
          border: dark ? alpha(brand.mint, 0.28) : '#D2E2D8'
        },
        active: {
          background: paletteColor.primary.main,
          foreground: paletteColor.primary.contrastText,
          softBackground: dark ? alpha(paletteColor.primary.main, 0.18) : paletteColor.primary.lighter,
          softForeground: dark ? paletteColor.primary.light : paletteColor.primary.dark
        }
      },
      success: secondaryGreen,
      button: paletteColor.button ?? paletteColor.primary,
      text: {
        primary: dark ? brand.ivory : brand.slate,
        secondary: dark ? '#BED3C7' : '#50615E',
        disabled: dark ? alpha(brand.ivory, 0.42) : paletteColor.grey[400]
      },
      action: {
        disabled: dark ? alpha(brand.ivory, 0.32) : paletteColor.grey[300],
        hover: mode === ThemeMode.DARK ? alpha(darkAccent, 0.1) : alpha(paletteColor.primary.main, 0.04),
        selected: mode === ThemeMode.DARK ? alpha(darkAccent, 0.16) : alpha(paletteColor.primary.main, 0.08)
      },
      divider: dark ? alpha(brand.mint, 0.2) : '#DBE3DA',
      surface: {
        ...surfaces,
        border: dark ? alpha(brand.mint, 0.2) : '#DBE3DA',
        accentBorder: dark ? alpha(darkAccent, 0.48) : alpha(paletteColor.primary.main, 0.25)
      },
      background: {
        paper: surfaces.paper,
        default: surfaces.app
      }
    }
  });
}
