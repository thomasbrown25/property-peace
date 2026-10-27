// Use the same lease balances that contribute to the dashboard's portfolio overdue total.
export function propertyOverdueAmounts(payload: any): Map<string, number> | null {
  const summary = payload?.summary ?? payload?.Summary;
  const records = payload?.rentRecords ?? payload?.RentRecords;
  const total = summary?.overdue ?? summary?.Overdue;
  if (!Array.isArray(records) || typeof total !== 'number' || !Number.isFinite(total) || total < 0) return null;

  const centsByProperty = new Map<string, number>();
  let totalCents = 0;
  for (const record of records) {
    const id = record?.propertyId ?? record?.PropertyId;
    const amount = record?.overdueAmount ?? record?.OverdueAmount;
    if (id === undefined || id === null || String(id) === '' || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
    const cents = Math.round(amount * 100);
    const key = String(id);
    centsByProperty.set(key, (centsByProperty.get(key) ?? 0) + cents);
    totalCents += cents;
  }
  if (totalCents !== Math.round(total * 100)) return null;
  return new Map([...centsByProperty].map(([id, cents]) => [id, cents / 100]));
}
