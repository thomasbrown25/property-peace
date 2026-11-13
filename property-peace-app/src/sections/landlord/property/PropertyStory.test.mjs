import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const story = readFileSync(new URL('./PropertyStory.jsx', import.meta.url), 'utf8');
const overview = readFileSync(new URL('./PropertyOverview.jsx', import.meta.url), 'utf8');
const activity = readFileSync(new URL('../../../pages/landlord/property-activity.jsx', import.meta.url), 'utf8');

test('compact overview trims newest filtered events to five while activity page remains full', () => {
  parse(story, { sourceType: 'module', plugins: ['jsx'] });
  parse(overview, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(overview, /<PropertyStory property=\{property\} propertyId=\{propertyId\} compact \/>/);
  assert.match(activity, /<PropertyStory property=\{property\} propertyId=\{propertyId\} \/>/);
  assert.match(story, /compact = false/);
  assert.match(story, /return events\.sort\(\(a, b\) => new Date\(b\.date\) - new Date\(a\.date\)\)/);
  assert.match(story, /const filtered = filter === 'all' \? rangeFiltered : rangeFiltered\.filter\(\(i\) => i\.type === filter\)/);
  const selection = story.match(/const visibleItems = (compact \? filtered\.slice\(0, 5\) : filtered);/)?.[1];
  assert.ok(selection, 'limit must apply after range and type filters');
  const newest = Array.from({ length: 8 }, (_, i) => ({ id: i }));
  assert.deepEqual(Array.from(runInNewContext(selection, { compact: true, filtered: newest }), (item) => item.id), [0, 1, 2, 3, 4]);
  assert.deepEqual(Array.from(runInNewContext(selection, { compact: false, filtered: newest }), (item) => item.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(story, /visibleItems\.map\(\(item, idx\) =>/);
  assert.match(story, /isLast=\{idx === visibleItems\.length - 1\}/);
  assert.match(story, /navigate\(`\/landlord\/property-activity\/\$\{propertyId\}`\)/);
});

test('rent activity uses mint surfaces with readable branded ink and retains semantic maintenance badges', () => {
  assert.doesNotMatch(story, /#41a541/);
  assert.match(story, /bgcolor: item\.type === 'money' \? alpha\(theme\.palette\.brand\.mint/);
  assert.match(story, /theme\.palette\.brand\.teal/);
  assert.match(story, /theme\.palette\.brand\.mint : theme\.palette\.brand\.teal/);
  assert.match(story, /color=\{child\.priority === 'high' \? 'error' : child\.priority === 'low' \? 'default' : 'warning'\}/);
  assert.match(story, /color=\{getMaintenanceStatusMeta\(child\.maintenanceStatus\)\.color\}/);
  assert.match(story, /maintenance: \{ label: 'MAINTENANCE',\s+color: '#d97706'/);
});
