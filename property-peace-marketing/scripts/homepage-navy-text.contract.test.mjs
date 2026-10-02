import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

function openingTagForText(tagName, text) {
  const textIndex = homepage.indexOf(text);
  assert.notEqual(textIndex, -1, `homepage should render “${text}”`);

  const tagStart = homepage.lastIndexOf(`<${tagName}`, textIndex);
  const tagEnd = homepage.indexOf('>', tagStart);
  assert.notEqual(tagStart, -1, `“${text}” should render in a ${tagName}`);
  assert.notEqual(tagEnd, -1, `“${text}” ${tagName} should close its opening tag`);
  return homepage.slice(tagStart, tagEnd + 1);
}

test('resource and signup headings are white on navy; slate-blue resource cards keep white text', () => {
  for (const [tagName, text] of [
    ['h2', 'Useful before you ever open the app'],
    ['h2', 'Get started today for Free'],
    ['ul', 'Start free — no credit card required'],
  ]) {
    assert.match(
      openingTagForText(tagName, text),
      /\btext-white\b/,
      `“${text}” should be white on the navy section`,
    );
  }
  assert.match(openingTagForText('h3', 'Free Landlord Starter Pack'), /\btext-white\b/);
});

test('homepage FAQ has a white heading on navy and navy questions on white cards', () => {
  assert.match(openingTagForText('h2', 'Questions landlords ask before getting started.'), /\btext-white\b/);
  assert.match(openingTagForText('span', 'Is Property Peace a good fit for hosts with 1–3 properties?'), /\btext-primary-deep\b/);
});
