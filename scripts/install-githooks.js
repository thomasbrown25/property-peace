#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const src = path.join(repoRoot, '.githooks', 'pre-push');
const dest = path.join(repoRoot, '.git', 'hooks', 'pre-push');

fs.copyFileSync(src, dest);
fs.chmodSync(dest, 0o755);
console.log('Pre-push hook installed. Pushes to prod will now require successful builds.');
