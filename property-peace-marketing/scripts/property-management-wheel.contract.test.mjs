import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

const approvedWheelPathHashes = [
  '4e6fffbe99fcbe557574b999ace2e065fa7eac297bca2935ea748f64376ec2f7',
  '4d3f3594fc7fa93fc0daf0f6847706e445cc031212f83594d7d1cbf0bce311ba',
  '990d709957e251c95e3b08d0528e6418b76267e10e22e21f6da84aea94d2c073',
  '9d5945931b338164419dfb2f506dc4441ea119d47f3df26f8355c3c9d0518467',
  '335e93e312dfd1bb8f8f6d2e91bb5940efe8db59aea24952afd08614500cc23b',
  '41ff81641be57f849e66df0843fba0e4ecd319da6ca8920b86f87972ba77e2f6',
  'c44ad310e8d0ff8088676aef7784b5c9112cf1a5958a54823878379a274bd6be',
];

test('desktop feature wheel renders rounded SVG segments with the existing hover behavior', () => {
  const segments = [...homepage.matchAll(/<path(?=[^>]*data-wheel-segment="true")[^>]*>/g)].map(
    ([tag]) => tag,
  );

  assert.equal(segments.length, 7, 'the desktop wheel should render one SVG segment per feature');

  const featureIds = [];
  const pathData = [];

  for (const segment of segments) {
    assert.match(segment, /fill-primary-deep/, 'each segment should match the review-card navy at rest');
    assert.match(segment, /hover:fill-\[#15803D\]/, 'each hovered segment should use the secondary green');
    assert.match(segment, /hover:scale-\[1\.025\]/, 'each hovered segment should expand slightly');
    assert.match(segment, /transition-\[fill,stroke,transform\]/, 'fill, focus ring, and scale should transition smoothly');
    assert.match(segment, /duration-200/, 'the hover transition should stay quick');
    assert.match(segment, /ease-out/, 'the hover transition should settle naturally');
    assert.match(segment, /group-focus-visible\/wheel-link:stroke-\[#A7F3D0\]/, 'keyboard focus should remain visibly outlined');
    assert.match(segment, /motion-reduce:transform-none/, 'segment expansion should respect reduced motion');
    const segmentPath = segment.match(/d="([^"]+)"/)?.[1];
    assert.ok(segmentPath, 'each segment should render SVG path data');
    assert.equal(segmentPath.match(/\bQ\b/g)?.length ?? 0, 4, 'each segment should round all four corners');
    assert.equal(segmentPath.match(/\bA\b/g)?.length ?? 0, 2, 'each segment should retain its outer and inner arcs');
    assert.match(segment, /style="transform-box:view-box;transform-origin:50px 50px"/, 'each segment should scale from the wheel center');

    featureIds.push(segment.match(/data-wheel-feature="([^"]+)"/)?.[1]);
    pathData.push(segmentPath);
  }

  assert.equal(new Set(featureIds).size, 7, 'each segment should identify a different wheel feature');
  assert.equal(new Set(pathData).size, 7, 'each segment should have distinct rounded geometry');
  assert.ok(pathData.every(Boolean), 'each segment should render SVG path data');
  assert.deepEqual(
    pathData.map((pathValue) => createHash('sha256').update(pathValue).digest('hex')),
    approvedWheelPathHashes,
    'wheel segments should retain the approved rounded geometry and order',
  );
});

test('desktop feature wheel keeps a white surface between rounded segments', () => {
  const wheelSurface = homepage.match(
    /<div class="relative mx-auto aspect-square[^>]*>/,
  )?.[0];

  assert.ok(wheelSurface, 'the desktop wheel surface should render');
  assert.match(wheelSurface, /bg-white/, 'the gaps between SVG segments should remain white');
  assert.doesNotMatch(wheelSurface, /aria-hidden="true"/, 'clickable wheel links must remain accessible');
  assert.doesNotMatch(wheelSurface, /conic-gradient/, 'the rounded wheel should not fall back to sharp gradient wedges');
});

test('desktop feature wheel keeps the approved Tabler icon mapping and order', () => {
  const icons = [...homepage.matchAll(/<span(?=[^>]*data-wheel-position="[^"]+")[^>]*>/g)].map(
    ([tag]) => tag,
  );

  assert.equal(icons.length, 7, 'the desktop wheel should render one positioned icon per feature');

  const assignments = icons.map((tag) => [
    tag.match(/data-wheel-feature="([^"]+)"/)?.[1],
    tag.match(/data-wheel-position="([^"]+)"/)?.[1],
    tag.match(/data-wheel-icon="([^"]+)"/)?.[1],
  ].join('|'));

  assert.deepEqual(
    assignments,
    [
      'Expense tracking|top-right|receipt-dollar',
      'Document storage|right|files',
      'Reports and exports|bottom-right|chart-histogram',
      'Portfolio dashboard|bottom|layout-dashboard',
      'Maintenance tracking|bottom-left|tool',
      'Tenant and lease records|left|users-group',
      'Rent tracking|top-left|calendar-dollar',
    ],
    'wheel features should retain their approved Tabler icons and positions',
  );
});
test('desktop wheel coordinates active styling across each segment, icon, and callout', () => {
  const segments = [...homepage.matchAll(/<path(?=[^>]*data-wheel-segment="true")[^>]*>/g)].map(
    ([tag]) => tag,
  );
  const icons = [...homepage.matchAll(/<span(?=[^>]*data-wheel-position="[^"]+")[\s\S]*?<\/span>/g)].map(
    ([tag]) => tag,
  );
  const callouts = [...homepage.matchAll(/<(?:li|div)(?=[^>]*data-wheel-callout="[^"]+")[^>]*>/g)].map(
    ([tag]) => tag,
  );

  assert.equal(segments.length, 7, 'every wheel segment should participate in the shared active state');
  assert.equal(icons.length, 7, 'every wheel icon should participate in the shared active state');
  assert.equal(callouts.length, 7, 'every desktop callout should participate in the shared active state');

  const segmentIds = segments.map((tag) => tag.match(/data-wheel-feature-id="([^"]+)"/)?.[1]);
  const iconIds = icons.map((tag) => tag.match(/data-wheel-icon="([^"]+)"/)?.[1]);
  const calloutIds = callouts.map((tag) => tag.match(/data-wheel-callout="([^"]+)"/)?.[1]);

  assert.deepEqual([...segmentIds].sort(), [...iconIds].sort(), 'segments should activate their matching icons');
  assert.deepEqual([...segmentIds].sort(), [...calloutIds].sort(), 'segments should activate their matching callouts');

  for (const segment of segments) {
    assert.match(segment, /data-active="false"/, 'segments should expose their initial inactive state');
    assert.match(segment, /data-\[active=true\]:scale-\[1\.025\]/, 'active segments should expand');
    assert.match(segment, /data-\[active=true\]:fill-\[#15803D\]/, 'active segments should turn green');
  }

  for (const icon of icons) {
    assert.match(icon, /data-active="false"/, 'icons should expose their initial inactive state');
    assert.match(icon, /group\/wheel-icon/, 'each icon should inherit its segment active state');
    assert.match(icon, /group-data-\[active=true\]\/wheel-icon:scale-\[1\.15\]/, 'active icons should grow smoothly');
    assert.match(icon, /transition-transform/, 'icon growth should transition smoothly');
    assert.match(icon, /motion-reduce:transform-none/, 'icon growth should respect reduced motion');
  }

  for (const callout of callouts) {
    assert.match(callout, /data-active="false"/, 'callouts should expose their initial inactive state');
    assert.match(callout, /transition-colors/, 'callout highlighting should fade smoothly');
    assert.match(callout, /data-\[active=true\]:bg-\[#DCFCE7\]\/60/, 'active callouts should use the pale green highlight');
  }
});
