import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./AuthLogin.jsx', import.meta.url), 'utf8');

test('login heading removes its mobile-only top spacer while preserving larger layouts', () => {
  assert.match(source, /mt:\s*\{\s*xs:\s*0,\s*sm:\s*18,\s*md:\s*0\s*\}/);
});

test('login subtitle is hidden only on mobile', () => {
  assert.match(
    source,
    /variant="body1"\s+sx=\{\{\s*color:\s*'text\.secondary',\s*display:\s*\{\s*xs:\s*'none',\s*sm:\s*'block'\s*\}\s*\}\}/
  );
  assert.match(source, /Where property meets peace of mind\./);
});
