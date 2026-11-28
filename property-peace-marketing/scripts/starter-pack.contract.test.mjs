import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const starterPackPage = source('app/resources/starter-pack/page.tsx');
const generator = source('scripts/generate-landlord-starter-pack.py');

test('starter pack presents separate move-in, move-out, and condition-report downloads', () => {
  for (const filename of ['move-in-checklist.pdf', 'move-out-checklist.pdf', 'condition-report.pdf']) {
    assert.match(starterPackPage, new RegExp(filename.replace('.', '\\.')));
    assert.match(generator, new RegExp(filename.replace('.', '\\.')));
  }
  assert.match(starterPackPage, /Seven practical files/);
  assert.match(starterPackPage, /Download all seven resources/);
});

test('starter pack keeps the former inspection download available for existing links', () => {
  assert.match(generator, /move-in-move-out-inspection-checklist\.pdf/);
});

test('move-in content explains that the condition report is a separate handoff step', () => {
  const article = source('lib/blog-posts.ts');
  assert.match(article, /Complete a Condition Report/);
  assert.match(article, /What to Document Before Handing Over the Keys/);
  assert.match(starterPackPage, /Start my move-in checklist/);
  assert.match(starterPackPage, /register\?intent=move-in-checklist/);
});

test('starter-pack download icons use theme colors without decorative background containers', () => {
  assert.doesNotMatch(starterPackPage, /<span className="flex h-12 w-12[^"]*bg-brand-/);
  assert.match(starterPackPage, /<Icon className="h-6 w-6[^\"]*text-brand-teal/);
});

test('generated PDF checklists draw usable vector checkboxes', () => {
  assert.match(generator, /class Checkbox\(Flowable\)/);
  assert.match(generator, /self\.canv\.rect\(/);
  assert.match(generator, /\[Checkbox\(\), Paragraph\(item/);
});
