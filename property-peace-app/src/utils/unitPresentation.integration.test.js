import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('units at a glance uses a semantic unit tile and calm inline status instead of image badges', async () => {
  const units = await source('../sections/landlord/property/PropertyUnitsAtAGlance.jsx');

  assert.match(units, /ApartmentOutlined/);
  assert.match(units, /getUnitStatusPresentation/);
  assert.match(units, /statusPresentation\.label/);
  assert.match(units, /borderRadius: 2/);
  assert.doesNotMatch(units, /unit\.png|unitIcon/);
  assert.doesNotMatch(units, /<Chip/);
  assert.doesNotMatch(units, /MoreOutlined/);
});

test('unit drawer exposes one prominent lease-page action and closes before navigation', async () => {
  const drawer = await source('../components/drawers/UnitDetailDrawer.jsx');

  assert.match(drawer, /getLeasePagePath/);
  assert.match(drawer, /const handleOpenLease = \(\) =>/);
  assert.match(drawer, /onClose\(\);\s*navigate\(leasePagePath\)/);
  assert.match(drawer, />\s*Open lease page\s*</);
  assert.equal((drawer.match(/onClick=\{handleOpenLease\}/g) || []).length, 1);
  assert.doesNotMatch(drawer, /View lease document/);
});
