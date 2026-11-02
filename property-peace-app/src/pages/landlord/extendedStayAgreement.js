const iso = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const validDay = (day) => iso.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) &&
  new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

export const agreementPath = (unitId) => `/api/short-stay/units/${encodeURIComponent(unitId)}/extended-stay-agreements`;
export function agreementDraft(startDate, endDate, occupantName) {
  if (!validDay(startDate) || !validDay(endDate) || startDate >= endDate ||
      !occupantName?.trim() || occupantName.trim().length > 200) {
    throw new Error('Enter a name and valid local dates; end must be after start.');
  }
  return { startDate, endDate, occupantName: occupantName.trim() };
}
