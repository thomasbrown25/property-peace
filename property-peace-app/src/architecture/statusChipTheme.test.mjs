import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const appRoot = fileURLToPath(new URL('../..', import.meta.url));

test('status chips share the portal theme across default, success and soft variants', async (t) => {
  const vite = await createServer({ root: appRoot, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } });
  t.after(() => vite.close());
  const { default: Palette } = await vite.ssrLoadModule('/src/themes/palette.js');
  const { default: createChipOverrides } = await vite.ssrLoadModule('/src/themes/overrides/Chip.js');
  for (const mode of ['light', 'dark']) {
    const theme = Palette(mode, 'default');
    const palette = theme.palette;
    const chip = createChipOverrides(theme).MuiChip.styleOverrides;
    assert.equal(chip.root['&.MuiChip-filledDefault'].backgroundColor, palette.statusChip.neutral.background);
    assert.equal(chip.root['&.MuiChip-filledDefault'].color, palette.statusChip.neutral.foreground);
    assert.equal(chip.root['&.MuiChip-filled.MuiChip-colorSuccess'].backgroundColor, palette.primary.main);
    assert.equal(chip.root['&.MuiChip-filled.MuiChip-colorSuccess'].color, palette.primary.contrastText);
    assert.equal(chip.root['&.MuiChip-outlined.MuiChip-colorSuccess'].color, palette.statusChip.active.softForeground);
    assert.equal(chip.light['&.MuiChip-lightDefault'].backgroundColor, palette.statusChip.neutral.background);
    assert.equal(chip.combined['&.MuiChip-combinedDefault'].borderColor, palette.statusChip.neutral.border);
    assert.equal(chip.light['&.MuiChip-lightSuccess'].backgroundColor, palette.statusChip.active.softBackground);
    assert.equal(chip.combined['&.MuiChip-combinedSuccess'].color, palette.statusChip.active.softForeground);
    assert.notEqual(palette.statusChip.neutral.background.toLowerCase(), '#061e35');
    assert.notEqual(palette.statusChip.active.background.toLowerCase(), '#41a541');
  }
});
