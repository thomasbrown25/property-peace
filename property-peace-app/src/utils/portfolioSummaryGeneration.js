const money = (value) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
  : 'an outstanding balance';

const item = (title, priority, description, action, source = null) => ({
  title,
  priority,
  description,
  action: action ?? null,
  source
});
const actionFor = (actions, type, idName, id) => actions.find((candidate) =>
  candidate.action === type && (id === undefined || candidate.params?.[idName] === id)
) ?? null;
const date = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};
const text = (value) => String(value ?? '').toLowerCase();
const priority = (value) => {
  const normalized = text(value);
  if (normalized === 'high') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Medium';
};

function sourceDuplicatesTask(source, task) {
  const description = text(task.description);
  if (task.type === 'LeaseExpiration' && source.type === 'leaseExpiration') {
    const property = text(source.value.propertyName);
    const unit = text(source.value.unitName);
    return Boolean(property && description.includes(unit ? `${property} - ${unit}` : property));
  }
  if (task.type === 'PendingApplication' && source.type === 'application') {
    return Boolean(source.value.applicantName && description.includes(text(source.value.applicantName)));
  }
  return false;
}

function actionMatchesTask(action, task) {
  const actionText = text([
    action.action,
    action.label,
    action.tooltip,
    action.params?.actionType,
    action.params?.route
  ].join(' '));
  switch (task.type) {
    case 'LeaseExpiration':
      return actionText.includes('lease');
    case 'PendingApplication':
      return actionText.includes('application');
    case 'UnsignedLease':
      return actionText.includes('lease') && actionText.includes('sign');
    case 'TenantAccountCreation':
      return actionText.includes('tenantaccount') || actionText.includes('account');
    case 'UnpaidDeposit':
      return actionText.includes('deposit') || actionText.includes('tenant info');
    case 'IncompleteMoveInChecklist':
    case 'MissingMoveInChecklist':
    case 'IncompleteMoveOutChecklist':
    case 'MissingMoveOutChecklist':
      return actionText.includes('checklist');
    default:
      return false;
  }
}

/**
 * Builds read-only portfolio insights from the already authenticated,
 * organization-scoped summary response. No model, prompt, or network call occurs.
 */
export function generatePortfolioSummaryItems(data, actions = []) {
  if (!data) return [];
  const items = [];
  const claimedActions = new Set();
  const claim = (action) => {
    if (!action || claimedActions.has(action)) return null;
    claimedActions.add(action);
    return action;
  };
  const claimLeaseNavigation = (leaseId) => claim(actions.find((candidate) =>
    !claimedActions.has(candidate)
    && candidate.action === 'navigateToPage'
    && (candidate.params?.leaseId === leaseId || candidate.params?.route === `/landlord/leases/${leaseId}`)
  ) ?? null);

  for (const rent of data.rentStatus?.overdue ?? []) {
    items.push(item(
      `Overdue rent — ${rent.propertyName || 'property'}`,
      'High',
      `${money(rent.amount)} is ${rent.daysOverdue ?? 0} day${rent.daysOverdue === 1 ? '' : 's'} overdue${rent.unitName ? ` for ${rent.unitName}` : ''}.`,
      claimLeaseNavigation(rent.leaseId),
      { type: 'overdueRent', value: rent }
    ));
  }

  for (const rent of data.rentStatus?.dueSoon ?? []) {
    const tenantNames = rent.tenantNames?.filter(Boolean).join(' and ');
    const dueDate = date(rent.dueDate);
    items.push(item(
      `${rent.isDueToday ? 'Rent due today' : 'Rent due soon'} — ${rent.propertyName || 'property'}`,
      rent.isDueToday ? 'High' : 'Medium',
      `${money(rent.amount)} is ${rent.isDueToday ? 'due today' : 'due soon'}${tenantNames ? ` from ${tenantNames}` : ''}${rent.unitName ? ` for ${rent.unitName}` : ''}${dueDate ? ` on ${dueDate}` : ''}.`,
      claimLeaseNavigation(rent.leaseId),
      { type: 'dueSoonRent', value: rent }
    ));
  }

  for (const lease of data.leaseExpirations ?? []) {
    const expirationDate = date(lease.expirationDate);
    const days = lease.daysUntilExpiration;
    items.push(item(
      `Lease expires soon — ${lease.propertyName || 'property'}`,
      Number.isFinite(Number(days)) && Number(days) <= 30 ? 'High' : 'Medium',
      `${lease.tenantName || 'A tenant'}'s lease${lease.unitName ? ` for ${lease.unitName}` : ''} expires${expirationDate ? ` on ${expirationDate}` : ' soon'}${days != null ? ` (${days} day${days === 1 ? '' : 's'} remaining)` : ''}.`,
      claimLeaseNavigation(lease.id),
      { type: 'leaseExpiration', value: lease }
    ));
  }

  for (const request of data.maintenanceRequests ?? []) {
    const normalized = text(request.priority);
    items.push(item(
      request.title || 'Maintenance request',
      normalized === 'high' || normalized === 'emergency' || normalized === 'urgent' ? 'High' : 'Medium',
      `${request.propertyName || 'A property'} has an open maintenance request${request.daysOpen != null ? ` for ${request.daysOpen} days` : ''}.`,
      claim(actionFor(actions, 'viewMaintenanceRequest', 'maintenanceRequestId', request.id)),
      { type: 'maintenance', value: request }
    ));
  }

  for (const application of data.applications ?? []) {
    items.push(item(
      `Review ${application.applicantName || 'pending application'}`,
      application.daysPending >= 7 ? 'High' : 'Medium',
      `Application pending${application.propertyName ? ` for ${application.propertyName}` : ''}${application.daysPending != null ? ` for ${application.daysPending} days` : ''}.`,
      claim(actionFor(actions, 'viewApplication', 'applicationId', application.id)),
      { type: 'application', value: application }
    ));
  }

  for (const task of data.importantTasks ?? []) {
    const duplicateIndex = items.findIndex((entry) => entry.source && sourceDuplicatesTask(entry.source, task));
    if (duplicateIndex >= 0) {
      const existing = items[duplicateIndex];
      items[duplicateIndex] = item(
        existing.title,
        priority(task.priority),
        task.description || existing.description,
        existing.action,
        { type: 'importantTask', value: task }
      );
      continue;
    }

    const taskAction = claim(actions.find((candidate) => actionMatchesTask(candidate, task)) ?? null);
    items.push(item(
      task.title || 'Important task',
      priority(task.priority),
      task.description || 'This portfolio task needs attention.',
      taskAction,
      { type: 'importantTask', value: task }
    ));
  }

  for (const message of data.urgentMessages ?? []) {
    const action = claim(actions.find((candidate) => {
      const params = candidate.params ?? {};
      return params.urgentMessage?.conversationId === message.conversationId
        || params.route?.includes(`conversation=${message.conversationId}`);
    }));
    items.push(item(
      message.tenantName ? `Urgent message from ${message.tenantName}` : 'Urgent tenant message',
      'High',
      message.aiSummary || message.urgentItems?.[0]?.description || 'An urgent tenant message needs review.',
      action,
      { type: 'urgentMessage', value: message }
    ));
  }

  if (items.length === 0) {
    return [{
      title: 'All Clear!',
      priority: 'Low',
      description: 'You have no overdue payments, pending maintenance requests, applications, or urgent tasks requiring attention.',
      action: null
    }];
  }

  const order = { High: 0, Medium: 1, Low: 2 };
  return items
    .sort((left, right) => order[left.priority] - order[right.priority])
    .slice(0, 12)
    .map(({ source, ...entry }, index) => ({ number: index + 1, ...entry }));
}
