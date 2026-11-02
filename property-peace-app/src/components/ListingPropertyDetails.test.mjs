import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = () => readFileSync(new URL('./ListingPropertyDetails.jsx', import.meta.url), 'utf8');

test('linked property and correct unit are loaded rather than stale shared selection', () => {
  const code = source();
  assert.match(code, /dispatch\(getPropertyById\(propertyId\)\)/);
  assert.match(code, /String\(selectedProperty\.id\) === String\(propertyId\)/);
  assert.match(code, /String\(candidate\.id\) === String\(listing\.unitId\)/);
  assert.match(code, /isDetachedSingleUnitType\(property\?\.propertyType\)/);
});

test('pencil opens shared-record warning and inline form keeps address read-only', () => {
  const code = source();
  assert.match(code, /aria-label="Edit property details"/);
  assert.match(code, /Changes to the property or unit will appear everywhere/);
  assert.match(code, /field\('Address',[^\n]+false\)/);
  assert.match(code, /field\('Property type', typeLabel\(property\.propertyType\), true, 'propertyType', \{ select: true/);
  assert.match(code, /replace\('Single Family Home', 'Single Family'\)/);
  for (const field of ['name', 'yearBuilt', 'unitName', 'bedrooms', 'baths', 'squareFeet']) assert.match(code, new RegExp(`'${field}'`));
  assert.doesNotMatch(code, /openPropertyEditDrawer|openUnitEditDrawer|Edit property<\/Button>/);
});

test('amenity type and search controls precede selected chips while editing', () => {
  const section = source().split('Amenities & Features</Typography>')[1].split('</Box>')[0];
  assert.ok(section.indexOf('label="Type"') < section.indexOf('<Chip key='));
  assert.ok(section.indexOf('label="Search amenities and features"') < section.indexOf('<Chip key='));
});

test('amenities are searched, removable, custom-created, and saved by group', () => {
  const code = source();
  assert.match(code, /onDelete=\{editing/);
  assert.match(code, /<Autocomplete freeSolo options=\{available\}/);
  assert.match(code, /Add “\{query\}”/);
  assert.match(code, /amenityApi\.createCustomAmenity/);
  assert.match(code, /featureApi\.createCustomFeature/);
  assert.match(code, /defaultAmenityIds: ids\('propertyAmenities', false\)/);
  assert.match(code, /customFeatureIds: ids\('propertyFeatures', true\)/);
  assert.match(code, /listingApi\.updateListing/);
  assert.match(code, /dispatch\(setSelectedListing/);
  assert.match(code, /await dispatch\(addOrUpdateProperty/);
  assert.match(code, /await dispatch\(addOrUpdateUnit/);
});
