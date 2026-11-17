import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./renter-profile.jsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../../../../property-peace-api/Controllers/TenantController.cs', import.meta.url), 'utf8');

test('Add charge uses the same primary fill as the property Actions button', () => {
  const button = page.split('\n').find((line) => line.includes('>Add charge</Button>'));
  assert.ok(button);
  assert.match(button, /variant="contained"/);
  assert.doesNotMatch(button, /color="success"/);
});

test('renter avatar has accessible pencil upload action and persists the selected image', () => {
  assert.match(page, /aria-label="Upload renter photo"/);
  assert.match(page, /<EditOutlined\s*\/>/);
  assert.match(page, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(page, /\/api\/tenant\/\$\{numericRenterId\}\/photo/);
  assert.match(page, /read\(renter, 'profileImageUrl', 'ProfileImageUrl'\)/);
});

test('renter avatar is larger with a bare pencil at its top right', () => {
  const avatarContainer = page.split('\n').find((line) => line.includes("position: 'relative'") && line.includes('alignSelf:'));
  const pencilButton = page.split('\n').find((line) => line.includes('aria-label="Upload renter photo"'));
  assert.match(avatarContainer, /xs: 76, md: 100/);
  assert.match(pencilButton, /right: -4, top: -4/);
  assert.match(pencilButton, /bgcolor: 'transparent'/);
  assert.match(pencilButton, /border: 0/);
  assert.match(pencilButton, /boxShadow: 'none'/);
  assert.doesNotMatch(pencilButton, /bottom:|borderColor:|bgcolor: 'background.paper'/);
});

test('photo upload is scoped to the current organization and does not change the linked user account image', () => {
  assert.match(controller, /HttpPost\("\{id\}\/photo"\)/);
  assert.match(controller, /GetCurrentOrganizationIdOrForbid/);
  assert.match(controller, /t\.OrganizationId == organizationId\.Value/);
  assert.match(controller, /tenant\.ProfileImageUrl =/);
  assert.doesNotMatch(controller, /tenant\.User\.ProfileImageUrl =/);
});
