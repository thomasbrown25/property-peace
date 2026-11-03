export type PropertyCollection = { propertyId: string; expected: number; collected: number; overdue: number };

// The portfolio response includes one record per lease. Sum only the current month's
// allocated rent credits, not lifetime payments or cash received for an older period.
export function propertyCollection(payload: any): Map<string, PropertyCollection> | null {
  const records = payload?.rentRecords ?? payload?.RentRecords;
  if (!Array.isArray(records)) return null;
  const result = new Map<string, PropertyCollection>();
  for (const record of records) {
    const rawId = record?.propertyId ?? record?.PropertyId;
    const expected = record?.currentMonthExpected ?? record?.CurrentMonthExpected;
    const collected = record?.currentMonthCollected ?? record?.CurrentMonthCollected;
    const overdue = record?.overdueAmount ?? record?.OverdueAmount;
    if (rawId == null || String(rawId) === '' ||
        ![expected, collected, overdue].every(amount => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0)) return null;
    const propertyId = String(rawId);
    const previous = result.get(propertyId) ?? { propertyId, expected: 0, collected: 0, overdue: 0 };
    result.set(propertyId, {
      propertyId,
      expected: previous.expected + expected,
      collected: previous.collected + collected,
      overdue: previous.overdue + overdue,
    });
  }
  return result;
}
