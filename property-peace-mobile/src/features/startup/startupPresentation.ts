export type StartupPresentation = 'animated-intro' | 'waiting' | 'ready';

export interface StartupPresentationState {
  introComplete: boolean;
  authLoading: boolean;
  checkingLock: boolean;
}

export const resolveStartupPresentation = ({
  introComplete,
  authLoading,
  checkingLock,
}: StartupPresentationState): StartupPresentation => (
  !introComplete
    ? 'animated-intro'
    : authLoading || checkingLock ? 'waiting' : 'ready'
);

export const resolveReducedMotionPreference = (
  readPreference: () => Promise<boolean>,
  fallbackDelayMs = 400,
  signal?: AbortSignal,
): Promise<boolean> => new Promise((resolve) => {
  let settled = false;
  let timeout: ReturnType<typeof setTimeout>;

  const settle = (useReducedMotion: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    resolve(useReducedMotion);
  };
  const onAbort = () => settle(true);

  timeout = setTimeout(() => settle(true), fallbackDelayMs);
  if (signal?.aborted) {
    onAbort();
    return;
  }

  signal?.addEventListener('abort', onAbort, { once: true });
  Promise.resolve()
    .then(readPreference)
    .then(settle, () => settle(true));
});
export interface StartupVisualState {
  dawnProgress: number;
  logoLift: number;
  logoOpacity: number;
  logoScale: number;
  sceneOpacity: number;
}

export const resolveStartupVisualState = (playIntro: boolean): StartupVisualState => ({
  dawnProgress: playIntro ? 0 : 1,
  logoLift: playIntro ? 14 : 0,
  logoOpacity: playIntro ? 0 : 1,
  logoScale: playIntro ? 0.95 : 1,
  sceneOpacity: 1,
});
