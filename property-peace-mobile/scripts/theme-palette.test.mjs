import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const theme = source('theme/AppTheme.tsx');

function luminance(hex) {
  const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('brand colors are centralized and light surfaces/actions retain text contrast', () => {
  const palette = Object.fromEntries([...theme.matchAll(/(forest|teal|mint|ivory|slate): '(#[0-9A-F]{6})'/g)].map(([, key, color]) => [key, color]));
  assert.deepEqual(palette, {
    forest: '#102C29', teal: '#247568', mint: '#B9E4CB', ivory: '#F8F7F1', slate: '#24343A',
  });
  assert.match(theme, /background: brandColors\.ivory, surface: '#ffffff', text: brandColors\.slate/);
  assert.match(theme, /accent: brandColors\.teal, dock: brandColors\.forest/);
  assert.ok(contrast(palette.teal, palette.ivory) >= 4.5);
  assert.ok(contrast(palette.slate, palette.ivory) >= 4.5);
  assert.ok(contrast(palette.forest, palette.ivory) >= 4.5);
  assert.ok(contrast('#ffffff', palette.teal) >= 4.5);
});

test('dark-mode surfaces and accent remain independent of the light palette', () => {
  assert.match(theme, /background: '#101923', surface: '#1b2937', text: brandColors\.ivory/);
  assert.match(theme, /border: '#35495b', accent: '#72b6ff', dock: '#1b2937'/);
  assert.ok(contrast('#F8F7F1', '#101923') >= 4.5);
});

test('native stack headers use themed light tint and dark text tint', () => {
  for (const path of ['navigation/MainNavigator.tsx', 'navigation/ChecklistsNavigator.tsx']) {
    assert.match(source(path), /headerTintColor: mode === 'dark' \? colors\.text : colors\.accent/);
  }
  assert.match(source('components/PageBackButton.tsx'), /color=\{mode === 'dark' \? colors\.text : colors\.accent\}/);
});
