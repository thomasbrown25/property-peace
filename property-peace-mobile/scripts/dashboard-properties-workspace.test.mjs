import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const dashboard = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const filterSource = readFileSync(new URL('../src/features/properties/propertiesList.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(filterSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', js)(module, module.exports);
const { filterPropertiesForList } = module.exports;

const section = dashboard.slice(dashboard.indexOf("{activeHomeTab === 'Properties' && <DashboardSection"), dashboard.indexOf('</DashboardSection>', dashboard.indexOf("{activeHomeTab === 'Properties' && <DashboardSection")));

test('Home Properties replaces the redundant heading and View all with working search and add action', () => {
  assert.ok(section.startsWith("{activeHomeTab === 'Properties' && <DashboardSection"));
  assert.doesNotMatch(section, /<Text style={styles\.cardTitle}>Properties<\/Text>|View all properties/);
  assert.match(section, /accessibilityLabel="Search properties"/);
  assert.match(section, /onChangeText=\{setPropertySearch\}/);
  assert.match(section, /accessibilityLabel="Add property"/);
  assert.match(section, /screen: 'AddProperty'/);
  assert.match(section, /filteredAttentionProperties\.map\(\(item\)/);
  assert.match(dashboard, /filterPropertiesForList\(scopedProperties, propertySearch\)/);
  assert.doesNotMatch(dashboard.slice(dashboard.indexOf('const attentionProperties ='), dashboard.indexOf('const collectionPct =')), /\.slice\(0, 5\)/);
});

test('Home Properties rows use the same left image and fallback fields as the mobile Properties list', () => {
  assert.match(section, /property\.mainImageUrl, item\.property\.MainImageUrl/);
  assert.match(section, /property\.images\?\.\[0\]\?\.blobUrl, item\.property\.Images\?\.\[0\]\?\.BlobUrl/);
  assert.match(section, /<Image source=\{\{ uri: firstString\(item\.property\.mainImageUrl,[^\n]*\) \}\} style=\{styles\.propertyThumbnail\}/);
  assert.match(section, /styles\.propertyThumbnailFallback/);
  assert.match(section, /item\.overdueAmount > 0/);
  assert.match(section, /onPress=\{\(\) => navigation\.navigate\('Properties', \{ screen: 'PropertyDetail'/);
});

test('shared property search matches name and address without hiding later properties', () => {
  const properties = [
    { id: 1, name: 'Elm', streetAddress: '1 First St' },
    { id: 2, name: 'Oak', city: 'Boston' },
    { id: 3, Name: 'Maple', StreetAddress: '500 Main St' },
    { id: 4, name: 'Pine', state: 'Texas' },
    { id: 5, name: 'Ash', streetAddress: '5 Market St' },
    { id: 6, name: 'Cedar', streetAddress: '6 Main St' },
  ];
  assert.deepEqual(filterPropertiesForList(properties, '  MAIN  ').map(p => p.id), [3, 6]);
  assert.equal(filterPropertiesForList(properties, '').length, 6);
});
