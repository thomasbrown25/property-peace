import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const config = read('src/config/index.ts');
const hook = read('src/hooks/useGoogleSignIn.ts');
const login = read('src/screens/auth/LoginScreen.tsx');
const register = read('src/screens/auth/RegisterScreen.tsx');
const clientId = '422382677454-1ttb399tb2vucfo109s3ijvi8bvsahgt.apps.googleusercontent.com';
const scheme = `com.googleusercontent.apps.${clientId.split('.')[0]}`;

test('native iOS client and reversed URL scheme coexist with original scheme and EAS settings', () => {
  assert.equal(app.ios.bundleIdentifier, 'com.propertypeace.mobile');
  assert.deepEqual(app.scheme, ['propertypeace', scheme]);
  assert.ok(app.extra.eas.projectId);
  assert.ok(app.android.permissions.includes('android.permission.RECORD_AUDIO'));
  assert.match(config, new RegExp(`GOOGLE_IOS_CLIENT_ID: '${clientId.replaceAll('.', '\\.')}'`));
  assert.doesNotMatch(config, /process\.env\.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/);
  const configuredId = config.match(/GOOGLE_IOS_CLIENT_ID: '([^']+)'/)?.[1];
  assert.equal(`com.googleusercontent.apps.${configuredId?.replace(/\.apps\.googleusercontent\.com$/, '')}`, app.scheme[1]);
});

test('code flow uses native iOS redirect and PKCE verifier at token exchange', () => {
  assert.match(hook, /Platform\.OS === 'ios' \? config\.GOOGLE_IOS_CLIENT_ID : config\.GOOGLE_CLIENT_ID/);
  assert.match(hook, /native: Platform\.OS === 'ios' \? `\$\{iosScheme\}:\/oauth2redirect`/);
  assert.match(hook, /responseType: AuthSession\.ResponseType\.Code/);
  assert.match(hook, /usePKCE: true/);
  assert.match(hook, /code_verifier: request\.codeVerifier/);
  assert.match(hook, /redirectUri,\s*extraParams:/);
  assert.match(hook, /accessToken: includeAccessToken \? accessToken \|\| null : idToken \? null : accessToken \|\| null/);
  assert.match(hook, /Platform\.OS === 'ios' && !includeAccessToken/);
});

test('Google remains available on both screens while login retains ID-token and MFA behavior', () => {
  for (const screen of [login, register]) {
    assert.match(screen, /Platform\.OS === ['"]ios['"] \? config\.GOOGLE_IOS_CLIENT_ID : config\.GOOGLE_CLIENT_ID/);
    assert.match(screen, /Platform\.OS === ['"]ios['"] && <AppleSignInButton/);
    assert.match(screen, /\{showGoogleSignIn && \(/);
  }
  assert.match(login, /accessToken: result\.idToken \? undefined : result\.accessToken \|\| undefined/);
  assert.match(login, /authResult\.kind === ['"]challenge['"]/);
  assert.match(login, /navigation\.navigate\(['"]MfaVerification['"]/);
});

test('Google buttons remain locked during backend request and unlock on cancellation or failure', () => {
  for (const [screen, handler] of [[login, 'handleGoogleSignIn'], [register, 'handleGoogleSignUp']]) {
    const body = screen.split(`const ${handler} = async () => {`)[1]?.split('\n  };')[0];
    assert.ok(body, `${handler} handler exists`);
    assert.match(body, /if \(googleInFlight\.current\) return;/);
    assert.match(body, /googleInFlight\.current = true;\s*setGoogleSubmitting\(true\);\s*try/);
    assert.match(body, /await googleSignIn\((?:true)?\)/);
    assert.match(body, /error !== ['"]Authentication cancelled['"]/);
    assert.match(body, screen === login ? /await dispatch\([\s\S]*?googleLogin\([\s\S]*?\)\.unwrap\(\)/ : /await authService\.googleSignupProfile\(result\.accessToken\)/);
    assert.match(body, /finally \{\s*googleInFlight\.current = false;\s*setGoogleSubmitting\(false\);/);
    assert.match(screen, /disabled=\{loading \|\| googleLoading \|\| googleSubmitting\}/);
  }
});

test('Google signup verifies profile then visits required details without email code or login dispatch', () => {
  const body = register.split('const handleGoogleSignUp = async () => {')[1]?.split('\n  };')[0];
  assert.match(body, /googleSignIn\(true\)/);
  assert.match(body, /googleSignupProfile\(result\.accessToken\)/);
  assert.match(body, /setStep\("details"\)/);
  assert.doesNotMatch(body, /googleLogin|sendRegistrationCode|setStep\("verify"\)/);
  assert.match(register, /googleProfile\s*\? prepareGoogleRegistration\(fields, googleProfile\)/);
  assert.match(register, /await dispatch\(register\(preparedRegistration\.data\)\)\.unwrap\(\)/);
  assert.match(register, /googleProfile \? "Use a different sign-up method" : "Back to verification"/);
});
