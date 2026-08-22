import assert from 'node:assert/strict';
import test from 'node:test';

let createAutomaticBiometricPrompt;
let resolveRestoredSessionLock;
let loadError;

try {
  ({ createAutomaticBiometricPrompt, resolveRestoredSessionLock } = await import(
    '../src/features/startup/automaticBiometricPrompt.ts'
  ));
} catch (error) {
  loadError = error;
}

test('automatically authenticates an available remembered session at most once', async () => {
  assert.equal(loadError, undefined);

  const prompt = createAutomaticBiometricPrompt();
  let authenticationCalls = 0;
  let attemptStartedCalls = 0;
  const authenticate = async () => {
    authenticationCalls += 1;
    return true;
  };

  const onAttemptStarted = () => {
    attemptStartedCalls += 1;
  };
  const firstResult = await prompt.attempt({ available: true, authenticate, onAttemptStarted });
  const secondResult = await prompt.attempt({ available: true, authenticate, onAttemptStarted });

  assert.equal(firstResult, 'unlocked');
  assert.equal(secondResult, 'already-attempted');
  assert.equal(authenticationCalls, 1);
  assert.equal(attemptStartedCalls, 1);
});

test('does not authenticate when device biometrics are unavailable', async () => {
  assert.equal(loadError, undefined);

  const prompt = createAutomaticBiometricPrompt();
  let authenticationCalls = 0;

  const result = await prompt.attempt({
    available: false,
    authenticate: async () => {
      authenticationCalls += 1;
      return true;
    },
  });

  assert.equal(result, 'unavailable');
  assert.equal(authenticationCalls, 0);
});
test('keeps a remembered session locked when automatic authentication fails', async () => {
  assert.equal(loadError, undefined);

  const prompt = createAutomaticBiometricPrompt();
  const result = await prompt.attempt({
    available: true,
    authenticate: async () => false,
  });

  assert.equal(result, 'failed');
});
test('does not automatically prompt for a fresh login or background relock', async () => {
  assert.equal(loadError, undefined);

  const prompt = createAutomaticBiometricPrompt();
  let authenticationCalls = 0;
  const result = await prompt.attempt({
    appState: 'active',
    autoPrompt: false,
    available: true,
    authenticate: async () => {
      authenticationCalls += 1;
      return true;
    },
  });

  assert.equal(result, 'manual');
  assert.equal(authenticationCalls, 0);
});

test('waits for the app to become active before automatically prompting once', async () => {
  assert.equal(loadError, undefined);

  const prompt = createAutomaticBiometricPrompt();
  let authenticationCalls = 0;
  let attemptStartedCalls = 0;
  const authenticate = async () => {
    authenticationCalls += 1;
    return true;
  };

  const onAttemptStarted = () => {
    attemptStartedCalls += 1;
  };

  const backgroundResult = await prompt.attempt({
    appState: 'background',
    autoPrompt: true,
    available: true,
    authenticate,
    onAttemptStarted,
  });
  const activeResult = await prompt.attempt({
    appState: 'active',
    autoPrompt: true,
    available: true,
    authenticate,
    onAttemptStarted,
  });

  assert.equal(backgroundResult, 'waiting-for-active');
  assert.equal(activeResult, 'unlocked');
  assert.equal(authenticationCalls, 1);
  assert.equal(attemptStartedCalls, 1);
});
test('restored-session biometric preference failures fail closed', async () => {
  assert.equal(loadError, undefined);

  assert.deepEqual(
    await resolveRestoredSessionLock(async () => true),
    { autoPrompt: true, sessionUnlocked: false },
  );
  assert.deepEqual(
    await resolveRestoredSessionLock(async () => false),
    { autoPrompt: false, sessionUnlocked: true },
  );
  assert.deepEqual(
    await resolveRestoredSessionLock(async () => {
      throw new Error('SecureStore unavailable');
    }),
    { autoPrompt: false, sessionUnlocked: false },
  );
});
