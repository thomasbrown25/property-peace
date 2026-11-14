import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const wrapper = read('../AuthWrapper.jsx');
const login = read('./AuthLogin.jsx');
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

test('login action, field outlines, and registration headings use semantic theme roles', () => {
  assert.match(login, /bgcolor: 'primary\.main'/);
  assert.match(login, /color: 'primary\.contrastText'/);
  assert.match(login, /bgcolor: 'primary\.dark'/);
  assert.doesNotMatch(login, /#061e35|#0b2a46|rgba\(0, 0, 0, 0\.3\)/);
  for (const path of registrationSteps) {
    assert.doesNotMatch(read(path), /#061e35/, `${path} still pins old navy`);
  }
});
