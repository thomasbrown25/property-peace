import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const filtersDirectory = path.dirname(new URL(import.meta.url).pathname);

describe('TransactionFilterToolbar module resolution', () => {
  it('does not have JavaScript modules with case-insensitive basename collisions', () => {
    const moduleFiles = fs
      .readdirSync(filtersDirectory)
      .filter((file) => /\.(?:js|jsx)$/.test(file) && !file.includes('.test.'));
    const basenames = moduleFiles.map((file) => path.basename(file, path.extname(file)).toLowerCase());

    expect(new Set(basenames).size).toBe(basenames.length);
  });
});
