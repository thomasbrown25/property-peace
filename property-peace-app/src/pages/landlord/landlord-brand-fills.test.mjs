import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const pages = 'checklists calendar maintenances messages ai-center listing-create property-add-workflow announcement-details dashboard-overview inspection-detail lease-shield'.split(' ');

for (const page of pages) {
  test(`${page} does not paint a navy fill or hover`, () => {
    const source = readFileSync(join(here, `${page}.jsx`), 'utf8');
    assert.doesNotMatch(source, /(?:bgcolor|background)\s*:\s*(?:['"](?:#061[eE]35|#1e3a5f|#1a2035)|NAVY\b|alpha\(NAVY\s*,)/);
    assert.doesNotMatch(source, /(?:#071b2e|#0a2b43|#0f3f4f|#0A3850|#0D4B55|#0b2f4f|#042238)/i);
  });
}

test('lease builder panels use the same nested surface as the portal in both theme modes', () => {
  for (const file of ['LeaseAgreementBuilder', 'LeasePreview', 'PolicyBuilder']) {
    const source = readFileSync(join(here, '..', '..', 'sections', 'lease-builder', `${file}.jsx`), 'utf8');
    assert.match(source, /bgcolor: 'surface.nested'/, file);
    assert.doesNotMatch(source, /bgcolor: 'grey.50'/, file);
  }
});

test('standalone agreement editors leave the shared portal background visible', () => {
  for (const file of ['pets-smoking-other', 'utilities-maintenance-keys', 'provisions-attachments']) {
    const source = readFileSync(join(here, 'build-lease-agreement', `${file}.jsx`), 'utf8');
    assert.match(source, /<Box sx=\{embedded \? undefined : \{ minHeight: '100vh', display: 'flex'/, file);
  }
});
