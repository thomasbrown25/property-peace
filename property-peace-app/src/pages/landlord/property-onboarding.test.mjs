import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('landlord signup opens the welcome dialog on Home, with a choice to add a property', () => {
  const complete = read('../auth/jwt/setting-up-profile.jsx');
  const dashboard = read('./dashboard.jsx');
  const dialog = read('../../sections/landlord/dashboard/OwnerWelcomeDialog.jsx');
  const routes = read('../../routes/MainRoutes.jsx');
  assert.equal([...complete.matchAll(/window\.location\.replace\('\/landlord\/dashboard\?welcome=signup'\)/g)].length, 3);
  assert.match(dashboard, /activeTab === 'overview' && searchParams\.get\('welcome'\) === 'signup'/);
  assert.match(dashboard, /nextParams\.delete\('welcome'\);\s*setSearchParams\(nextParams, \{ replace: true \}\)/);
  assert.match(dashboard, /showWelcome && <OwnerWelcomeDialog onClose=\{dismissWelcome\}/);
  assert.match(dialog, /to="\/landlord\/properties\/add\?from=signup"\s+replace[\s\S]*?Add your first property/);
  assert.match(dialog, /href: ONLINE_PAYMENT_SETUP_PATH/);
  assert.match(dialog, /href: '\/landlord\/support\/ticket'/);
  assert.match(dialog, /to=\{option\.href\}\s+replace/);
  assert.match(routes, /path: 'landlord\/properties\/add',\s*element: <PropertyAddWorkflow \/>/);
});

