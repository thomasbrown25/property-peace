import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../pages/landlord/checklists.jsx', import.meta.url), 'utf8');
const start = page.indexOf('visibleChecklists.map((checklist) =>');
const ledger = page.slice(start, page.indexOf('            })', start));

test('ledger computes status from conditions and progress, not persisted completion flag', () => {
  assert.match(ledger, /const checklistStatus = getChecklistStatus\(checklist\)/);
  assert.match(ledger, /label=\{checklistStatus\.label\}/);
  assert.match(ledger, /color=\{checklistStatus\.color\}/);
  assert.doesNotMatch(ledger, /icon=\{checklist\.isCompleted/);
});

test('progress bar stays brand navy regardless of status while status chip keeps severity color', () => {
  assert.match(ledger, /MuiLinearProgress-bar': \{ borderRadius: 8, bgcolor: '#061E35' \}/);
  assert.doesNotMatch(ledger, /MuiLinearProgress-bar[^\n]*checklistStatus/);
  assert.match(ledger, /label=\{checklistStatus\.label\}/);
  assert.match(ledger, /color=\{checklistStatus\.color\}/);
});

test('ledger displays only checklist type and lease dates in their respective columns', () => {
  assert.match(page, /\['Home', 'Checklist', 'Lease', 'Progress', 'Inspection', 'Status'\]\.map/);
  assert.match(ledger, /const checklistLabel = getChecklistTypeLabel\(checklist\)/);
  assert.doesNotMatch(ledger, /\{checklist\.tenantName \|\| 'No tenant assigned'\}/);
  assert.match(ledger, /\{leaseDates \|\| 'No lease dates'\}/);
  assert.doesNotMatch(ledger, /<CheckCircleOutlined/);
  assert.doesNotMatch(ledger, /<AuditOutlined/);
});
