import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;
const forbiddenPackageImports = new Set(['openai', '@azure/openai']);
const forbiddenLegacyModulePattern = /(?:^|\/)(?:services\/)?(?:azureAIService|commandParser|copilotActions)(?:\.[cm]?[jt]sx?)?$/;
const browserCredentialPattern = /^(?:(?:VITE|REACT_APP|NEXT_PUBLIC|PUBLIC)_)?(?:AZURE_)?OPENAI_(?:API_)?(?:KEY|TOKEN|SECRET)$/;

async function productionSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(absolutePath);
    if (!productionExtensions.has(path.extname(entry.name)) || testFilePattern.test(entry.name)) return [];
    return [absolutePath];
  }));
  return nested.flat();
}

function tokenizeJavaScript(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      index = source.indexOf('\n', index + 2);
      if (index === -1) break;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      const quote = character;
      let value = '';
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') {
          value += source[index + 1] ?? '';
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          break;
        }
        value += source[index];
        index += 1;
      }
      tokens.push({ type: 'string', value });
      continue;
    }

    if (/[A-Za-z_$]/.test(character)) {
      const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/)[0];
      tokens.push({ type: 'identifier', value: identifier });
      index += identifier.length;
      continue;
    }

    tokens.push({ type: 'punctuation', value: character });
    index += 1;
  }

  return tokens;
}

function forbiddenModuleLabel(moduleName) {
  if ([...forbiddenPackageImports].some((packageName) => moduleName === packageName || moduleName.startsWith(`${packageName}/`))) return moduleName;
  if (forbiddenLegacyModulePattern.test(moduleName)) return moduleName;
  return null;
}

function findForbiddenPercyUsage(source) {
  const tokens = tokenizeJavaScript(source);
  const violations = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === 'identifier' && browserCredentialPattern.test(token.value)) {
      violations.add(token.value);
    }
    if (token.type === 'identifier' && token.value === 'dangerouslyAllowBrowser') {
      violations.add(token.value);
    }

    // Also catch computed env access such as import.meta.env['VITE_OPENAI_API_KEY'].
    if (
      token.type === 'string'
      && browserCredentialPattern.test(token.value)
      && tokens[index - 1]?.value === '['
      && tokens[index + 1]?.value === ']'
    ) {
      violations.add(token.value);
    }

    if (token.type !== 'identifier' || !['import', 'export', 'require'].includes(token.value)) continue;

    if ((token.value === 'import' || token.value === 'require') && tokens[index + 1]?.value === '(') {
      const moduleName = tokens[index + 2]?.type === 'string' ? tokens[index + 2].value : null;
      const label = moduleName && forbiddenModuleLabel(moduleName);
      if (label) violations.add(label);
      continue;
    }

    // Static imports/exports either contain `from "module"` or are side-effect imports.
    if (token.value === 'import' && tokens[index + 1]?.type === 'string') {
      const label = forbiddenModuleLabel(tokens[index + 1].value);
      if (label) violations.add(label);
      continue;
    }

    for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].value !== ';'; cursor += 1) {
      if (tokens[cursor].value !== 'from' || tokens[cursor + 1]?.type !== 'string') continue;
      const label = forbiddenModuleLabel(tokens[cursor + 1].value);
      if (label) violations.add(label);
      break;
    }
  }

  return [...violations];
}

