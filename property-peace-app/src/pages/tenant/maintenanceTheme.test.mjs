import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const maintenance = readFileSync(new URL('./maintenance.jsx', import.meta.url), 'utf8');
const maintenanceDetail = readFileSync(new URL('./maintenance-detail.jsx', import.meta.url), 'utf8');

test('tenant maintenance uses the themed paper table without status or priority columns or chips', () => {
  assert.doesNotMatch(maintenance, /<TableCell[^>]*>(?:Status|Priority)<\/TableCell>|<Maintenance(?:Status|Priority)Chip\b/);
  assert.match(maintenance, /filterControlSx/);
  assert.match(maintenance, /import \{ getPortalListTableSx \} from 'themes\/tableStyles';/);
  assert.match(maintenance, /<Table size="small" sx=\{getPortalListTableSx\}/);
  assert.match(maintenance, /bgcolor: 'background\.paper'/);
  assert.doesNotMatch(maintenance, /boxShadow: \(t\) => `0 0 20px \$\{alpha\(t\.palette\.primary\.main, 0\.15\)\}`/);
});

test('tenant maintenance detail uses shared theme tokens for its state chips', () => {
  assert.match(maintenanceDetail, /theme\.palette\.brand\.mint/);
  assert.match(maintenanceDetail, /getStatusPillSx\(theme, outcomeTone\(item\.outcome\)\)/);
  assert.match(maintenanceDetail, /getStatusPillSx\(theme, slaTone\(ack\.tone\)\)/);
  assert.match(maintenanceDetail, /getStatusPillSx\(theme, slaTone\(action\.tone\)\)/);
});

test('tenant maintenance puts creation in the page header and pages the same filtered rows on desktop and mobile', () => {
  assert.match(maintenance, /<ManagementPageHeader\b[\s\S]*?actions=\{[\s\S]*?<Button[\s\S]*?New request[\s\S]*?<\/Button>/);
  assert.match(maintenance, /<TenantLeaseFilter\b[\s\S]*?aria-label': 'Search maintenance requests'[\s\S]*?aria-label': 'View'[\s\S]*?<MenuItem value="current">Current[\s\S]*?<MenuItem value="history">History/);
  assert.doesNotMatch(maintenance, /<MaintenanceFilter\b|Sort: |All statuses|All priorities/);
  assert.match(maintenance, /paginateRows\(sorted, page, pageSize\)/);
  assert.equal((maintenance.match(/visibleRows\.map\(/g) || []).length, 2);
  assert.match(maintenance, /<PortalListPagination\b/);
});
