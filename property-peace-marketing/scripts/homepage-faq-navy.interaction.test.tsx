import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import globalJsdom from 'global-jsdom';

let cleanupDom: ReturnType<typeof globalJsdom>;
let cleanup: typeof import('@testing-library/react').cleanup;
let fireEvent: typeof import('@testing-library/react').fireEvent;
let render: typeof import('@testing-library/react').render;
let FAQ: typeof import('../components/Sections/FAQ').default;

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
  ({ default: FAQ } = await import('../components/Sections/FAQ'));
});

after(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
  cleanupDom();
});

test('expanded FAQ answers use the shared dark navy', () => {
  const { container, getByRole } = render(<FAQ />);
  const fitQuestion = getByRole('button', {
    name: /Is Property Peace a good fit for hosts with 1–3 properties\?/,
  });

  const answerId = fitQuestion.getAttribute('aria-controls');
  assert.ok(answerId, 'the FAQ question should identify its answer panel');

  fireEvent.click(fitQuestion);

  const answer = container.querySelector<HTMLElement>(`#${answerId} p`);
  assert.ok(answer, 'the FAQ answer should render after its question is opened');
  assert.ok(
    answer.classList.contains('text-primary-deep'),
    'expanded FAQ answer text should use the shared dark navy',
  );

  cleanup();
});
