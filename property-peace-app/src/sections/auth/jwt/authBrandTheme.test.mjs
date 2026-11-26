import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { authFieldSx, authPrimaryButtonSx, authSecondaryButtonSx } from './authFormStyles.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const wrapper = read('../AuthWrapper.jsx');
const registrationSteps = [
  './EmailEntryForm.jsx', './EmailVerifierForm.jsx', './LandlordPersonalInfoStep.jsx',
  './OrganizationForm.jsx', './CreatingAccountStep.jsx'
];

test('login and register share a branded split shell without a fixed navy surface', () => {
  assert.match(wrapper, /background: theme\.palette\.brand\.forest/);
  assert.match(wrapper, /bgcolor: 'background\.default'/);
  assert.match(wrapper, /theme\.palette\.brand\.mint/);
  assert.doesNotMatch(wrapper, /#061e35|#78c578|rgba\(65, 165, 65/);
});

test('auth fields and actions share sizing and follow the theme for focus, errors, and primary actions', () => {
  const field = authFieldSx({ palette: { mode: 'light', primary: { main: '#247568' }, error: { main: '#C43D40' } } });
  for (const control of [field, authPrimaryButtonSx, authSecondaryButtonSx]) {
    assert.equal(control.minHeight, 50);
    assert.equal(control.borderRadius, '12px');
  }

  const outline = '& .MuiOutlinedInput-notchedOutline';
  assert.equal(field['&.Mui-focused'][outline].borderColor, 'primary.main');
  assert.equal(field['&.Mui-error'][`${outline}, &:hover .MuiOutlinedInput-notchedOutline`].borderColor, 'error.main');
  assert.notEqual(field['&.Mui-error']['&.Mui-focused'].boxShadow, field['&.Mui-focused'].boxShadow);
  assert.equal(authPrimaryButtonSx.bgcolor, 'primary.main');
  assert.equal(authPrimaryButtonSx.color, 'primary.contrastText');
  assert.equal(authPrimaryButtonSx['&:hover'].bgcolor, 'primary.dark');
});

test('registration steps follow the theme without a fixed navy surface', () => {
  for (const path of registrationSteps) {
    assert.doesNotMatch(read(path), /#061e35/, `${path} still pins old navy`);
  }
});
