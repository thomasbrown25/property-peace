import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const propertyHeader = readFileSync(new URL('../property/PropertyHeader.jsx', import.meta.url), 'utf8');
const leaseDetail = readFileSync(new URL('./LeaseDetailView.jsx', import.meta.url), 'utf8');

function actionsButton(source) {
  const button = [...source.matchAll(/<Button\b[\s\S]*?<\/Button>/g)]
    .map(([markup]) => markup)
    .find((markup) => /\bActions\s*<\/Button>/.test(markup));
  assert.ok(button, 'Actions button should exist');
  return button;
}

test('lease Actions trigger shares the property Actions button recipe', () => {
  const propertyButton = actionsButton(propertyHeader);
  const leaseButton = actionsButton(leaseDetail);
  assert.match(propertyButton, /startIcon={<ThunderboltOutlined style={{ fontSize: 13 }} \/>}/);
  assert.match(leaseButton, /startIcon={<ThunderboltOutlined style={{ fontSize: 13 }} \/>}/);
  assert.match(leaseButton, /variant="outlined"/);
  assert.doesNotMatch(leaseButton, /size="small"/);
  for (const style of ['textTransform', 'fontWeight', 'borderRadius', 'px', 'fontSize', 'whiteSpace', 'borderColor']) {
    assert.match(propertyButton, new RegExp(`\\b${style}:`));
    assert.match(leaseButton, new RegExp(`\\b${style}:`));
  }
  assert.match(leaseButton, /borderColor: theme\.palette\.mode === 'dark' \? alpha\('#cbd5e1', 0\.16\) : alpha\(theme\.palette\.divider, 0\.24\)/);
  assert.match(leaseDetail, /<Menu\s+id="lease-actions-menu"/);
});
