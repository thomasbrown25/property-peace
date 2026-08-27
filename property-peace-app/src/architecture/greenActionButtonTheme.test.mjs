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
    primary: colorScale,
    secondary: colorScale,
    error: colorScale,
    warning: colorScale,
    info: colorScale,
    success: colorScale,
    grey: {
      200: '#e5e5e5',
      300: '#f0f0f0',
      400: '#d9d9d9'
    },
    text: {
      primary: '#061e35',
      secondary: '#282e3b'
    }
  },
  customShadows: {
    primaryButton: 'none',
    secondaryButton: 'none',
    errorButton: 'none',
    warningButton: 'none',
    infoButton: 'none',
    successButton: 'none'
  }
};

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)
      .map((channel) => parseInt(channel, 16) / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('contained green action buttons keep navy text at rest and on hover', async (t) => {
  const vite = await createServer({
    root: appRoot,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true }
  });
  t.after(() => vite.close());

  const { default: createButtonOverrides } = await vite.ssrLoadModule('/src/themes/overrides/Button.js');
  const containedSuccess = createButtonOverrides(theme).MuiButton.styleOverrides.containedSuccess;

  assert.equal(containedSuccess.color, '#061e35');
  assert.equal(containedSuccess['&:hover'].color, '#061e35');
  assert.ok(
    contrastRatio(containedSuccess['&:hover'].color, containedSuccess['&:hover'].backgroundColor) >= 4.5,
    'hover text and background must meet WCAG AA contrast for normal-size button labels'
  );
});
