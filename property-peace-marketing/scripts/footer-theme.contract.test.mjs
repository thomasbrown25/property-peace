import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const footer = read('../components/Layout/SiteFooter.tsx');
const faq = read('../components/Sections/FAQ.tsx');
const css = read('../app/globals.css');

test('footer shares the dark FAQ forest background token', () => {
  assert.match(footer, /<footer className="[^"]*\bbg-brand-forest\b/);
  assert.match(faq, /dark \? 'bg-brand-forest'/);
  assert.match(css, /--brand-forest:\s*#102C29;/i);
  assert.doesNotMatch(footer, /#061e35|#22c55e|hover:text-green-400/i);
});

test('footer headings, legal links, and social controls use the new theme', () => {
  assert.match(footer, /<h3 className="[^"]*text-brand-mint/);
  for (const route of ['terms', 'privacy', 'sitemap']) {
    assert.match(footer, new RegExp(`href="/${route}" className="[^"]*text-brand-mint[^\"]*hover:text-white`));
  }
  assert.match(footer, /bg-brand-forest-raised text-brand-mint/);
  assert.match(footer, /hover:bg-brand-forest-hover/);
});
