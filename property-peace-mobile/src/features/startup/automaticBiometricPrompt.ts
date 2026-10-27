export const BIOMETRIC_IDLE_THRESHOLD_MS = 10 * 60 * 1000;

// Called only for a freshly restored session; same-process foreground returns do not lock.
export const shouldLockRestoredSession = (lastActiveAt: number | null, now: number): boolean => {
  if (lastActiveAt === null || !Number.isFinite(lastActiveAt) || lastActiveAt > now) return true;
  return now - lastActiveAt >= BIOMETRIC_IDLE_THRESHOLD_MS;
};

export type AutomaticBiometricPromptResult =
  | 'unlocked'
  | 'already-attempted'
  | 'unavailable'
  | 'failed'
  | 'manual'
  | 'waiting-for-active';

type AttemptOptions = {
  appState?: string;
  autoPrompt?: boolean;
  available: boolean;
  authenticate: () => Promise<boolean>;
  onAttemptStarted?: () => void;
};

export const createAutomaticBiometricPrompt = () => {
  let attempted = false;

  return {
    attempt: async ({
      appState = 'active',
      autoPrompt = true,
      available,
      authenticate,
      onAttemptStarted,
    }: AttemptOptions): Promise<AutomaticBiometricPromptResult> => {
      if (!autoPrompt) {
        return 'manual';
      }

      if (appState !== 'active') {
        return 'waiting-for-active';
      }

      if (!available) {
        return 'unavailable';
      }

      if (attempted) {
        return 'already-attempted';
      }

      attempted = true;
      onAttemptStarted?.();
      const authenticated = await authenticate();
      return authenticated ? 'unlocked' : 'failed';
    },
  };
};
export type RestoredSessionLock = {
  autoPrompt: boolean;
  sessionUnlocked: boolean;
  biometricEnabled: boolean | null;
};

export const resolveRestoredSessionLock = async (
  readBiometricEnabled: () => Promise<boolean>,
  readLastActiveAt: () => Promise<number | null>,
  now: number,
): Promise<RestoredSessionLock> => {
  try {
    const biometricEnabled = await readBiometricEnabled();
    if (!biometricEnabled) return { autoPrompt: false, sessionUnlocked: true, biometricEnabled: false };
    const lastActiveAt = await readLastActiveAt();
    const shouldLock = shouldLockRestoredSession(lastActiveAt, now);
    return { autoPrompt: shouldLock, sessionUnlocked: !shouldLock, biometricEnabled: true };
  } catch {
    return { autoPrompt: false, sessionUnlocked: false, biometricEnabled: null };
  }
};
