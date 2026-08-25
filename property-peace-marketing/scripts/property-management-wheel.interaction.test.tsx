import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import globalJsdom from 'global-jsdom';

let cleanupDom: ReturnType<typeof globalJsdom>;
let cleanup: typeof import('@testing-library/react').cleanup;
let fireEvent: typeof import('@testing-library/react').fireEvent;
let render: typeof import('@testing-library/react').render;
let PropertyManagementWheel: typeof import(
  '../components/Sections/PropertyManagementWheel'
).default;

before(async () => {
  cleanupDom = globalJsdom(undefined, { url: 'http://localhost/' });
  class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];

    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  }
  globalThis.IntersectionObserver = TestIntersectionObserver;
  ({ cleanup, fireEvent, render } = await import('@testing-library/react'));
  ({ default: PropertyManagementWheel } = await import(
    '../components/Sections/PropertyManagementWheel'
  ));
});

after(() => {
  cleanup();
  cleanupDom();
});

test('hovering a wheel segment activates its matching icon and callout together', () => {
  const { container } = render(<PropertyManagementWheel />);
  const featureId = 'chart-histogram';
  const segment = container.querySelector<SVGPathElement>(
    `[data-wheel-feature-id="${featureId}"]`,
  );
  const icon = container.querySelector<HTMLElement>(`[data-wheel-icon="${featureId}"]`);
  const callout = container.querySelector<HTMLElement>(`[data-wheel-callout="${featureId}"]`);

  assert.ok(segment, 'the reports segment should render');
  assert.ok(icon, 'the reports icon should render');
  assert.ok(callout, 'the reports callout should render');
  assert.equal(segment.dataset.active, 'false');
  assert.equal(icon.dataset.active, 'false');
  assert.equal(callout.dataset.active, 'false');

  fireEvent.mouseEnter(segment);

  assert.equal(segment.dataset.active, 'true', 'the hovered segment should become active');
  assert.equal(icon.dataset.active, 'true', 'the matching icon should become active');
  assert.equal(callout.dataset.active, 'true', 'the matching callout should become active');

  fireEvent.mouseLeave(segment);

  assert.equal(segment.dataset.active, 'false', 'the segment should reset after hover');
  assert.equal(icon.dataset.active, 'false', 'the matching icon should reset after hover');
  assert.equal(callout.dataset.active, 'false', 'the matching callout should reset after hover');

  cleanup();
});
test('wheel segments link to their approved feature pages', () => {
  const { container } = render(<PropertyManagementWheel />);
  const links = [...container.querySelectorAll<HTMLAnchorElement>('[data-wheel-link]')];
  const destinations = links.map((link) => [
    link.dataset.wheelLink,
    link.getAttribute('href'),
  ].join('|'));

  assert.deepEqual(
    destinations,
    [
      'receipt-dollar|/rent/expense-tracking',
      'files|/features/document-management',
      'chart-histogram|/features/financial-reports',
      'layout-dashboard|/features/all-in-one-dashboard',
      'tool|/features/maintenance-tracking',
      'users-group|/features/lease-management',
      'calendar-dollar|/features/rent-collection',
    ],
    'each wheel segment should expose the approved feature destination',
  );

  cleanup();
});

test('focusing a wheel link activates its matching segment, icon, and callout', () => {
  const { container } = render(<PropertyManagementWheel />);
  const featureId = 'chart-histogram';
  const link = container.querySelector<HTMLAnchorElement>(`[data-wheel-link="${featureId}"]`);
  const segment = container.querySelector<SVGPathElement>(
    `[data-wheel-feature-id="${featureId}"]`,
  );
  const icon = container.querySelector<HTMLElement>(`[data-wheel-icon="${featureId}"]`);
  const callout = container.querySelector<HTMLElement>(`[data-wheel-callout="${featureId}"]`);

  assert.ok(link, 'the reports wheel link should render');
  assert.ok(segment, 'the reports segment should render');
  assert.ok(icon, 'the reports icon should render');
  assert.ok(callout, 'the reports callout should render');

  fireEvent.focus(link);

  assert.equal(segment.dataset.active, 'true', 'the focused segment should become active');
  assert.equal(icon.dataset.active, 'true', 'the focused icon should become active');
  assert.equal(callout.dataset.active, 'true', 'the focused callout should become active');

  fireEvent.blur(link);

  assert.equal(segment.dataset.active, 'false', 'the segment should reset after focus');
  assert.equal(icon.dataset.active, 'false', 'the icon should reset after focus');
  assert.equal(callout.dataset.active, 'false', 'the callout should reset after focus');

  cleanup();
});
