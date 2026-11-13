import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property breadcrumbs and Actions share a row above equal-height hero and rent cards', async () => {
  const header = await read('./PropertyHeader.jsx');
  const actions = await read('./PropertyActions.jsx');
  const page = await read('../../../pages/landlord/property.jsx');
  assert.match(page, /<Stack direction="row" alignItems="center" justifyContent="space-between"[^>]*>[\s\S]*?<PageBreadcrumbs[\s\S]*?<PropertyActions[\s\S]*?<\/Stack>[\s\S]*?<PropertyHeader/);
  assert.doesNotMatch(header, /ThunderboltOutlined|property-actions-menu/);
  assert.match(actions, /aria-expanded=\{Boolean\(actionsAnchor\)\}/);
  assert.match(header, /<Grid container spacing=\{2\} alignItems="stretch">/);
  assert.match(header, /<Grid size=\{\{ xs: 12, md: 7 \}\} sx=\{\{ display: 'flex' \}\}>/);
  assert.match(header, /width: '100%',\s*height: '100%',\s*minHeight: 300/);
  assert.match(header, /height: '100%', minHeight: 300, boxSizing: 'border-box'/);
});

test('property Actions preserves the seven menu destinations and deletion confirmation', async () => {
  const header = await read('./PropertyActions.jsx');
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

test('property Actions button uses semantic light/dark tokens', async () => {
  const header = await read('./PropertyActions.jsx');
  const buttonStyle = header.match(/const actionButtonSx = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(buttonStyle, 'property Actions button style exists');
  assert.match(buttonStyle, /borderColor: 'divider'/);
  assert.match(buttonStyle, /color: 'text.primary'/);
  assert.match(buttonStyle, /'&:hover, &:focus-visible': \{[^}]*borderColor: 'primary.main'/);
  assert.doesNotMatch(buttonStyle, /#061e35/);
  assert.match(header, /aria-expanded=\{Boolean\(actionsAnchor\)\}[\s\S]*?sx=\{actionButtonSx\}[\s\S]*?>\s*Actions/);
});

test('overview removes the current tenant and current lease cards but keeps property context', async () => {
  const overview = await read('./PropertyOverview.jsx');
  assert.doesNotMatch(overview, /<PropertyCurrentTenant|<PropertyActiveLease/);
  assert.match(overview, /<PropertyUnitsAtAGlance/);
  assert.match(overview, /<PropertyStory/);
});
