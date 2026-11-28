export const MOVE_IN_INTENT = 'move-in-checklist';
const INTENT_STORAGE_KEY = 'property-peace:registration-intent';

export function getChecklistIntent(search) {
  return new URLSearchParams(search).get('intent') === MOVE_IN_INTENT ? MOVE_IN_INTENT : null;
}

export function rememberChecklistIntent(search) {
  if (typeof window !== 'undefined' && getChecklistIntent(search)) window.sessionStorage.setItem(INTENT_STORAGE_KEY, MOVE_IN_INTENT);
}

export function readChecklistIntent() {
  return typeof window !== 'undefined' && window.sessionStorage.getItem(INTENT_STORAGE_KEY) === MOVE_IN_INTENT;
}

export function clearChecklistIntent() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
}

export function getSignupDestination() {
  return readChecklistIntent() ? `/landlord/checklists?intent=${MOVE_IN_INTENT}` : '/landlord/dashboard?welcome=signup';
}

export function buildReportPath(report, handoffId) {
  const property = `/landlord/checklists/property/${report.propertyId}`;
  const home = report.unitId ? `${property}/unit/${report.unitId}` : property;
  return `${home}/checklist/${report.id}${handoffId ? `?handoff=${handoffId}` : ''}`;
}

export function buildReportComparisonPath(moveIn, moveOut, unitId = moveIn?.unitId) {
  if (!moveIn?.id || !moveOut?.id || moveIn.id === moveOut.id || Number(moveIn.propertyId) !== Number(moveOut.propertyId)) return null;
  if (moveIn.unitId && moveOut.unitId && Number(moveIn.unitId) !== Number(moveOut.unitId)) return null;
  const property = `/landlord/checklists/property/${moveIn.propertyId}`;
  return `${unitId ? `${property}/unit/${unitId}` : property}/compare/${moveIn.id}/${moveOut.id}`;
}

export function getLegacyReportPhase(type) {
  const key = String(type).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key === '40' || key === 'moveinchecklist') return 'moveIn';
  if (key === '41' || key === 'moveoutchecklist') return 'moveOut';
  return null;
}

export function formatHandoffProgress(items) {
  const total = items.filter((item) => item.status !== 'notApplicable').length;
  const done = items.filter((item) => item.status === 'done').length;
  return { done, total, percent: total ? Math.round(100 * done / total) : 0 };
}

export function handoffTitle(phase) {
  return phase === 'moveOut' ? 'Move-out checklist' : 'Move-in checklist';
}
