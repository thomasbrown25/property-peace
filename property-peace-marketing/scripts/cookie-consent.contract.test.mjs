import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesheet = postcss.parse(
  fs.readFileSync(path.join(projectRoot, 'app', 'globals.css'), 'utf8'),
);

function declarationsFor(selector, mediaQuery = null) {
  const declarations = new Map();

  stylesheet.walkRules(selector, (rule) => {
    const parentMedia = rule.parent?.type === 'atrule' && rule.parent.name === 'media'
      ? rule.parent.params
      : null;

    if (parentMedia !== mediaQuery) return;

    rule.walkDecls((declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });

  return declarations;
}

test('cookie consent renders as a white card anchored to the bottom-left', () => {
  const card = declarationsFor('.cookieConsent');

  assert.equal(card.get('position'), 'fixed');
  assert.equal(card.get('left'), 'max(24px, env(safe-area-inset-left))');
  assert.equal(card.get('bottom'), 'max(24px, env(safe-area-inset-bottom))');
  assert.equal(card.get('background'), '#ffffff');
  assert.equal(card.get('transform'), 'none');
});

test('cookie consent uses dark readable text and a restrained outlined card treatment', () => {
  const card = declarationsFor('.cookieConsent');
  const title = declarationsFor('.cookieConsent__title');
  const body = declarationsFor('.cookieConsent__content p');

  assert.equal(card.get('color'), '#061e35');
  assert.equal(card.get('border'), '1px solid #dce6ed');
  assert.equal(title.get('color'), '#061e35');
  assert.equal(body.get('color'), '#405a70');
});

test('cookie consent stays inset and nearly full-width on small screens', () => {
  const card = declarationsFor('.cookieConsent', '(max-width: 720px)');

  assert.equal(card.get('left'), 'max(12px, env(safe-area-inset-left))');
  assert.equal(card.get('right'), 'max(12px, env(safe-area-inset-right))');
  assert.equal(card.get('bottom'), 'max(12px, env(safe-area-inset-bottom))');
  assert.equal(card.get('width'), 'auto');
});
