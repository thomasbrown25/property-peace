import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardEntranceDelay, dashboardRowHoverSx, dashboardSlideDownSx } from './dashboardEntrance.mjs';

test('dashboard cards deal down using the lease timeline timing and easing', () => {
  assert.deepEqual(dashboardSlideDownSx['@keyframes dashboardSlideDown'], {
    from: { opacity: 0, transform: 'translateY(-28px) scale(0.98)' },
    to: { opacity: 1, transform: 'translateY(0) scale(1)' }
  });
  assert.equal(dashboardSlideDownSx.animation, 'dashboardSlideDown 420ms cubic-bezier(0.22, 1, 0.36, 1) both');
  assert.equal(dashboardSlideDownSx.animationDelay, 'var(--dashboard-deal-delay, 0ms)');
});

test('property rows stagger in display order with a bounded delay', () => {
  assert.deepEqual([0, 1, 2, 3].map(dashboardEntranceDelay), ['0ms', '75ms', '150ms', '225ms']);
  assert.equal(dashboardEntranceDelay(100), '450ms');
});

test('reduced motion disables the entrance without hiding content', () => {
  assert.deepEqual(dashboardSlideDownSx['@media (prefers-reduced-motion: reduce)'], { animation: 'none' });
  assert.equal(dashboardSlideDownSx.opacity, undefined);
  assert.equal(dashboardSlideDownSx.transform, undefined);
});

test('both the loaded task card and stable-keyed property rows use the entrance', () => {
  const source = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  assert.equal((source.match(/\.\.\.dashboardSlideDownSx/g) || []).length, 2);
  assert.match(source, /key=\{property.id\} style=\{\{ '--dashboard-deal-delay': dashboardEntranceDelay\(index\) \}\}/);
  assert.match(source, /key=\{property\.id\}[^\n]*sx=\{\{ \.\.\.dashboardSlideDownSx, bgcolor: 'background.paper'/);
  assert.doesNotMatch(source, /key=\{(?:index|Math\.random|Date\.now)/);
});

test('landlord sidebar property links use the same staggered entrance as dashboard rows', () => {
  const source = readFileSync(new URL('../../../layout/Dashboard/LandlordSidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /properties\.map\(\(property, index\) =>/);

  const propertyLink = source.match(/<ListItemButton key=\{property\.id\}[\s\S]*?<Box component="img"/)?.[0];
  assert.ok(propertyLink, 'Expected a sidebar link keyed by property ID');
  assert.match(propertyLink, /'--dashboard-deal-delay': dashboardEntranceDelay\(index\)/);
  assert.match(propertyLink, /\.\.\.dashboardSlideDownSx/);
});

test('recent activity rows use the same staggered entrance as property rows', () => {
  const source = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  const row = source.match(/<Box\s+component="li"\s+key=\{getActivityKey\(item, index\)\}[\s\S]*?<Box\s+aria-hidden/)?.[0];
  assert.ok(row, 'Expected a list item keyed by activity');
  assert.match(row, /'--dashboard-deal-delay': dashboardEntranceDelay\(index\)/);
  assert.match(row, /\.\.\.dashboardSlideDownSx/);
  assert.match(row, /bgcolor: 'background.paper'/);
  assert.match(row, /\bborder: '1px solid',\s+borderBottomWidth: 0,/);
  assert.match(row, /'&:last-child': \{ borderBottomWidth: 1,/);
  assert.match(row, /'&:first-child': \{ borderTopLeftRadius: 2, borderTopRightRadius: 2 \}/);
  assert.match(row, /borderBottomLeftRadius: 2, borderBottomRightRadius: 2/);
});

test('recent activity shows a compact title and right-aligned time without an actor or icon fill', () => {
  const source = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /\bpy: 1,/);
  assert.match(source, /textAlign: 'right'[^\n]*>\s*\{formatRelativeTime\(item.createdAt, now\)\}/);
  assert.doesNotMatch(source, /performedByName/);
  const icon = source.match(/<Box\s+aria-hidden="true"[\s\S]*?<AppIcon name="activity"/)?.[0];
  assert.ok(icon);
  assert.doesNotMatch(icon, /\b(?:bgcolor|background\w*):/);
});

test('property and activity rows link their full content and use the shared hover lift', () => {
  const home = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  const sidebar = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  assert.match(home, /<Box component=\{RouterLink\} to=\{property\.href\} key=\{property\.id\}[^\n]*\.\.\.dashboardRowHoverSx/);
  assert.match(sidebar, /<Link\s+component=\{RouterLink\}\s+to=\{getActivityDestination\(item\)[\s\S]*?\.\.\.dashboardRowHoverSx[\s\S]*?<AppIcon name="activity"[\s\S]*?formatRelativeTime\(item.createdAt, now\)[\s\S]*?<\/Link>/);
});

test('hover lifts the content without moving or shadowing the row edges', () => {
  const motion = dashboardRowHoverSx['@media (hover: hover) and (prefers-reduced-motion: no-preference)'];
  assert.equal(motion['&:hover > *']?.translate, '0 -2px');
  assert.equal(motion['&:hover']?.translate, undefined);
  assert.equal(motion['&:hover']?.boxShadow, undefined);
});

test('the animated property and activity lists have transparent containers', () => {
  const home = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  const sidebar = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  assert.match(home, /style=\{\{ \.\.\.tableStyles\.container, backgroundColor: 'transparent' \}\}/);
  assert.match(sidebar, /component="ul" sx=\{\{ m: 0, p: 0, listStyle: 'none' \}\}/);
});

test('the animated task card has no background fill', () => {
  const source = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  const card = source.match(/\{next \? \([\s\S]*?<Box sx=\{\{(.*?)\}\}>/)?.[1];
  assert.ok(card, 'Expected a card for a scheduled task');
  assert.doesNotMatch(card, /\b(?:bgcolor|background\w*):/);
});
