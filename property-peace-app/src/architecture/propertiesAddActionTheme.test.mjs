import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const propertiesPage = new URL('../pages/landlord/properties.jsx', import.meta.url);

test('Properties Add property action uses the shared theme-aware creation style', async () => {
  const source = await readFile(propertiesPage, 'utf8');
  assert.match(source, /import \{ creationActionSx, managementPageHeaderActionSx \} from 'components\/headers\/managementPageHeaderStyles'/);
  assert.match(source, /<Button\s+variant="contained"\s+color="primary"\s+startIcon=\{<PlusOutlined \/>\}\s+onClick=\{\(\) => navigate\('\/landlord\/properties\/add'\)\}\s+sx=\{creationActionSx\}\s*>\s*Add property\s*<\/Button>/);
});
