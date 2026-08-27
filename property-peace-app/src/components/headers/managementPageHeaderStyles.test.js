import assert from 'node:assert/strict';
import test from 'node:test';

async function loadStyles() {
  try {
    return await import('./managementPageHeaderStyles.js');
  } catch {
    return null;
  }
}

test('management page headers use a transparent surface with normal page typography', async () => {
  const styles = await loadStyles();

  assert.ok(styles, 'Expected the shared management page header styles to exist');
  assert.equal(styles.managementPageHeaderContainerSx.background, 'transparent');
  assert.equal(styles.managementPageHeaderContainerSx.boxShadow, 'none');
  assert.equal(styles.managementPageHeaderTitleSx.color, 'text.primary');
  assert.equal(styles.managementPageHeaderDescriptionSx.color, 'text.secondary');
});

test('management page header actions retain the standard light-surface treatment', async () => {
  const styles = await loadStyles();

  assert.ok(styles, 'Expected the shared management page header styles to exist');
  assert.equal(styles.managementPageHeaderActionSx.textTransform, 'none');
  assert.equal(styles.managementPageHeaderActionSx.fontWeight, 700);
  assert.equal(styles.managementPageHeaderActionSx.boxShadow, 'none');
  assert.equal(Object.hasOwn(styles.managementPageHeaderActionSx, 'color'), false);
  assert.equal(Object.hasOwn(styles.managementPageHeaderActionSx, 'borderColor'), false);
});
