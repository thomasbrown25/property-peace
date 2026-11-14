export const RELATIVE_TIME_REFRESH_MS = 30000;

export function subscribeToClock(refresh, host = window, page = document) {
  const onVisible = () => {
    if (page.visibilityState === 'visible') refresh();
  };
  const interval = host.setInterval(refresh, RELATIVE_TIME_REFRESH_MS);
  host.addEventListener('focus', refresh);
  page.addEventListener('visibilitychange', onVisible);
  // Also catch time elapsed between the initial render and mounting.
  refresh();

  return () => {
    host.clearInterval(interval);
    host.removeEventListener('focus', refresh);
    page.removeEventListener('visibilitychange', onVisible);
  };
}
