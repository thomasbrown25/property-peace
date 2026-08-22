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
};

export const resolveRestoredSessionLock = async (
  readBiometricEnabled: () => Promise<boolean>,
): Promise<RestoredSessionLock> => {
  try {
    const biometricEnabled = await readBiometricEnabled();
    return {
      autoPrompt: biometricEnabled,
      sessionUnlocked: !biometricEnabled,
    };
  } catch {
    return {
      autoPrompt: false,
      sessionUnlocked: false,
    };
  }
};
