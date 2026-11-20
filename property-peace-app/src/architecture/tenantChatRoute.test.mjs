import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(src, file), 'utf8');

test('tenant Chat has a canonical route and a legacy deep-link redirect', () => {
  const routes = read('routes/MainRoutes.jsx');

  assert.match(routes, /path: 'tenant\/chat',[\s\S]*?<TenantMessages \/>/);
  assert.match(routes, /path: 'tenant\/messages',\s*element: <TenantLegacyChatRedirect \/>/);
  assert.match(routes, /<Navigate to=\{`\/tenant\/chat\$\{search\}\$\{hash\}`\} replace \/>/);
});

test('tenant navigation producers use Chat and the canonical tenant route', () => {
  const files = [
    'menu-items/tenant-pages.js',
    'layout/Dashboard/Header/HeaderContent/Message.jsx',
    'layout/Dashboard/Header/HeaderContent/Notification.jsx',
    'pages/tenant/lease.jsx',
    'pages/tenant/notifications.jsx'
  ];

  for (const file of files) {
    assert.match(read(file), /\/tenant\/chat/, `${file} should target Chat`);
    assert.doesNotMatch(read(file), /\/tenant\/messages/, `${file} still points to the old URL`);
  }

  const navigation = read('menu-items/tenant-pages.js');
  assert.match(navigation, /id: 'tenant-messages',[\s\S]*?title: 'Chat',[\s\S]*?url: '\/tenant\/chat'/);

  const header = read('layout/Dashboard/Header/HeaderContent/Message.jsx');
  assert.match(header, /isAdmin \? '\/admin\/messages' : isTenant \? '\/tenant\/chat' : '\/landlord\/chat'/);
  assert.match(header, /isAdmin \? "Support" : "Chat"/);
  assert.match(header, /isAdmin \? "open support" : "open chat"/);
});

test('tenant message notifications retain their related conversation when opening Chat', () => {
  for (const file of [
    'layout/Dashboard/Header/HeaderContent/Notification.jsx',
    'pages/tenant/notifications.jsx'
  ]) {
    assert.match(
      read(file),
      /notification\.relatedId\s*\? `\/tenant\/chat\?conversationId=\$\{encodeURIComponent\(notification\.relatedId\)\}`\s*:\s*'\/tenant\/chat'/
    );
  }
});
