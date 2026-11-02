import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./TenantAddDrawer.jsx', import.meta.url), 'utf8');

test('property/unit is optional, after email, and selected independently for each tenant', () => {
  assert.match(source, /value=\{propertyUnitOptions\.find\(\(option\) => option\.id === tenant\.propertyUnitId\)/);
  assert.match(source, /setFieldValue\(`tenants\.\$\{index\}\.propertyUnitId`, option\?\.id \?\? null\)/);
  assert.match(source, /Property \/ Unit \(optional\)/);
  assert.ok(source.indexOf('label="Email"') < source.indexOf('Property / Unit (optional)'));
  assert.doesNotMatch(source, /Please select a property before adding tenants|!getPropertyId\(selectedProperty\)/);
  assert.match(source, /PropertyId: getPropertyId\(chosenOption\?\.property\)/);
  assert.match(source, /UnitId: getUnitId\(chosenOption\?\.unit\)/);
  assert.match(source, /LeaseId: chosenLease\?\.id \?\? chosenLease\?\.Id \?\? null/);
});

test('tenant sections are unboxed and repeatable; create account has external password label', () => {
  assert.doesNotMatch(source, /<Card\b|<CardContent\b|Tenant \$\{index \+ 1\}/);
  assert.match(source, /arrayHelpers\.push\(\{[^}]*propertyUnitId: null/);
  assert.match(source, /<InputLabel htmlFor=\{`password-\$\{index\}`\} shrink sx=/);
  assert.doesNotMatch(source, /label="Password"|placeholder="Password"/);
  assert.match(source, /disabled=\{isSubmitting \|\| values\.tenants\.length === 0\}/);
});
