import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/tenants/tenantForm.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { validateTenant, tenantPayload } = exports;
test('tenant requires names and valid email, trims optional phone', () => {
  const linked = { propertyId: 4, unitId: 9 };
  assert.match(validateTenant({ firstName: ' A ', lastName: ' B ', email: 'bad', phoneNumber: '', ...linked }), /email/i);
  assert.match(validateTenant({ firstName: ' ', lastName: ' B ', email: 'a@example.com', phoneNumber: '', ...linked }), /first name/i);
  assert.match(validateTenant({ firstName: ' A ', lastName: ' B ', email: 'a@example.com', phoneNumber: '' }), /property/i);
  assert.equal(validateTenant({ firstName: ' A ', lastName: ' B ', email: ' a@example.com ', phoneNumber: '', ...linked }), null);
  assert.deepEqual(JSON.parse(JSON.stringify(tenantPayload({ firstName: ' A ', lastName: ' B ', email: ' A@EXAMPLE.COM ', phoneNumber: ' 555 ' }))), { firstname: 'A', lastname: 'B', email: 'A@EXAMPLE.COM', phoneNumber: '555', unitId: null, leaseId: null, isActive: true });
});
