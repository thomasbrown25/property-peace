import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const appRoot = fileURLToPath(new URL('../..', import.meta.url));

const colorScale = {
  lighter: '#edf7ed',
  light: '#78c578',
  main: '#41a541',
  dark: '#347f34',
  darker: '#235b23',
  contrastText: '#fff'
};

const theme = {
  palette: {
    mode: 'light',
    common: { black: '#061e35' },
    primary: colorScale,
    secondary: colorScale,
    error: colorScale,
    warning: colorScale,
    info: colorScale,
    success: colorScale,
    statusChip: {
      neutral: { background: '#e9f1eb', foreground: '#102c29' },
      active: { background: '#247568', foreground: '#fff', softBackground: '#edf7f0', softForeground: '#1c6055' }
    },
    text: { primary: '#f8fafc' }
  },
  applyStyles: (_mode, styles) => ({ darkMode: styles })
};

test('success chips use the branded active token instead of legacy navy text', async (t) => {
  const vite = await createServer({
    root: appRoot,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true }
  });
  t.after(() => vite.close());

  const { default: createChipOverrides } = await vite.ssrLoadModule('/src/themes/overrides/Chip.js');
  const overrides = createChipOverrides(theme).MuiChip.styleOverrides;
  const lightSuccessChip = overrides.light['&.MuiChip-lightSuccess'];
  const combinedSuccessChip = overrides.combined['&.MuiChip-combinedSuccess'];

  const filledSuccessChip = overrides.root['&.MuiChip-filled.MuiChip-colorSuccess'];
  assert.equal(filledSuccessChip.backgroundColor, '#247568');
  assert.equal(filledSuccessChip.color, '#fff');
  assert.equal(filledSuccessChip['& .MuiChip-icon, & .MuiChip-deleteIcon'].color, 'inherit');
  assert.equal(lightSuccessChip.color, '#1c6055');
  assert.equal(lightSuccessChip.backgroundColor, '#edf7f0');
  assert.equal(combinedSuccessChip.color, '#1c6055');
  assert.equal(combinedSuccessChip.backgroundColor, '#edf7f0');
});
