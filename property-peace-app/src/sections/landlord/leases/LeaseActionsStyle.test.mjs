import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const propertyActions = readFileSync(new URL('../property/PropertyActions.jsx', import.meta.url), 'utf8');
const leaseDetail = readFileSync(new URL('./LeaseDetailView.jsx', import.meta.url), 'utf8');

function actionsButton(source) {
  const button = [...source.matchAll(/<Button\b[\s\S]*?<\/Button>/g)]
    .map(([markup]) => markup)
    .find((markup) => /\bActions\s*<\/Button>/.test(markup));
  assert.ok(button, 'Actions button should exist');
  return button;
}

test('property Actions use the primary fill while lease Actions retain their outlined menu trigger', () => {
  const propertyButton = actionsButton(propertyActions);
  const leaseButton = actionsButton(leaseDetail);
  for (const button of [propertyButton, leaseButton]) {
    assert.match(button, /startIcon=\{<ThunderboltOutlined/);
    assert.match(button, /aria-haspopup="menu"/);
  }
  assert.match(propertyButton, /variant="contained"/);
  assert.match(leaseButton, /variant="outlined"/);
  assert.match(propertyActions, /aria-controls=\{actionsAnchor \? 'property-actions-menu' : undefined\}/);
  assert.match(propertyActions, /<Menu\s+id="property-actions-menu"/);
  assert.match(leaseDetail, /<Menu\s+id="lease-actions-menu"/);
});
