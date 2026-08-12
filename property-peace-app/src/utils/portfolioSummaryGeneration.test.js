import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { generatePortfolioSummaryItems } from './portfolioSummaryGeneration.js';

test('portfolio summary is deterministic and derived only from scoped summary data', () => {
  const data = {
    rentStatus: { overdue: [{ leaseId: 9, propertyName: 'A', amount: 1200, daysOverdue: 4 }] },
    maintenanceRequests: [{ id: 12, title: 'Leaking sink', priority: 'High', propertyName: 'A' }],
    applications: [{ id: 17, applicantName: 'Taylor Reed', propertyName: 'A', daysPending: 2 }]
  };
  const actions = [
    { action: 'navigateToPage', params: { route: '/landlord/leases/9', leaseId: 9 }, label: 'View overdue lease' },
    { action: 'viewMaintenanceRequest', params: { maintenanceRequestId: 12 }, label: 'View maintenance' },
    { action: 'viewApplication', params: { applicationId: 17 }, label: 'Review application' }
  ];

  const first = generatePortfolioSummaryItems(data, actions);
  assert.deepEqual(generatePortfolioSummaryItems(structuredClone(data), structuredClone(actions)), first);
  assert.deepEqual(first.map(({ priority }) => priority), ['High', 'High', 'Medium']);
  assert.equal(first[0].action.params.leaseId, 9);
  assert.match(first[0].description, /\$1,200/);
});

test('due-soon rent produces an actionable item instead of All Clear', () => {
  const actions = [{
    action: 'navigateToPage',
    params: { route: '/landlord/leases/41', leaseId: 41 },
    label: 'View upcoming rent'
  }];
  const items = generatePortfolioSummaryItems({
    rentStatus: {
      dueSoon: [{
        leaseId: 41,
        propertyName: 'Oak Place',
        unitName: 'Unit 3',
        tenantNames: ['Jordan Lee'],
        amount: 875,
        dueDate: '2026-08-15T00:00:00Z',
        isDueToday: false
      }]
    }
  }, actions);

  assert.equal(items.length, 1);
  assert.doesNotMatch(items[0].title, /All Clear/i);
  assert.match(items[0].title, /Rent due soon/i);
  assert.match(items[0].description, /Jordan Lee/);
  assert.match(items[0].description, /\$875/);
  assert.equal(items[0].action.params.leaseId, 41);
});

test('rent items deterministically attach only their canonical lease navigation actions', () => {
  const lease41 = {
    action: 'navigateToPage',
    params: { route: '/landlord/leases/41', leaseId: 41 },
    label: 'View upcoming rent'
  };
  const lease9 = {
    action: 'navigateToPage',
    params: { route: '/landlord/leases/9', leaseId: 9 },
    label: 'View overdue lease'
  };
  const retiredMutation = {
    action: 'sendRentReminder',
    params: { leaseId: 9 },
    label: 'Message tenant about rent'
  };
  const items = generatePortfolioSummaryItems({
    rentStatus: {
      overdue: [{ leaseId: 9, propertyName: 'A', amount: 1200, daysOverdue: 4 }],
      dueSoon: [{ leaseId: 41, propertyName: 'B', amount: 875 }]
    }
  }, [lease41, retiredMutation, lease9]);

  assert.equal(items.find(({ title }) => title.startsWith('Overdue rent'))?.action, lease9);
  assert.equal(items.find(({ title }) => title.startsWith('Rent due soon'))?.action, lease41);
  assert.equal(items.some(({ action }) => action === retiredMutation), false);
});