test('property onboarding keeps signup context through the address and rental steps', () => {
  const onboarding = read('./listing-create.jsx');
  const workflow = read('./property-add-workflow.jsx');
  assert.match(onboarding, /new URLSearchParams\(params\)[\s\S]*?(?:set|delete)\('step'/);
  assert.match(workflow, /new URLSearchParams\(searchParams\)[\s\S]*?set\('step', 'rental'\)/);
});

test('property onboarding inherits the portal background while standalone listing keeps its themed canvas', () => {
  const dashboardLayout = read('../../layout/Dashboard/index.jsx');
  const backgrounds = read('../../themes/portalPageBackground.js');
  const listing = read('./listing-create.jsx');
  const workflow = read('./property-add-workflow.jsx');
  assert.match(dashboardLayout, /sx=\{\[portalPageBackground,/);
  assert.match(backgrounds, /bgcolor: 'background.default'/);
  assert.match(listing, /propertyMode \? undefined : \[portalPageBackground, \{ position: 'fixed'/);
  assert.match(listing, /\.\.\.\(!propertyMode && \{ position: 'fixed', bottom: 0/);
  assert.match(listing, /!propertyMode && <Box component="img" src=\{theme.palette.mode === 'dark' \? logoOnDark/);
  assert.doesNotMatch(workflow, /position: 'fixed'|portalPageBackground|listing-onboarding-logo/);
});

test('successful signup property creation opens Home and regular creation opens the property', () => {
  const workflow = read('./property-add-workflow.jsx');
  assert.match(workflow, /const created = await createProperty[\s\S]*?if \(!created\?\.id\) throw[\s\S]*?if \(!onClose && searchParams\.get\('from'\) === 'signup'\) \{\s*window\.location\.replace\('\/landlord\/dashboard'\);\s*return;\s*\}[\s\S]*?navigate\(`\/landlord\/property\/\$\{created.id\}`\)/);
});

test('both property onboarding phases provide in-page Save and exit actions', () => {
  const workflow = read('./property-add-workflow.jsx');
  const onboarding = read('./listing-create.jsx');
  assert.match(workflow, /onClick=\{\(\) => navigate\('\/landlord\/properties'\)\}[^>]*>Save &amp; exit/);
  assert.match(onboarding, /onClick=\{saveAndExit\}>Save &amp; exit/);
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
  assert.match(onboarding, /const primaryButton = \{[^\n]*bgcolor: 'primary.main'[^\n]*color: 'primary.contrastText'[^\n]*'&:hover': \{ bgcolor: 'primary.dark'/);
  assert.match(onboarding, /setModalStep\('confirm'\)/);
  assert.match(onboarding, /onContinue\?\.\(\{ \.\.\.address, rentalMode \}\)/);
  assert.match(onboarding, /What type of rental describes your place best\?/);
  assert.match(onboarding, /'Short-term leasing \(Airbnb style\)'/);
  assert.match(onboarding, /'Long-term leasing'/);
  assert.match(onboarding, /step === 'rental' && !rentalMode/);
  assert.match(onboarding, /step === 'rental' \? 'place' : 'address'/);
  assert.match(onboarding, /step === 'rental' \|\| !propertyMode/);
  assert.match(onboarding, /component=\{propertyMode \? 'div' : 'footer'\}/);
  assert.match(onboarding, /Step 1<\/Typography>/);
  assert.match(onboarding, /pp-\$\{propertyMode \? 'property' : 'listing'\}-onboarding/);
});

test('confirmed address starts a Google image lookup without an image step', () => {
  const page = read('./property-add-workflow.jsx');
  assert.match(page, /if \(!initialAddress\) return;/);
  assert.match(page, /lookupPropertyImage\(null, fullAddress\)/);
  assert.match(page, /imageLookupRef\.current = fetchPhotosFromPlace\(place, address\)/);
  assert.match(page, /await imageLookupRef\.current/);
  assert.match(page, /new File\(\[blob\], 'google-maps-photo\.jpg'/);
  assert.match(page, /new File\(\[blob\], 'placeholder-house\.png'/);
  assert.doesNotMatch(page, /STEPS\.IMAGE|case STEPS\.IMAGE|Upload My Own|Use Google Image/);
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
  assert.match(page, /nextParams\.set\('step', 'rental'\);\s*setSearchParams\(nextParams,[^\n]*\);\s*onBackToRental\?\.\(\);/);
  assert.match(read('./listing-create.jsx'), /const \[rentalMode, setRentalMode\] = useState\(saved\?\.rentalMode \|\| ''\)/);
});

test('selecting a property type stays on the question until Next is clicked', () => {
  const page = read('./property-add-workflow.jsx');
  const selection = page.match(/const handlePropertyTypeSelect = async \(propertyType\) => \{([\s\S]*?)\n  \};/);
  assert.ok(selection, 'property-type selection handler exists');
  assert.match(selection[1], /setFieldValue\('propertyType', propertyType\)/);
  assert.doesNotMatch(selection[1], /transitionToStep|handleNext/);
  assert.match(page, /if \(currentStep === STEPS\.PROPERTY_TYPE_SELECTION\) \{[\s\S]*?if \(initialAddress\) await advanceFromAddress\(\)/);
  assert.match(page, /onClick=\{handleNext\}[\s\S]*?disabled=\{processing \|\| \(currentStep === STEPS\.PROPERTY_TYPE_SELECTION && !values\.propertyType\)\}/);
  assert.match(page, /currentStep !== STEPS\.ADD_UNITS && \(/);
  assert.doesNotMatch(page, /currentStep !== STEPS\.ADD_UNITS && \(!onClose \|\| currentStep !== STEPS\.PROPERTY_TYPE_SELECTION\)/);
});

test('confirmed property address continues to the creation workflow without repeating the address step', () => {
  const page = read('./property-add-workflow.jsx');
  assert.match(page, /initialAddress=\{confirmedAddress\}/);
  assert.match(page, /\[initialAddress.streetAddress, initialAddress.unit\]/);
  assert.match(page, /if \(initialAddress\) await advanceFromAddress\(\);\s*else transitionToStep\(STEPS\.ADDRESS, 'left'\)/);
  assert.match(page, /return initialAddress \? STEPS\.PROPERTY_TYPE_SELECTION : STEPS\.ADDRESS/);
  assert.match(page, /rentalMode: initialAddress.rentalMode \|\| 'longTerm'/);
  assert.match(page, /onClose && <Stack direction=\{\{ xs: 'column', sm: 'row' \}\}/);
  assert.match(page, /onClose && currentStep < STEPS.PROCESSING/);
  assert.doesNotMatch(page, /<PageBreadcrumbs/);
  assert.doesNotMatch(page, /position: 'fixed', inset: 0/);
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
