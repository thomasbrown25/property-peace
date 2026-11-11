import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);

test('internal payment approval workspaces have no routes or admin navigation', async () => {
  for (const path of ['routes/MainRoutes.jsx', 'menu-items/admin-pages.js', 'layout/Dashboard/Header/HeaderContent/Notification.jsx']) {
    const text = await readFile(new URL(path, root), 'utf8');
    assert.doesNotMatch(text, /admin\/rent-payment-access|admin\/stripe-payees|AdminRentPaymentAccess|AdminStripePayees/);
  }
});

test('obsolete internal review pages and mutation workspaces are removed', async () => {
  for (const path of ['pages/admin/rent-payment-access.jsx', 'pages/admin/stripe-payees.jsx', 'sections/admin/rent-payment-access/RentPaymentAccessReviewWorkspace.jsx', 'sections/admin/stripe-payees/StripePayeeReviewWorkspace.jsx']) {
    await assert.rejects(access(new URL(path, root)), { code: 'ENOENT' });
  }
});
