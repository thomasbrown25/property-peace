import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');

test('property tab panels slide in opposite directions based on tab order', () => {
  parse(source, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(source, /Math\.sign\(tabs\.indexOf\(active\) - tabs\.indexOf\(previousTab\.current\.active\)\)/);
  assert.match(source, /enter: side => \(\{ x: side \* 36, opacity: 0 \}\)/);
  assert.match(source, /exit: side => \(\{ x: side \* -36, opacity: 0/);
  assert.match(source, /<AnimatePresence initial=\{false\} custom=\{direction\}>/);
  assert.match(source, /key=\{`\$\{propertyId\}-\$\{active\}`\}/);
  assert.match(source, /initial=\{reduceMotion \? false : 'enter'\}/);
  assert.match(source, /duration: reduceMotion \? 0 : 0\.22/);
});
