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

test('property and lease Actions remain outlined menu triggers', () => {
  const propertyButton = actionsButton(propertyActions);
  const leaseButton = actionsButton(leaseDetail);
  for (const button of [propertyButton, leaseButton]) {
    assert.match(button, /startIcon=\{<ThunderboltOutlined/);
    assert.match(button, /variant="outlined"/);
    assert.match(button, /aria-haspopup="menu"/);
  }
  assert.match(propertyActions, /borderColor: 'divider'/);
  assert.match(propertyActions, /color: 'text.primary'/);
  assert.match(leaseDetail, /<Menu\s+id="lease-actions-menu"/);
});
