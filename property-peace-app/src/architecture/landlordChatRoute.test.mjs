import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(src, file), 'utf8');

test('landlord Chat has a canonical route, matching page title and breadcrumb, and a legacy deep-link redirect', () => {
  const routes = read('routes/MainRoutes.jsx');
  const page = read('pages/landlord/messages.jsx');
  assert.match(routes, /path: 'landlord\/chat',[\s\S]*?<Messages \/>/);
  assert.match(routes, /path: 'landlord\/messages',\s*element: <LegacyChatRedirect \/>/);
  assert.match(routes, /<Navigate to=\{`\/landlord\/chat\$\{search\}\$\{hash\}`\} replace \/>/);
  assert.match(page, /\{ label: 'Chat' \}/);
  assert.match(page, /<Typography variant="h3" fontWeight=\{750\}>\s*Chat\s*<\/Typography>/);
});

test('landlord navigation producers use Chat and retain role-specific inboxes', () => {
  const files = [
    'menu-items/pages.js', 'data/videos.js', 'layout/Dashboard/index.jsx',
    'layout/Dashboard/BottomNavBar/index.jsx', 'layout/Dashboard/Header/HeaderContent/Message.jsx',
    'components/drawers/UnitDetailDrawer.jsx', 'components/drawers/TenantMessageDrawer.jsx',
    'components/cards/PropertyCard.jsx', 'sections/landlord/dashboard/TodaysPriorities.jsx',
    'pages/landlord/urgent-messages.jsx', 'pages/landlord/portfolio-summary.jsx',
    'pages/landlord/messages.jsx', 'utils/activityNavigation.mjs', 'utils/activationLifecycle.js'
  ];
  for (const file of files) {
    assert.match(read(file), /\/landlord\/chat/, `${file} should target Chat`);
    assert.doesNotMatch(read(file), /\/landlord\/messages(?!\.jsx)/, `${file} still points to the old URL`);
  }
  const header = read('layout/Dashboard/Header/HeaderContent/Message.jsx');
  assert.match(header, /isAdmin \? '\/admin\/messages' : isTenant \? '\/tenant\/chat' : '\/landlord\/chat'/);
});