test('browser Percy detector rejects every server-only OpenAI access form and browser credential marker', () => {
  const fixtures = [
    ["import OpenAI from 'openai';", 'openai'],
    ["import Responses from 'openai/resources/responses';", 'openai/resources/responses'],
    ['import { OpenAIClient } from "@azure/openai";', '@azure/openai'],
    ['export { AzureKeyCredential } from "@azure/openai/auth";', '@azure/openai/auth'],
    ["const sdk = await import('openai');", 'openai'],
    ["const sdk = await import('openai/client.mjs');", 'openai/client.mjs'],
    ['const sdk = import("@azure/openai");', '@azure/openai'],
    ['const sdk = import("@azure/openai/models");', '@azure/openai/models'],
    ["const sdk = require('openai');", 'openai'],
    ["const sdk = require('openai/core');", 'openai/core'],
    ['const sdk = require("@azure/openai");', '@azure/openai'],
    ['const sdk = require("@azure/openai/api");', '@azure/openai/api'],
    ["import actions from '../services/copilotActions';", '../services/copilotActions'],
    ["const parser = require('./commandParser');", './commandParser'],
    ['const key = import.meta.env.VITE_OPENAI_API_KEY;', 'VITE_OPENAI_API_KEY'],
    ['const key = import.meta.env.VITE_AZURE_OPENAI_API_KEY;', 'VITE_AZURE_OPENAI_API_KEY'],
    ['const key = process.env.REACT_APP_OPENAI_API_KEY;', 'REACT_APP_OPENAI_API_KEY'],
    ['const key = process.env.NEXT_PUBLIC_AZURE_OPENAI_KEY;', 'NEXT_PUBLIC_AZURE_OPENAI_KEY'],
    ['const key = OPENAI_API_KEY;', 'OPENAI_API_KEY'],
    ["const key = import.meta.env['VITE_AZURE_OPENAI_API_TOKEN'];", 'VITE_AZURE_OPENAI_API_TOKEN'],
    ['const client = new OpenAI({ dangerouslyAllowBrowser: true });', 'dangerouslyAllowBrowser']
  ];

  for (const [source, expectedMarker] of fixtures) {
    assert.ok(
      findForbiddenPercyUsage(source).some((violation) => violation.includes(expectedMarker)),
      `Expected detector to reject: ${source}`
    );
  }
});

test('browser Percy detector ignores documentation comments, ordinary strings, and test-like prose', () => {
  const safeFixture = `
    // import OpenAI from 'openai';
    /* require('@azure/openai');
       VITE_OPENAI_API_KEY */
    const migrationNote = "Remove the old openai browser import and VITE_AZURE_OPENAI_API_KEY";
    const dynamicImportFixture = "import('openai')";
    const requireFixture = "require('@azure/openai')";
    const endpoint = 'https://example.test/openai';
  `;

  assert.deepEqual(findForbiddenPercyUsage(safeFixture), []);
});

test('production web source cannot import legacy browser-side Percy orchestration', async () => {
  const violations = [];
  for (const file of await productionSourceFiles(srcRoot)) {
    const source = await readFile(file, 'utf8');
    for (const marker of findForbiddenPercyUsage(source)) {
      violations.push(`${path.relative(srcRoot, file)} -> ${marker}`);
    }
  }

  assert.deepEqual(violations, [], `Forbidden browser Percy usage found:\n${violations.join('\n')}`);
});

test('App does not globally mount the legacy AI Copilot provider', async () => {
  const appSource = await readFile(path.join(srcRoot, 'App.jsx'), 'utf8');
  assert.doesNotMatch(appSource, /AICopilotContext|AICopilotProvider/);
});

test('Percy workflow surfaces do not bypass the action policy with direct mutations', async () => {
  const forbiddenByFile = new Map([
    ['pages/landlord/portfolio-summary.jsx', /sendPortfolioFollowUp|previewAIFollowUp|handleFollowUpSend|openMaintenanceDrawer|handleDrawerAction|API_ACTIONS/],
    ['services/portfolioSummaryWorkflows.js', /aiFollowUpAPI|axiosServices|prepareMaintenanceFromUrgent|sendPortfolioFollowUp|sendRentReminder|createMaintenanceFromUrgent/],
    ['pages/landlord/collections-agent.jsx', /runOverdueRentSweep|force-followup|updateAgentSettings|handleRun|handleToggle/],
    ['pages/landlord/maintenance-agent.jsx', /updateAgentSettings|handleToggle/],
    ['pages/landlord/ai-center.jsx', /updateAgentSettings|updateWorkflowSettings/]
  ]);

  for (const [relativePath, forbidden] of forbiddenByFile) {
    const source = await readFile(path.join(srcRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, forbidden, `${relativePath} contains a direct mutation bypass`);
  }
});

test('AI Center has no hard-coded live or tool-count readiness claims', async () => {
  const source = await readFile(path.join(srcRoot, 'pages/landlord/ai-center.jsx'), 'utf8');
  assert.doesNotMatch(source, /label=["']Live["']|tools:\s*\d+|<ConnectionRow[\s\S]*?title=["']Built-in tools["'][\s\S]*?\bactive\s*\/?\s*>/);
});

test('orphan browser prompt orchestration is removed', async () => {
  await assert.rejects(readFile(path.join(srcRoot, 'services/copilotPrompts.js'), 'utf8'), { code: 'ENOENT' });
});
