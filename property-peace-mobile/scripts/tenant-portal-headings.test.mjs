import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const screen = (name) => readFileSync(new URL(`../src/screens/tenant/${name}.tsx`, import.meta.url), 'utf8');

test('payments greets the signed-in first name without exposing a missing name', async () => {
  const { tenantWelcome } = await import('../src/features/tenantPayments/tenantWelcome.ts');
  assert.equal(tenantWelcome({ FirstName: '  Taylor  ' }), 'Welcome Taylor');
  assert.equal(tenantWelcome({ firstName: 'Jordan' }), 'Welcome Jordan');
  assert.equal(tenantWelcome({ FirstName: '   ' }), 'Welcome');
  assert.equal(tenantWelcome(null), 'Welcome');
  const payments = screen('TenantPaymentsScreen');
  assert.match(payments, /tenantWelcome\(currentUser\)/);
  assert.match(payments, /useAppSelector\(state => state\.user\.currentUser\)/);
  assert.match(payments, /YOUR LEASE & PAYMENTS/);
  assert.doesNotMatch(payments, /Pay & bill|YOUR HOME · PAYMENTS/);
});

test('tenant portal page eyebrow headings are green in light and dark themes', () => {
  const payments = screen('TenantPaymentsScreen');
  assert.match(payments, /eyebrow: \{ color: '#24733a'/);
  assert.match(payments, /styles\.eyebrow, \{ color: mode === 'dark' \? '#8cdda4' : '#24733a' \}/);
  const maintenance = screen('TenantMaintenanceScreen');
  assert.match(maintenance, /eyebrow: \{[^\n]*color: '#24733a'/);
  assert.match(maintenance, /styles\.eyebrow, dark && \{ color: '#8cdda4' \}/);
  for (const name of ['TenantMaintenanceIntakeScreen', 'TenantMaintenanceDetailScreen']) {
    const source = screen(name);
    assert.match(source, /eyebrow:\{[^\n]*color:'#24733a'/);
    assert.match(source, /eyebrow:\{\.\.\.base\.eyebrow,color:'#8cdda4'\}/);
  }
});
