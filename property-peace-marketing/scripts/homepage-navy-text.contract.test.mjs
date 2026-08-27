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

test('resource and signup typography use the review-card navy', () => {
  for (const [tagName, text] of [
    ['h2', 'Useful before you ever open the app'],
    ['h3', 'Free Landlord Starter Pack'],
    ['h2', 'Get started today for Free'],
    ['ul', 'Start free — no credit card required'],
  ]) {
    assert.match(
      openingTagForText(tagName, text),
      /\btext-primary-deep\b/,
      `“${text}” should use the shared dark navy`,
    );
  }
});

test('FAQ heading and questions use the review-card navy', () => {
  for (const [tagName, text] of [
    ['h2', 'Questions landlords ask before getting started.'],
    ['span', 'Is Property Peace a good fit for hosts with 1–3 properties?'],
  ]) {
    assert.match(
      openingTagForText(tagName, text),
      /\btext-primary-deep\b/,
      `“${text}” should use the shared dark navy`,
    );
  }
});
