export type Audience = 'all' | 'properties' | 'units';
export interface AnnouncementDraft {
  message: string;
  audience: Audience;
  propertyIds: number[];
  unitIds: number[];
  email: boolean;
  notification: boolean;
  schedule: 'now' | 'later';
  scheduledAt: string | null;
}
export const emptyAnnouncementDraft = (): AnnouncementDraft => ({ message: '', audience: 'all', propertyIds: [], unitIds: [], email: false, notification: true, schedule: 'now', scheduledAt: null });
const ids = (value: unknown): number[] => {
  if (value == null) return [];
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error();
    return parsed;
  } catch { throw new Error('Cannot safely restore announcement audience. This announcement cannot be edited on mobile.'); }
};
export function announcementDraftFromDetail(detail: Record<string, unknown>): AnnouncementDraft {
  const get = (key: string) => detail[key] ?? detail[key[0].toUpperCase() + key.slice(1)];
  const propertyIds = ids(get('propertyIds'));
  const unitIds = ids(get('unitIds'));
  const scheduledAt = get('scheduledAt');
  const signature = String(get('createdByName') ?? '').trim();
  const rawMessage = String(get('message') ?? '').trim();
  const suffix = signature ? `\n\nBest regards,\n${signature}` : '';
  const message = suffix && rawMessage.endsWith(suffix) ? rawMessage.slice(0, -suffix.length).trim() : rawMessage;
  return {
    message,
    audience: unitIds.length ? 'units' : propertyIds.length ? 'properties' : 'all',
    propertyIds, unitIds,
    email: Boolean(get('sendAsEmail')), notification: Boolean(get('sendAsNotification')),
    schedule: scheduledAt ? 'later' : 'now', scheduledAt: scheduledAt ? String(scheduledAt) : null,
  };
}
export function validateAnnouncementDraft(draft: AnnouncementDraft, now = new Date()): string[] {
  const errors: string[] = [];
  if (!draft.message.trim()) errors.push('Enter a message.');
  if (draft.audience === 'properties' && !draft.propertyIds.length) errors.push('Choose at least one property.');
  if (draft.audience === 'units' && !draft.unitIds.length) errors.push('Choose at least one unit.');
  if (!draft.email && !draft.notification) errors.push('Choose a delivery method.');
  if (draft.schedule === 'later' && (!draft.scheduledAt || !Number.isFinite(Date.parse(draft.scheduledAt)) || Date.parse(draft.scheduledAt) <= now.getTime())) errors.push('Choose a future schedule time.');
  return errors;
}
export function buildAnnouncementCommand(draft: AnnouncementDraft, id?: number) {
  return {
    organizationIds: null, propertyIds: draft.audience === 'properties' ? draft.propertyIds : null,
    unitIds: draft.audience === 'units' ? draft.unitIds : null,
    message: draft.message.trim(), sendEmail: draft.email, sendNotification: draft.notification,
    scheduledAt: draft.schedule === 'later' ? draft.scheduledAt : null,
    ...(id ? { id } : {}),
  };
}
