import { setupError } from '../../utils/shortStaySetup.js';

export const EMPTY_GUIDEBOOK = { houseRules: '', arrivalOverview: '', localNotes: '' };
const fields = Object.keys(EMPTY_GUIDEBOOK);
const sensitive = /\b(?:wi[ -]?fi|password|passcode|pin|access[ -]?code|door[ -]?code|lockbox|keypad|security[ -]?code|entry[ -]?code|secret|credential)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?\d[\d ().-]{7,}\d)\b/i;
const html = /<\s*\/?\s*[a-z][^>]*>/i;

export function guidebookPayload(draft) {
  const body = {};
  for (const key of fields) {
    const value = draft?.[key] ?? '';
    if (typeof value !== 'string' || value.length > 2000) throw new Error('Each guidebook field must be plain text of at most 2000 characters.');
    if (sensitive.test(value) || html.test(value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value))
      throw new Error('Use public-safe plain text without access codes, credentials or contact details.');
    body[key] = value;
  }
  return body;
}

// A controller belongs to one mounted unit route. Invalidating it prevents old requests from updating a new route.
export function createGuidebookDraft({ api, unitId, update }) {
  let active = false;
  let revision = 0;
  let loaded = false;
  let exists = false;
  let busy = false;
  const valid = (token) => active && revision === token;
  const activate = () => { active = true; revision++; };
  const invalidate = () => { active = false; revision++; loaded = false; exists = false; busy = false; };
  const checkUnit = (result) => {
    if (result != null && String(result.unitId) !== String(unitId)) throw new Error('Guidebook response does not match this unit.');
    return result;
  };
  const load = async () => {
    if (!active || busy) return;
    const token = ++revision;
    loaded = false;
    exists = false;
    update({ loading: true, error: '', notice: '', draft: null, exists: false });
    try {
      const result = checkUnit(await api.getGuidebookDraft(unitId));
      if (valid(token)) {
        loaded = true;
        exists = result != null;
        update({ draft: { ...EMPTY_GUIDEBOOK, ...guidebookPayload(result) }, exists });
      }
    } catch (err) { if (valid(token)) update({ error: setupError(err) }); }
    finally { if (valid(token)) update({ loading: false }); }
  };
  const save = async (draft) => {
    if (!active || !loaded || busy) return;
    const token = ++revision;
    busy = true;
    update({ busy: true, error: '', notice: '' });
    try {
      const result = checkUnit(await api.saveGuidebookDraft(unitId, guidebookPayload(draft)));
      if (result === null || result === undefined) throw new Error('Guidebook save returned no draft. Retry saving.');
      if (valid(token)) {
        exists = true;
        update({ draft: { ...EMPTY_GUIDEBOOK, ...guidebookPayload(result) }, exists: true, notice: 'Private guidebook draft saved.' });
      }
    } catch (err) { if (valid(token)) update({ error: setupError(err) }); }
    finally { if (valid(token)) { busy = false; update({ busy: false }); } }
  };
  const discard = async () => {
    if (!active || !loaded || !exists || busy) return;
    const token = ++revision;
    busy = true;
    update({ busy: true, error: '', notice: '' });
    try {
      await api.deleteGuidebookDraft(unitId);
      if (valid(token)) {
        exists = false;
        update({ draft: { ...EMPTY_GUIDEBOOK }, exists: false, notice: 'Private guidebook draft discarded.' });
      }
    } catch (err) { if (valid(token)) update({ error: setupError(err) }); }
    finally { if (valid(token)) { busy = false; update({ busy: false }); } }
  };
  return { activate, invalidate, load, save, discard };
}