test('expiring leases produce source-specific actionable items instead of All Clear', () => {
  const actions = [{
    action: 'navigateToPage',
    params: { route: '/landlord/leases/73', leaseId: 73 },
    label: 'View lease'
  }];
  const items = generatePortfolioSummaryItems({
    leaseExpirations: [{
      id: 73,
      tenantName: 'Morgan Diaz',
      propertyName: 'Pine House',
      unitName: 'A',
      expirationDate: '2026-09-01T00:00:00Z',
      daysUntilExpiration: 21
    }]
  }, actions);

  assert.equal(items.length, 1);
  assert.doesNotMatch(items[0].title, /All Clear/i);
  assert.match(items[0].title, /Lease expires soon/i);
  assert.match(items[0].description, /Morgan Diaz/);
  assert.match(items[0].description, /21 days/);
  assert.equal(items[0].action.params.leaseId, 73);
});

test('important tasks replace duplicate lease and application records without consuming the item cap', () => {
  const fillerTasks = Array.from({ length: 11 }, (_, index) => ({
    type: `Other${index}`,
    description: `Distinct task ${index}`,
    priority: 'Low'
  }));
  const leaseAction = { action: 'navigateToPage', params: { route: '/landlord/leases/73', leaseId: 73 }, label: 'View lease' };
  const applicationAction = { action: 'viewApplication', params: { applicationId: 17 }, label: 'Review application' };
  const items = generatePortfolioSummaryItems({
    leaseExpirations: [{ id: 73, tenantName: 'Morgan Diaz', propertyName: 'Pine House', unitName: 'A', daysUntilExpiration: 21 }],
    applications: [{ id: 17, applicantName: 'Taylor Reed', propertyName: 'Pine House', daysPending: 9 }],
    importantTasks: [
      { type: 'LeaseExpiration', description: 'Lease for Pine House - A expires in 21 days', priority: 'High' },
      { type: 'PendingApplication', description: 'Application from Taylor Reed has been pending for 9 days', priority: 'Low' },
      ...fillerTasks
    ]
  }, [leaseAction, applicationAction]);

  assert.equal(items.length, 12);
  assert.equal(items.filter(({ description }) => /Pine House - A expires/.test(description)).length, 1);
  assert.equal(items.filter(({ description }) => /Taylor Reed has been pending/.test(description)).length, 1);
  assert.equal(items.find(({ description }) => /Taylor Reed/.test(description)).priority, 'Low');
  assert.equal(items.find(({ description }) => /expires in 21 days/.test(description)).action, leaseAction);
  assert.equal(items.find(({ description }) => /Taylor Reed/.test(description)).action, applicationAction);
  assert.equal(items.some(({ description }) => description === 'Distinct task 9'), true);
});

test('lease expiration uses the next matching lease navigation action when rent claims the first', () => {
  const rentNavigation = {
    action: 'navigateToPage',
    params: { route: '/landlord/leases/73', leaseId: 73 },
    label: 'View upcoming rent'
  };
  const viewLease = {
    action: 'navigateToPage',
    params: { route: '/landlord/leases/73', leaseId: 73 },
    label: 'View lease'
  };
  const items = generatePortfolioSummaryItems({
    rentStatus: { dueSoon: [{ leaseId: 73, propertyName: 'Pine House', unitName: 'A', amount: 1200 }] },
    leaseExpirations: [{ id: 73, propertyName: 'Pine House', unitName: 'A', daysUntilExpiration: 21 }],
    importantTasks: [{ type: 'LeaseExpiration', description: 'Pine House - A expires in 21 days', priority: 'High' }]
  }, [rentNavigation, viewLease]);

  assert.equal(items.find(({ title }) => title.startsWith('Rent due soon'))?.action, rentNavigation);
  assert.equal(items.find(({ description }) => /expires in 21 days/.test(description))?.action, viewLease);
});

test('important tasks preserve authoritative priority and claim a matching suggested action only once', () => {
  const action = {
    action: 'navigateToPage',
    params: { route: '/landlord/property/8' },
    label: 'View checklists'
  };
  const items = generatePortfolioSummaryItems({
    importantTasks: [
      { type: 'MissingMoveInChecklist', description: 'Move-in checklist is missing for Pine House - A', priority: 'High' },
      { type: 'OtherChecklistTask', description: 'Another checklist task for Pine House', priority: 'Low' }
    ]
  }, [action]);

  assert.deepEqual(items.map(({ priority }) => priority), ['High', 'Low']);
  assert.equal(items.filter(({ action: itemAction }) => itemAction === action).length, 1);
  assert.equal(items[0].action, action);
});

