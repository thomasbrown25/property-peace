import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));

const app = json('app.json').expo;
const pkg = json('package.json');
const config = read('src/config/index.ts');
const login = read('src/screens/auth/LoginScreen.tsx');
const register = read('src/screens/auth/RegisterScreen.tsx');
const settings = read('src/screens/landlord/SettingsScreen.tsx');
const storage = read('src/services/storageService.ts');
const userApi = read('src/api/userAPI.ts');
const authService = read('src/services/authService.ts');
const apiClient = read('src/services/apiClient.ts');
const maintenanceApi = read('src/api/maintenanceAPI.ts');
const tenantMaintenanceDetail = read('src/screens/tenant/TenantMaintenanceDetailScreen.tsx');
const eas = json('eas.json');

assert.equal(app.ios.supportsTablet, false, 'first release must be intentionally iPhone-only');
assert.match(app.ios.buildNumber, /^\d+$/, 'iOS build number is required');
assert.equal(app.ios.config.usesNonExemptEncryption, false, 'export compliance must be declared');
assert.equal(app.ios.usesAppleSignIn, true, 'Sign in with Apple entitlement is required');
assert.ok(app.plugins.includes('expo-apple-authentication'), 'Sign in with Apple plugin is required');
assert.ok(app.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-local-authentication'), 'Face ID plugin is required');
assert.ok(app.plugins.includes('expo-secure-store'), 'SecureStore plugin is required');
assert.match(app.ios.infoPlist.NSCameraUsageDescription, /maintenance.*inspection/i, 'camera usage must cover maintenance and inspection evidence');
assert.match(app.ios.infoPlist.NSPhotoLibraryUsageDescription, /maintenance.*inspection/i, 'photo library usage must cover maintenance and inspection evidence');
assert.equal(app.ios.privacyManifests.NSPrivacyTracking, false, 'the app must explicitly declare that it does not track users');
assert.deepEqual(app.ios.privacyManifests.NSPrivacyCollectedDataTypes, [], 'native privacy manifest must not invent SDK-level data collection');
const accessedPrivacyApis = new Map(
  app.ios.privacyManifests.NSPrivacyAccessedAPITypes.map((entry) => [entry.NSPrivacyAccessedAPIType, entry.NSPrivacyAccessedAPITypeReasons]),
);
assert.ok(accessedPrivacyApis.get('NSPrivacyAccessedAPICategoryFileTimestamp')?.length, 'file timestamp access reasons are required');
assert.ok(accessedPrivacyApis.get('NSPrivacyAccessedAPICategoryDiskSpace')?.length, 'disk space access reasons are required');
assert.ok(accessedPrivacyApis.get('NSPrivacyAccessedAPICategoryUserDefaults')?.length, 'user defaults access reasons are required');
assert.ok(app.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker'), 'ImagePicker permission plugin is required');
assert.ok(pkg.dependencies['expo-apple-authentication'], 'Sign in with Apple dependency is required');
assert.ok(pkg.dependencies['expo-local-authentication'], 'local authentication dependency is required');
assert.ok(pkg.dependencies['expo-secure-store'], 'secure storage dependency is required');
assert.ok(pkg.dependencies['expo-image-picker'], 'maintenance media picker dependency is required');
assert.ok(pkg.dependencies['expo-file-system'], 'private maintenance evidence must download to a local file');
assert.ok(pkg.dependencies['expo-sharing'], 'private maintenance evidence must use the native share sheet');
assert.ok(eas.build?.production?.autoIncrement, 'production EAS profile must auto-increment');
assert.match(config, /https:\/\/api\.propertypeace\.io\//, 'production API must use the live Property Peace host');
assert.doesNotMatch(config, /api\.brownstonehub\.com/, 'dead legacy API hosts must not ship');
assert.match(storage, /expo-secure-store/, 'JWT must be stored in iOS Keychain-backed storage');
assert.match(userApi, /delete\('\/api\/user'\)/, 'account deletion must call DELETE /api/user');
assert.match(login, /AppleSignInButton/, 'iOS login must offer Sign in with Apple');
assert.match(register, /AppleSignInButton/, 'iOS registration must offer Sign in with Apple');
assert.match(authService, /\/api\/user\/apple-login/, 'mobile auth service must use the Apple login endpoint');
assert.match(login, /Platform\.OS !== ['"]ios['"]/, 'Google login must remain hidden on iOS');
assert.match(register, /Platform\.OS !== ['"]ios['"]/, 'Google registration must remain hidden on iOS');
for (const source of [login, register, settings]) {
  assert.match(source, /https:\/\/www\.propertypeace\.io\/privacy/, 'privacy link must be reachable in app');
  assert.match(source, /https:\/\/www\.propertypeace\.io\/terms/, 'terms link must be reachable in app');
}
assert.match(settings, /Delete account/i, 'Settings must expose in-app account deletion');
assert.match(settings, /Face ID/, 'Settings must expose Face ID unlock');
assert.doesNotMatch(authService, /requestBody:\s*JSON\.stringify/, 'auth tokens must never be logged');
assert.doesNotMatch(apiClient, /requestData:|data:\s*axiosConfig\.data|data:\s*response\.data/, 'API logs must not expose credentials or response data');
assert.match(maintenanceApi, /downloadAsync/, 'evidence must stream to a local file instead of a JS base64 value');
assert.match(maintenanceApi, /Authorization/, 'local evidence downloads must remain authenticated');
assert.doesNotMatch(maintenanceApi, /arraybuffer|base64|data:/, 'large private media must not be materialized in JS memory');
assert.match(tenantMaintenanceDetail, /Sharing\.shareAsync/, 'evidence must open through the native iOS share sheet');

console.log('iOS compliance source checks passed');
