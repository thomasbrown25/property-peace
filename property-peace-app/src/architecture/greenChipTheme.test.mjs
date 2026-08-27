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
    text: { primary: '#f8fafc' }
  },
  applyStyles: (_mode, styles) => ({ darkMode: styles })
};

test('green chips use brand navy text and icons throughout the app', async (t) => {
  const vite = await createServer({
    root: appRoot,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true }
  });
  t.after(() => vite.close());

  const { default: createChipOverrides } = await vite.ssrLoadModule('/src/themes/overrides/Chip.js');
  const overrides = createChipOverrides(theme).MuiChip.styleOverrides;
  const successChip = overrides.root['&.MuiChip-colorSuccess'];
  const lightSuccessChip = overrides.light['&.MuiChip-lightSuccess'];
  const combinedSuccessChip = overrides.combined['&.MuiChip-combinedSuccess'];

  assert.equal(successChip.color, '#061e35');
  assert.equal(successChip['& .MuiChip-icon'].color, '#061e35');
  assert.equal(successChip['& .MuiChip-deleteIcon'].color, '#061e35');
  assert.equal(lightSuccessChip.color, '#061e35');
  assert.equal(lightSuccessChip.darkMode.color, '#061e35');
  assert.equal(combinedSuccessChip.color, '#061e35');
  assert.equal(combinedSuccessChip.darkMode.color, '#061e35');
});
