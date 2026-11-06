type RecordRow = Record<string, any>;

export const recordValue = (row: RecordRow, key: string): any => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];
export const sameProperty = (left: unknown, right: unknown): boolean => left != null && right != null && String(left) === String(right);

/** Never trust a global list or query filter without checking each row's property ID. */
export const scopePropertyRows = <T extends RecordRow>(rows: T[], propertyId: string): T[] =>
  rows.filter(row => sameProperty(recordValue(row, 'propertyId'), propertyId));

/** Property endpoint is server-scoped; preserve its scope only when the row does not contradict it. */
export const scopePropertyEndpointRows = <T extends RecordRow>(rows: T[], propertyId: string): T[] =>
  rows.filter(row => recordValue(row, 'propertyId') == null || sameProperty(recordValue(row, 'propertyId'), propertyId))
    .map(row => ({ ...row, propertyId }));
