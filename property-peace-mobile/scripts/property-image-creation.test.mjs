import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('address selection automatically applies the verified Google image to property creation', () => {
  const screen = read('../src/screens/landlord/AddPropertyScreen.tsx');
  const api = read('../src/api/propertyAPI.ts');
  assert.match(screen, /onPlaceSelected=\{selectAddress\}/);
  assert.match(screen, /googlePlacesAPI\.streetView\(address\)/);
  assert.match(screen, /writeAsStringAsync\(uri, base64, \{ encoding: FileSystem\.EncodingType\.Base64 \}\)/);
  assert.match(screen, /PropertyAPI\.createProperty\([^\n]+, imageUri, imageMimeType\)/);
  assert.match(screen, /onPress=\{pickImage\}/);
  assert.match(screen, /Replace property image/);
  assert.match(api, /formData\.append\('files', \{ uri: imageUri/);
  assert.match(screen, /navigation\.replace\('PropertyDetail', \{ propertyId: idForNavigation \}\)/);
  assert.match(screen, /Alert\.alert\('Property created successfully!'/);
});

test('image fallback and stale address results do not block or misattribute property creation', () => {
  const screen = read('../src/screens/landlord/AddPropertyScreen.tsx');
  const google = read('../src/api/googlePlacesAPI.ts');
  assert.match(google, /catch \{\s*return null;/);
  assert.match(screen, /request !== imageRequest\.current/);
  assert.match(screen, /imageRequest\.current\+\+;\s*setImageLoading\(false\);\s*setImageUri\(null\)/);
  assert.match(screen, /if \(saving \|\| imageLoading/);
});