test('portfolio page does not call chat or build a model prompt', async () => {
  const source = await readFile(new URL('../pages/landlord/portfolio-summary.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /requestPercyCompletion|buildSummaryPrompt|ai-copilot\/chat/);
  assert.doesNotMatch(source, /parseSummaryItems|AI-generated insights|Our AI agent is reviewing|Analyzing your portfolio/);
  assert.match(source, /generatePortfolioSummaryItems/);
});

test('portfolio summary offers application review only and contains no direct approval path', async () => {
  const [pageSource, workflowSource] = await Promise.all([
    readFile(new URL('../pages/landlord/portfolio-summary.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../services/portfolioSummaryWorkflows.js', import.meta.url), 'utf8')
  ]);
  const portfolioSource = `${pageSource}\n${workflowSource}`;

  assert.match(pageSource, /navigateLabel: 'View Application'/);
  assert.doesNotMatch(
    portfolioSource,
    /approvePortfolioApplication|handleApproveInModal|approveLoading|approveState|Approve Application|Application approved successfully|\/application\/\$\{applicationId\}\/approve/
  );
});

test('authoritative summary lifecycle regenerates for each summaryData value and clears item action state', async () => {
  const source = await readFile(new URL('../pages/landlord/portfolio-summary.jsx', import.meta.url), 'utf8');
  const generationEffect = source.match(/\/\/ Regenerate from every authoritative summaryData value[\s\S]*?\}, \[[^\]]+\]\);/)?.[0] ?? '';
  const generateSummary = source.match(/const generateSummary = useCallback\(\(\) => \{[\s\S]*?\}, \[summaryData\]\);/)?.[0] ?? '';

  assert.match(generationEffect, /summaryData/);
  assert.match(generationEffect, /generateSummary\(\)/);
  assert.doesNotMatch(generationEffect, /!generationAttempted/);
  assert.match(generateSummary, /summaryGenerationRef\.current \+= 1/);
  assert.match(generateSummary, /setSummaryItems\(\[\]\)/);
  assert.match(generateSummary, /setActionStates\(\{\}\)/);
  const refreshHandler = source.match(/const handleRefresh = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]+\]\);/)?.[0] ?? '';
  assert.match(refreshHandler, /summaryGenerationRef\.current \+= 1/);
  assert.match(refreshHandler, /scopeGuardRef\.current\.invalidate\(scopeKey\)/);
  assert.match(refreshHandler, /setSummaryItems\(\[\]\)/);
  assert.match(refreshHandler, /setActionStates\(\{\}\)/);
  assert.match(refreshHandler, /setDetailModal\(null\)/);
  assert.doesNotMatch(source, /followUpModal|setFollowUpModal/);
  assert.ok(refreshHandler.indexOf('setSummaryItems([])') < refreshHandler.indexOf('refetch()'));
  assert.match(source, /onClick=\{handleRefresh\}/);
  assert.doesNotMatch(source, /onClick=\{refetch\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => setGenerationAttempted\(false\)\}/);
});

test('every detail dialog body reads only scope-filtered visible state', async () => {
  const source = await readFile(new URL('../pages/landlord/portfolio-summary.jsx', import.meta.url), 'utf8');
  const detailDialog = source.match(/\{\/\* Detail Modal \*\/\}[\s\S]*?<\/Dialog>/)?.[0] ?? '';

  assert.match(detailDialog, /visibleDetailModal/);
  assert.doesNotMatch(detailDialog, /\bdetailModal\.(?:data|item)/);
  assert.doesNotMatch(detailDialog, /\{detailModal &&/);
});
