import type { Checklist } from './checklistTypes';

export interface ChecklistFormDraft {
  title: string;
  inspectionDate: string;
  generalNotes: string;
  conditionNotes: string;
}

// Show the visit in device local time, not UTC; users enter YYYY-MM-DD HH:mm.
export const inspectionDateDraft = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const parseInspectionDateDraft = (value: string): string | null => {
  if (!value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, h, minute] = match.map(Number);
  const date = new Date(y, m - 1, d, h, minute);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date.getHours() !== h || date.getMinutes() !== minute) return null;
  return date.toISOString();
};

export const checklistFormDraft = (checklist: Checklist): ChecklistFormDraft => ({
  title: checklist.title ?? '',
  inspectionDate: inspectionDateDraft(checklist.inspectionDate),
  generalNotes: checklist.generalNotes ?? '',
  conditionNotes: checklist.conditionNotes ?? '',
});

export const applyChecklistFormDraft = (checklist: Checklist, draft: ChecklistFormDraft): Checklist => {
  if (!draft.title.trim()) throw new Error('Checklist title is required');
  // The backend treats a null update date as "leave unchanged", not "clear".
  if (checklist.inspectionDate && !draft.inspectionDate.trim()) throw new Error('Cannot clear a scheduled visit date');
  const inspectionDate = parseInspectionDateDraft(draft.inspectionDate);
  if (draft.inspectionDate.trim() && !inspectionDate) throw new Error('Choose a valid visit date and time (YYYY-MM-DD HH:mm)');
  return {
    ...checklist,
    title: draft.title.trim(),
    inspectionDate,
    generalNotes: draft.generalNotes.trim(),
    conditionNotes: draft.conditionNotes.trim(),
  };
};
