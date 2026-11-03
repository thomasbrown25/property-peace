import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property header exposes one actions menu with the requested destinations', async () => {
  const header = await read('./PropertyHeader.jsx');
  const overview = await read('./PropertyOverview.jsx');
  assert.doesNotMatch(overview, /PropertyQuickActionsPanel/);
  assert.match(header, /startIcon=\{<ThunderboltOutlined/);
  const actions = [
    ['EditOutlined', 'Edit property'],
    ['FileAddOutlined', 'Create a lease'],
    ['FileTextOutlined', 'View leases'],
    ['DollarOutlined', 'Record a payment'],
    ['ToolOutlined', 'Create maintenance ticket'],
    ['UploadOutlined', 'Upload document'],
    ['DeleteOutlined', 'Delete property']
  ];
  for (const [icon, label] of actions) {
    assert.match(header, new RegExp(`<MenuItem[^\\n]*>\\s*<${icon}[^>]*\\/> ${label}\\s*<\\/MenuItem>`));
  }
  assert.match(header, /Upload document\s*<\/MenuItem>\s*<Divider \/>\s*<MenuItem sx=\{\{ color: 'error.main' \}\}/);
  assert.match(header, /onDelete\?\.\(\)/);
});

test('property header Actions button remains white with navy text on hover and focus', async () => {
  const header = await read('./PropertyHeader.jsx');
  const buttonStyle = header.match(/const heroButtonSx = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(buttonStyle, 'property Actions button style exists');
  assert.match(buttonStyle, /bgcolor: '#fff'/);
  assert.match(buttonStyle, /color: '#061e35'/);
  assert.match(buttonStyle, /'&:hover, &:focus-visible': \{[^}]*color: '#061e35'[^}]*bgcolor: '#fff'/);
  assert.match(header, /aria-expanded=\{Boolean\(actionsAnchor\)\}[\s\S]*?sx=\{heroButtonSx\}[\s\S]*?>\s*Actions/);
});

test('overview removes the current tenant and current lease cards but keeps property context', async () => {
  const overview = await read('./PropertyOverview.jsx');
  assert.doesNotMatch(overview, /<PropertyCurrentTenant|<PropertyActiveLease/);
  assert.match(overview, /<PropertyUnitsAtAGlance/);
  assert.match(overview, /<PropertyStory/);
});
