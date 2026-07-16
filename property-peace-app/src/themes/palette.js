// material-ui
import { createTheme } from '@mui/material';
import { alpha } from '@mui/system';
// third-party
import { presetDarkPalettes, presetPalettes } from '@ant-design/colors';

// project imports
import ThemeOption from './theme';
import { ThemeMode } from 'config';

// ==============================|| DEFAULT THEME - PALETTE ||============================== //

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
    '#282e3b', // 8 - marketing text secondary
    '#061e35', // 9 - brand navy (marketing nav)
    '#061e35'  // 10 - navy replaces black for light-theme text
  ];
  let greyAscent = ['#fafafa', '#bfbfbf', '#434343', '#1f1f1f'];
  let greyConstant = ['#fafafb', '#e6ebf1'];

  if (mode === ThemeMode.DARK) {
    // Midnight dashboard: warm navy-black base, lifted blue-slate surfaces,
    // and readable slate text. Keep it dark, but avoid the flat "black sheet"
    // feeling by giving each surface a slightly different elevation value.
    greyPrimary = ['#0b1320', '#121c2d', '#182338', '#263650', '#41536f', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f8fafc', '#ffffff'];
    greyAscent = ['#f8fafc', '#cbd5e1', '#334155', '#121c2d'];
    greyConstant = ['#0a1220', '#dae4ef'];
  }
  colors.grey = [...greyPrimary, ...greyAscent, ...greyConstant];

  const paletteColor = ThemeOption(colors, presetColor, mode);
  const darkAccent = mode === ThemeMode.DARK ? paletteColor.primary.main : null;

  return createTheme({
    palette: {
      mode,
      common: {
        black: '#061e35',
        white: '#fff'
      },
      ...paletteColor,
      button: paletteColor.button ?? paletteColor.primary,
      text: {
        primary: mode === ThemeMode.DARK ? '#f8fafc' : '#061e35', // Brand navy / marketing nav
        secondary: mode === ThemeMode.DARK ? alpha('#dbe7f3', 0.78) : '#282e3b', // Marketing text secondary
        disabled: mode === ThemeMode.DARK ? alpha('#dbe7f3', 0.38) : paletteColor.grey[400]
      },
      action: {
        disabled: mode === ThemeMode.DARK ? alpha('#dbe7f3', 0.32) : paletteColor.grey[300],
        hover: mode === ThemeMode.DARK ? alpha(darkAccent, 0.1) : alpha(paletteColor.primary.main, 0.04),
        selected: mode === ThemeMode.DARK ? alpha(darkAccent, 0.16) : alpha(paletteColor.primary.main, 0.08)
      },
      divider: mode === ThemeMode.DARK ? alpha('#dbe7f3', 0.2) : paletteColor.grey[200],
      surface: {
        app: mode === ThemeMode.DARK ? '#0b1320' : '#f9f6f4',
        paper: mode === ThemeMode.DARK ? '#121c2d' : '#ffffff',
        raised: mode === ThemeMode.DARK ? '#182338' : '#ffffff',
        nested: mode === ThemeMode.DARK ? '#0f1a2b' : '#f8fafc',
        border: mode === ThemeMode.DARK ? alpha('#dbe7f3', 0.2) : paletteColor.grey[200],
        accentBorder: mode === ThemeMode.DARK ? alpha(darkAccent, 0.48) : alpha(paletteColor.primary.main, 0.18)
      },
      background: {
        paper: mode === ThemeMode.DARK ? '#121c2d' : '#ffffff', // Marketing white
        default: mode === ThemeMode.DARK ? '#0b1320' : '#f9f6f4' // Light theme: #f9f6f4
      }
    }
  });
}
