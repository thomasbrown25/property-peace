import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const leasePageSource = fs.readFileSync(new URL('../pages/landlord/lease.jsx', import.meta.url), 'utf8');

const drawerSource = fs.readFileSync(new URL('../components/drawers/LeaseDocumentUploadDrawer.jsx', import.meta.url), 'utf8');

test('lease document actions open an in-context upload drawer instead of navigating away', () => {
  assert.match(leasePageSource, /import LeaseDocumentUploadDrawer from 'components\/drawers\/LeaseDocumentUploadDrawer';/);
  assert.match(leasePageSource, /const \[documentUploadDrawerOpen, setDocumentUploadDrawerOpen\] = useState\(false\);/);
  assert.match(leasePageSource, /onUploadDocument=\{\(\) => setDocumentUploadDrawerOpen\(true\)\}/);
  assert.doesNotMatch(leasePageSource, /onUploadDocument=\{\(\) => navigate\(`\/landlord\/leases\/\$\{leaseId\}\/upload-document`\)\}/);
  assert.match(
    leasePageSource,
    /<LeaseDocumentUploadDrawer[\s\S]*open=\{documentUploadDrawerOpen\}[\s\S]*leaseId=\{leaseId\}[\s\S]*tenants=\{tenants\}/
  );
});

test('upload drawer provides drag-and-drop, file-name title defaults, type, and tenant visibility', () => {
  assert.match(drawerSource, /export .*getDocumentTitleFromFile/);
  assert.match(drawerSource, /onDrop=\{handleDrop\}/);
  assert.match(drawerSource, /onDragOver=\{handleDragOver\}/);
  assert.match(drawerSource, /accept="\.pdf,\.doc,\.docx"/);
  assert.match(drawerSource, /Drag and drop your document here/);
  assert.match(drawerSource, /label="Document title"/i);
  assert.match(drawerSource, /label="Document type"/i);
  assert.match(drawerSource, /Share with tenants/);
  assert.match(drawerSource, /Keep private/);
});

test('file-name title helper removes only the final extension', async () => {
  const { getDocumentTitleFromFile } = await import('../components/drawers/leaseDocumentUpload.js');
  assert.equal(getDocumentTitleFromFile({ name: '2026.renewal-agreement.pdf' }), '2026.renewal-agreement');
  assert.equal(getDocumentTitleFromFile({ name: 'lease' }), 'lease');
  assert.equal(getDocumentTitleFromFile(null), '');
});

test('forms and other use distinct select values while mapping to the supported API document type', async () => {
  const { DOCUMENT_TYPE_OPTIONS, getDocumentTypeApiValue } = await import('../components/drawers/leaseDocumentUpload.js');
  const forms = DOCUMENT_TYPE_OPTIONS.find((option) => option.label === 'Forms');
  const other = DOCUMENT_TYPE_OPTIONS.find((option) => option.label === 'Other');

  assert.notEqual(forms.value, other.value);
  assert.equal(getDocumentTypeApiValue(forms.value), 99);
  assert.equal(getDocumentTypeApiValue(other.value), 99);
});
