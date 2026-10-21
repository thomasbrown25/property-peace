import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = new URL('../../api/adminShortStayCollection.js', import.meta.url);

test('admin actions use authenticated axios, exact server request shapes and no-store', async () => {
  const source = (await readFile(moduleUrl, 'utf8')).replace("import axios from 'utils/axios';", 'const axios = globalThis.__adminCollectionAxios;').replace("from 'pages/admin/short-stay-collection-review'", `from '${new URL('./short-stay-collection-review.js', import.meta.url).href}'`);
  const calls = [];
  globalThis.__adminCollectionAxios = Object.fromEntries(['get', 'post'].map(method => [method, async (...args) => {
    calls.push([method, ...args]);
    return { data: { success: true, data: method === 'get' ? [{ id: 3 }] : { id: 3 } } };
  }]));
  try {
    const { adminShortStayCollectionAPI: api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    assert.deepEqual(await api.list(), [{ id: 3 }]);
    await api.beginReview(3);
    await api.approve(3, 'CASE2026', true);
    await api.suspend(3, 'authority_revoked');
    await api.reject(3, 'policy_mismatch');
    assert.deepEqual(calls.map(c => [c[0], c[1], c[0] === 'get' ? undefined : c[2]?.caseReference ?? c[2]?.reasonCode ?? c[2]]), [
      ['get', '/api/admin/short-stay-collection-applications', undefined],
      ['post', '/api/admin/short-stay-collection-applications/3/begin-review', null],
      ['post', '/api/admin/short-stay-collection-applications/3/approve', 'CASE2026'],
      ['post', '/api/admin/short-stay-collection-applications/3/suspend', 'authority_revoked'],
      ['post', '/api/admin/short-stay-collection-applications/3/reject', 'policy_mismatch']
    ]);
    assert.deepEqual(calls[2][2], { caseReference: 'CASE2026', propertyAuthorityConfirmed: true });
    assert.deepEqual(calls[3][2], { reasonCode: 'authority_revoked' });
    assert.deepEqual(calls[4][2], { reasonCode: 'policy_mismatch' });
    for (const call of calls) assert.equal(call.at(-1).headers['Cache-Control'], 'no-store');
    await assert.rejects(() => api.approve(3, 'person@example.com'));
    await assert.rejects(() => api.approve(3, 'CASE2026'));
    await assert.rejects(() => api.approve(3, 'CASE2026', false));
    await assert.rejects(() => api.approve(3, 'CASE2026', 1));
    await assert.rejects(() => api.suspend(3, 'free form PII'));
    assert.equal(calls.length, 5);
  } finally { delete globalThis.__adminCollectionAxios; }
});

test('status controls and validation follow server transitions', async () => {
  const { availableActions, validCaseReference, reasonCodes } = await import('../admin/short-stay-collection-review.js');
  assert.deepEqual(availableActions('identityVerified'), ['begin-review', 'suspend', 'reject']);
  assert.deepEqual(availableActions('underReview'), ['approve', 'suspend', 'reject']);
  assert.deepEqual(availableActions('payoutApproved'), ['suspend']);
  assert.deepEqual(availableActions('suspended'), ['reject']);
  assert.deepEqual(availableActions('rejected'), []);
  assert.equal(validCaseReference('CASE2026'), true);
  for (const invalid of ['abc', 'has spaces', 'user@example.com', 'A'.repeat(65)]) assert.equal(validCaseReference(invalid), false);
  assert.ok(reasonCodes.includes('authority_revoked'));
});

test('admin-only route and menu; queue renders only allowlisted DTO fields, no PII forms', async () => {
  const route = await readFile(new URL('../../routes/MainRoutes.jsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../../menu-items/admin-pages.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('./short-stay-collection.jsx', import.meta.url), 'utf8');
  assert.match(route, /path: 'admin\/short-stay-collection'[\s\S]*?<AdminRoute>[\s\S]*?<AdminShortStayCollection \/>/);
  assert.match(menu, /url: '\/admin\/short-stay-collection'/);
  for (const field of ['applicantUserId', 'organizationId', 'propertyIds', 'submittedAt', 'approvedAt', 'status']) assert.match(page, new RegExp(`\\.${field}\\b`));
  assert.match(page, /FormControlLabel/);
  assert.match(page, /authority/);
  assert.match(page, /setAuthority\(false\)/);
  assert.match(page, /authority && validCaseReference\(caseReference\)/);
  assert.match(page, /adminShortStayCollectionAPI\.approve\(selected\.id, caseReference, authority\)/);
  assert.doesNotMatch(page, /stripeAccountId|identityVerificationSessionId|identityVerifiedAt|sessionUrl|reviewNotes|localStorage|sessionStorage|type="file"|type="password"|console\./i);
});
