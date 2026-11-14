import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function readExportedPage(relativePath) {
  return fs.readFileSync(path.join(projectRoot, 'out', relativePath, 'index.html'), 'utf8');
}

const stylesheet = postcss.parse(fs.readFileSync(path.join(projectRoot, 'app/globals.css'), 'utf8'));
const tokens = new Map();
stylesheet.walkRules(':root', (rule) => rule.walkDecls((decl) => tokens.set(decl.prop, decl.value)));

function luminance(token) {
  const hex = tokens.get(token);
  assert.match(hex ?? '', /^#[0-9a-f]{6}$/i, `${token} should resolve to an explicit brand color`);
  const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('semantic forest, teal, and mint text/surface pairs meet WCAG AA normal-text contrast', () => {
  const pairs = [
    ['--brand-surface', '--brand-forest'], ['--brand-ivory', '--brand-forest'],
    ['--brand-mint', '--brand-forest'], ['--brand-forest', '--brand-surface'],
    ['--brand-slate', '--brand-surface'], ['--brand-slate', '--brand-ivory'],
    ['--brand-forest', '--brand-ivory'], ['--brand-teal', '--brand-surface'],
    ['--brand-surface', '--brand-teal'], ['--brand-surface', '--brand-teal-hover'],
  ];
  for (const [foreground, background] of pairs) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= 4.5, `${foreground} on ${background} should meet 4.5:1 (actual ${ratio.toFixed(2)}:1)`);
  }
});

test('listings hero fades into the following forest section at mobile and desktop widths', () => {
  const html = readExportedPage('listings');
  const sections = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map((match) => match[0]);
  assert.ok(sections.length >= 2, 'listings should retain the hero and features sections');
  assert.match(sections[0], /class="marketing-hero-fade absolute inset-0"/, 'reuse the shared photo fade');
  assert.match(sections[1], /^<section\b[^>]*class="bg-brand-forest\b/, 'the next section must match the fade endpoint');
  const fades = [];
  stylesheet.walkRules('.marketing-hero-fade', (rule) => {
    rule.walkDecls('background', (decl) => fades.push(decl.value));
  });
  assert.ok(fades.length >= 2, 'cover the base and responsive photo overlays');
  for (const fade of fades) {
    assert.match(fade, /^linear-gradient\(to top, var\(--brand-forest\) 0%,/, 'the bottom edge must be opaque forest, not navy');
  }
});

test('new marketing surfaces do not render decorative background grids', () => {
  for (const relativePath of ['about', 'how-it-works', '']) {
    const html = readExportedPage(relativePath);
    assert.doesNotMatch(html, /background-image:linear-gradient\(rgba\(255,255,255,.8\) 1px/, `${relativePath || 'home'} should not render a decorative grid`);
  }
});

test('new page registration actions use readable teal fills or mint text instead of legacy green gradients', () => {
  for (const relativePath of ['about', 'how-it-works']) {
    const html = readExportedPage(relativePath);
    const actions = [...html.matchAll(/<a\b[^>]*href="https:\/\/app\.propertypeace\.io\/register"[^>]*>[\s\S]*?<\/a>/g)]
      .map((match) => match[0]).filter((action) => /Start free/i.test(action) && !/target="_blank"/.test(action));
    assert.ok(actions.length > 0, `${relativePath} should retain a Start free registration action`);
    let filledActions = 0;
    for (const action of actions) {
      const openingTag = action.slice(0, action.indexOf('>') + 1);
      const tealFill = /\bbg-brand-teal\b|background:linear-gradient\(135deg, var\(--brand-teal\), var\(--brand-teal\)\)/.test(openingTag);
      if (tealFill) {
        filledActions += 1;
        assert.match(openingTag, /\btext-white\b/, `${relativePath} teal actions should have explicit white text`);
      } else {
        assert.match(openingTag, /\btext-brand-mint\b/, `${relativePath} text actions should have explicit mint text`);
      }
    }
    assert.ok(filledActions > 0, `${relativePath} should retain a filled teal primary registration action`);
    assert.doesNotMatch(html, /background:linear-gradient\(135deg, #22c55e, #16a34a\)/i);
  }
});

function tsxFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(filename) : entry.isFile() && entry.name.endsWith('.tsx') ? [filename] : [];
  });
}
const sourceFiles = ['app', 'components'].flatMap((directory) => tsxFiles(path.join(projectRoot, directory)));

test('all app and component TSX sources are free of Poppins', () => {
  assert.ok(sourceFiles.length > 0, 'the source audit must inspect TSX files');
  const violations = sourceFiles.filter((filename) => /poppins/i.test(fs.readFileSync(filename, 'utf8')));
  assert.deepEqual(violations.map((filename) => path.relative(projectRoot, filename)), [], 'use Host Grotesk for display typography, not Poppins');
});

test('all app and component TSX sources are free of legacy navy brand colors', () => {
  // Status blue/indigo palettes remain valid for informational states. This targets
  // the retired brand ink/body colors (including inline gradients), not all blues
  // or historical variable names/metadata mentioning navy.
  const legacyBrand = /#(?:061e35|405a70|637083)\b|rgba?\(\s*6\s*[, ]\s*30\s*[, ]\s*53\b/ig;
  const violations = [];
  for (const filename of sourceFiles) {
    fs.readFileSync(filename, 'utf8').split(/\r?\n/).forEach((line, index) => {
      legacyBrand.lastIndex = 0;
      if (legacyBrand.test(line)) violations.push(`${path.relative(projectRoot, filename)}:${index + 1}`);
    });
  }
  assert.deepEqual(violations, [], 'replace retired navy/blue brand literals with semantic forest/slate tokens; status palettes are not prohibited');
});
