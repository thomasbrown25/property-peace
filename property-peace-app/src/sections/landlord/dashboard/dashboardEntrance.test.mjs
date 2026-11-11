import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardEntranceDelay, dashboardSlideDownSx } from './dashboardEntrance.mjs';

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
  assert.doesNotMatch(source, /key=\{(?:index|Math\.random|Date\.now)/);
});
