import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

function decodeVisibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

test('homepage hero renders the approved title with the management phrase in green', () => {
  const heroStart = homepage.indexOf('data-marketing-hero="home-image"');
  const heroEnd = homepage.indexOf('</section>', heroStart);
  assert.notEqual(heroStart, -1, 'homepage should render the image hero');
  assert.notEqual(heroEnd, -1, 'homepage hero should close');

  const hero = homepage.slice(heroStart, heroEnd);
  const heading = hero.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  assert.ok(heading, 'homepage hero should render an h1');
  assert.equal(
    decodeVisibleText(heading[1]),
    'Property Peace, a clearer way to manage your rentals',
  );
  assert.match(
    heading[1],
    /<span(?=[^>]*text-green-600)[^>]*>manage your rentals<\/span>/,
  );
});
