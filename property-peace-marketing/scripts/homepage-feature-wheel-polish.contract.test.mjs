import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

function readFeatureWheel() {
  const marker = 'data-homepage-feature-wheel="true"';
  const markerIndex = homepage.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'homepage should render the feature wheel');

  const sectionStart = homepage.lastIndexOf('<section', markerIndex);
  const tagPattern = /<\/?section\b[^>]*>/gi;
  tagPattern.lastIndex = sectionStart;
  let depth = 0;

  for (let match; (match = tagPattern.exec(homepage));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return homepage.slice(sectionStart, tagPattern.lastIndex);
  }

  assert.fail('feature wheel section should close');
}

test('feature wheel uses a distinct, concise homepage headline', () => {
  const wheel = readFeatureWheel();

  assert.match(wheel, /Everyday workflows\./);
  assert.match(wheel, /One calm system\./);
  assert.doesNotMatch(wheel, /Seven everyday workflows/);
  assert.doesNotMatch(wheel, /Property Peace brings every rental workflow/);
});

test('desktop wheel spokes point toward their matching callouts', () => {
  const wheel = readFeatureWheel();
  const expectedPositions = [
    ['Rent tracking', 'top-left'],
    ['Tenant and lease records', 'left'],
    ['Maintenance tracking', 'bottom-left'],
    ['Portfolio dashboard', 'bottom'],
    ['Reports and exports', 'bottom-right'],
    ['Document storage', 'right'],
    ['Expense tracking', 'top-right'],
  ];

  for (const [feature, position] of expectedPositions) {
    const icon = new RegExp(
      `<span(?=[^>]*data-wheel-feature="${feature}")(?=[^>]*data-wheel-position="${position}")[^>]*>`,
    );
    assert.match(wheel, icon, `${feature} should occupy the ${position} spoke`);
  }
});
