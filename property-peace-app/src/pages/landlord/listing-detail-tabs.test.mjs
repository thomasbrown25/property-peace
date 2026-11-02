import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./listing-detail.jsx', import.meta.url), 'utf8');
test('listing detail puts matching tabs immediately beneath the hero and scopes content', () => {
  assert.match(source, /aria-label="Listing detail views"/);
  assert.match(source, /value="overview" label="Overview"/);
  assert.match(source, /value="property" label="Property Details"/);
  assert.match(source, /value="gallery" label="Gallery"/);
  assert.ok(source.indexOf('Listing detail views') > source.indexOf('</AnimateIn>', source.indexOf('View public page')));
  assert.ok(source.indexOf('Listing detail views') < source.indexOf('<LeasingPipelinePanel resourceType="listing"'));
  assert.match(source, /role="tabpanel" aria-labelledby=\{`\$\{activeTab\}-tab`\}/);
  assert.match(source, /activeTab === 'overview' && <>/);
  assert.match(source, /activeTab === 'property' && <ListingPropertyDetails listing={listing} \/>/);
  assert.match(source, /activeTab === 'gallery' && <ListingGallery listing={listing}/);
});
test('overview omits duplicate controls and description lives in property details', () => {
  const propertyDetails = readFileSync(new URL('../../components/ListingPropertyDetails.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Listing Control Center|Quick Actions|Listing Description/);
  assert.match(propertyDetails, /Listing Description/);
  assert.match(propertyDetails, /listing\.marketingDescription/);
  assert.ok(propertyDetails.indexOf('Listing Description') < propertyDetails.indexOf('Amenities & Features'));
  assert.match(source, /activeTab === 'property' && <ListingPropertyDetails listing=\{listing\} \/>/);
});
test('overview gives estimate eight columns and rental facts four columns', () => {
  assert.match(source, /size=\{\{ xs: 12, md: 8 \}\}[\s\S]*?Market Rent Estimate/);
  assert.match(source, /size=\{\{ xs: 12, md: 4 \}\}[\s\S]*?Listed rent/);
  assert.match(source, /Listed monthly rent[\s\S]*?formatCurrency\(listing.monthlyRent\)[\s\S]*?<RentEstimateCard propertyId=\{listing.propertyId\} unitId=\{listing.unitId \?\? null\}/);
  assert.match(source, /Lease offerings/);
  assert.match(source, /listing\.minLeaseDuration/);
  assert.match(source, /this listing does not report their status/);
  assert.match(source, /onImagesChange=\{\(images\) => dispatch\(setSelectedListing\(\{ \.\.\.listing, images \}\)\)\}/);
  assert.doesNotMatch(source, /onChange=\{\(\) => dispatch\(getListingById/);
  assert.doesNotMatch(source, /allAmenities\.map|galleryImages\.map|<MetricCard/);
});
