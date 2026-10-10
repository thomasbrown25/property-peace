const CONDITIONS = ['Good', 'NC', 'NP', 'NR', 'NSC', 'NSP', 'RP'];

export function countChecklistConditions(items = []) {
  const counts = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));
  for (const item of items) {
    if (Object.hasOwn(counts, item.condition)) counts[item.condition] += 1;
  }
  return counts;
}
