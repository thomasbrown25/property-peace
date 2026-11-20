import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { transformSync } from 'esbuild';

test('authenticated requests can keep their own organization or opt out of the inherited header', async () => {
  const source = readFileSync(new URL('./axios.js', import.meta.url), 'utf8');
  const { code } = transformSync(source, {
    format: 'cjs',
    define: { 'import.meta.env.VITE_APP_API_URL': '""' }
  });
  const module = { exports: {} };
  const require = createRequire(import.meta.url);
  const imports = {
    store: { getState: () => ({ auth: {} }) },
    'store/user/user.action': {},
    'utils/impersonationSession': {
      getActiveAccessToken: () => null,
      getActiveOrganizationId: () => 99
    },
    'utils/authRequestContext': {}
  };
  new Function('module', 'require', code)(module, (specifier) => imports[specifier] ?? require(specifier));
  const client = module.exports.default;
  const load = (headers) => client.get('/api/lease/tenant/my-leases', {
    headers,
    adapter: async (config) => ({ status: 200, data: config.headers.toJSON(), config })
  });

  assert.equal((await load()).data['X-Organization-Id'], '99');
  assert.equal((await load({ 'X-Organization-Id': '42' })).data['X-Organization-Id'], '42');
  assert.equal((await load({ 'X-Organization-Id': false })).data['X-Organization-Id'], undefined);
});
