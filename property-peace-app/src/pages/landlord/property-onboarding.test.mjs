import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('standalone add property owns its chrome instead of inheriting dashboard navigation', () => {
  const layout = fs.readFileSync(new URL('../../layout/Dashboard/index.jsx', import.meta.url), 'utf8');
  const workflow = read('./property-add-workflow.jsx');
  const onboarding = read('./listing-create.jsx');
  assert.match(layout, /pathname === '\/landlord\/properties\/add' \|\| pathname === '\/landlord\/property-add-workflow'/);
  assert.match(layout, /!isAddPropertyPage && <Header \/>/);
  assert.match(layout, /!isAddPropertyPage && <Toolbar/);
  assert.match(layout, /!isAddPropertyPage && <Box sx=\{\{[\s\S]*?<Footer \/>/);
  assert.match(workflow, /component="header"[\s\S]*?listing-onboarding-logo\.png[\s\S]*?Save &amp; exit/);
  assert.match(onboarding, /component="header"[\s\S]*?listing-onboarding-logo\.png[\s\S]*?Save &amp; exit/);
});

test('add property page reuses the listing Google address modal without changing listing mode', () => {
  const page = read('./property-add-workflow.jsx');
  const onboarding = read('./listing-create.jsx');
  assert.match(page, /<ListingCreatePage propertyMode onContinue=\{setConfirmedAddress\}/);
  assert.match(onboarding, /propertyMode \? 'Where is your property\?' : 'Set up your Property Peace listing'/);
  assert.match(onboarding, /!propertyMode && <Typography[^>]*>STEP 1 · YOUR ADDRESS<\/Typography>/);
  assert.match(onboarding, /!propertyMode && <Typography component="label" htmlFor="listing-address-trigger"[^>]*>Street address<\/Typography>/);
  assert.match(onboarding, /aria-label=\{propertyMode \? 'Street address' : undefined\}/);
  assert.match(onboarding, /role="listbox" aria-label="Google address results"/);
  assert.match(onboarding, /toPlaceDetails\(suggestion/);
  assert.match(onboarding, /Back to address results/);
  assert.match(onboarding, /justifyContent: 'center', minHeight: 44, px: 6, py: \{ xs: 2, sm: 3 \}, mb: 2/);
  assert.match(onboarding, /textAlign: 'center' \}\}>\{modalStep === 'search' \? 'Enter your address' : 'Confirm your address'\}/);
  assert.match(onboarding, /const primaryButton = \{[^\n]*bgcolor: '#061e35'[^\n]*color: '#fff'[^\n]*'&:hover': \{ bgcolor: '#042238'/);
  assert.match(onboarding, /setModalStep\('confirm'\)/);
  assert.match(onboarding, /onContinue\?\.\(\{ \.\.\.address, rentalMode \}\)/);
  assert.match(onboarding, /What type of rental describes your place best\?/);
  assert.match(onboarding, /'Short-term leasing'/);
  assert.match(onboarding, /'Long-term leasing'/);
  assert.match(onboarding, /step === 'rental' && !rentalMode/);
  assert.match(onboarding, /step === 'rental' \? 'place' : 'address'/);
  assert.match(onboarding, /step === 'rental' \|\| !propertyMode/);
  assert.match(onboarding, /component="footer"/);
  assert.match(onboarding, /Step 1<\/Typography>/);
  assert.match(onboarding, /pp-\$\{propertyMode \? 'property' : 'listing'\}-onboarding/);
});

test('confirmed address starts a Google image lookup for the property image step', () => {
  const page = read('./property-add-workflow.jsx');
  assert.match(page, /if \(!initialAddress\) return;/);
  assert.match(page, /fetchPhotosFromPlace\(null, fullAddress\)/);
  assert.match(page, /setGooglePhotoUrl\(result\?\.url \|\| null\)/);
  assert.match(page, /fetchingPhoto \? [\s\S]*?Searching Google for a property image/);
});

test('Google image lookup verifies Street View availability rather than accepting an error image', () => {
  const photos = fs.readFileSync(new URL('../../hooks/useGooglePlacePhotos.js', import.meta.url), 'utf8');
  assert.match(photos, /url\.pathname = '\/maps\/api\/streetview\/metadata'/);
  assert.match(photos, /data\.status === 'OK'/);
  assert.match(photos, /if \(streetViewUrl && await hasStreetViewImagery\(streetViewUrl\)\)/);
});

test('ZIP confirmation accepts exactly five digits and limits input length', () => {
  const onboarding = read('./listing-create.jsx');
  const page = read('./property-add-workflow.jsx');
  assert.match(onboarding, /\^\\d\{5\}\$/);
  assert.match(onboarding, /inputProps=\{field === 'zipCode' \? \{ maxLength: 5, inputMode: 'numeric' \} : undefined\}/);
  assert.match(page, /zipCode: Yup\.string\(\)\.matches\(\/\^\\d\{5\}\$\//);
  assert.match(page, /inputProps=\{\{ maxLength: 5, inputMode: 'numeric' \}\}/);
});

test('Back from property type returns to rental choice with the confirmed address preserved', () => {
  const page = read('./property-add-workflow.jsx');
  assert.match(page, /onBackToRental=\{\(\) => setConfirmedAddress\(null\)\}/);
  assert.match(page, /function PropertyAddWorkflow\(\{ onClose, initialAddress, onBackToRental \}\)/);
  assert.match(page, /navigate\('\/landlord\/properties\/add\?step=rental'\);\s*onBackToRental\?\.\(\);/);
  assert.match(read('./listing-create.jsx'), /const \[rentalMode, setRentalMode\] = useState\(saved\?\.rentalMode \|\| ''\)/);
});

test('selecting a property type stays on the question until Next is clicked', () => {
  const page = read('./property-add-workflow.jsx');
  const selection = page.match(/const handlePropertyTypeSelect = async \(propertyType\) => \{([\s\S]*?)\n  \};/);
  assert.ok(selection, 'property-type selection handler exists');
  assert.match(selection[1], /setFieldValue\('propertyType', propertyType\)/);
  assert.doesNotMatch(selection[1], /transitionToStep|handleNext/);
  assert.match(page, /if \(currentStep === STEPS\.PROPERTY_TYPE_SELECTION\) \{[\s\S]*?transitionToStep\(initialAddress \? STEPS\.IMAGE : STEPS\.ADDRESS, 'left'\)/);
  assert.match(page, /onClick=\{handleNext\}[\s\S]*?disabled=\{processing \|\| \(currentStep === STEPS\.PROPERTY_TYPE_SELECTION && !values\.propertyType\)\}/);
  assert.match(page, /currentStep !== STEPS\.ADD_UNITS && \(/);
  assert.doesNotMatch(page, /currentStep !== STEPS\.ADD_UNITS && \(!onClose \|\| currentStep !== STEPS\.PROPERTY_TYPE_SELECTION\)/);
});

test('confirmed property address continues to the creation workflow without repeating the address step', () => {
  const page = read('./property-add-workflow.jsx');
  assert.match(page, /initialAddress=\{confirmedAddress\}/);
  assert.match(page, /\[initialAddress.streetAddress, initialAddress.unit\]/);
  assert.match(page, /initialAddress \? STEPS.IMAGE : STEPS.ADDRESS/);
  assert.match(page, /rentalMode: initialAddress.rentalMode \|\| 'longTerm'/);
  assert.match(page, /onClose && <Stack direction=\{\{ xs: 'column', sm: 'row' \}\}/);
  assert.match(page, /onClose && currentStep < STEPS.PROCESSING/);
  assert.doesNotMatch(page, /<PageBreadcrumbs/);
  assert.match(page, /position: 'fixed', inset: 0, zIndex: 1400/);
  assert.match(read('./properties.jsx'), /onClick=\{\(\) => navigate\('\/landlord\/properties\/add'\)\}/);
  assert.match(read('../../sections/landlord/properties/PropertiesEmptyState.jsx'), /onAction=\{\(\) => navigate\('\/landlord\/properties\/add'\)\}/);
});

test('every add-property and add-listing entry opens its standalone page', () => {
  const root = new URL('../../', import.meta.url);
  const source = (path) => fs.readFileSync(new URL(path, root), 'utf8');
  for (const path of [
    'layout/Dashboard/BottomNavBar/index.jsx',
    'pages/landlord/dashboard-overview.jsx',
    'pages/landlord/properties-page.jsx',
    'sections/landlord/dashboard/QuickActions.jsx',
    'sections/landlord/dashboard/EnhancedQuickActions.jsx'
  ]) {
    const text = source(path);
    assert.match(text, /navigate\('\/landlord\/properties\/add'\)/, path);
    assert.doesNotMatch(text, /openPropertyAddWorkflowDrawer\(\)/, path);
  }
  const property = source('pages/landlord/property.jsx');
  assert.equal((property.match(/onCreateListing=\{\(\) => navigate\('\/landlord\/listings\/add'\)\}/g) || []).length, 2);
  const listings = source('pages/landlord/listings.jsx');
  assert.equal((listings.match(/navigate\('\/landlord\/listings\/add'\)/g) || []).length, 2);
});
