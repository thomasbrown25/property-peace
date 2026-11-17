import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = (path) => readFileSync(resolve(root, path), 'utf8');

test('tenant and public headers and actions use green brand surfaces instead of navy', () => {
  assert.match(source('pages/tenant/maintenance-detail.jsx'), /bgcolor: 'primary.dark', color: 'primary.contrastText'/);
  assert.match(source('pages/public/stay.jsx'), /component="header" sx=\{\{ bgcolor: 'primary.dark'/);
  assert.match(source('pages/public/stay.jsx'), /bgcolor: 'primary.main'.*&:hover.*bgcolor: 'primary.dark'/);
  const drawer = source('pages/tenant/MaintenanceAgentDrawer.jsx');
  assert.match(drawer, /const TEAL = '#247568'/);
  assert.doesNotMatch(drawer, /#0ea5e9|#0284c7/i);
});

test('admin and auth branded surfaces use theme roles instead of navy fills', () => {
  const maintenance = source('pages/maintenance.jsx');
  assert.match(maintenance, /bgcolor: theme.palette.primary.dark/);
  assert.doesNotMatch(maintenance, /linear-gradient\(135deg, #061e35/i);
  assert.match(source('pages/admin/dashboard.jsx'), /linear-gradient\(120deg, \$\{currentTheme.palette.primary.dark\}/);
  assert.match(source('sections/admin/support/AdminSupportWorkspace.jsx'), /linear-gradient\(125deg, \$\{currentTheme.palette.primary.dark\}/);
  assert.match(source('sections/auth/organization/OrganizationInviteAcceptForm.jsx'), /bgcolor: 'primary.main', '&:hover': \{ bgcolor: 'primary.dark' \}/);
  assert.match(source('pages/auth/jwt/mobile-signup-challenge.jsx'), /background: theme.palette.primary.dark/);
});
