const categoryRules = [
  // Explicit business categories and work context take precedence over broad
  // utility words (for example, "gas furnace repair" is not a gas bill).
  ['Water tank', /\bwater\s+tank\b/i],
  ['Car Rental', /\b(?:car|vehicle|auto)\s+rental\b|\brental\s+(?:car|vehicle)\b/i],
  ['Repairs', /\brepair(?:s|ed|ing)?\b|\bfix(?:ed|ing)?\b/i],
  ['Utilities', /\butility|\b(?:electric(?:ity)?|water|gas|internet|sewer|trash)\s+(?:bill|service|charge|payment)\b/i],
  ['Maintenance', /\bmaintenance\b|\b(?:plumb(?:er|ing)?|electrician|electrical\s+work|hvac|appliance|roof(?:er|ing)?|paint(?:er|ing)?)\b/i],
  ['HOA', /\b(?:hoa|homeowners? association|condo association)(?:\s+(?:fee|fees|dues|assessment))?\b/i],
  ['Landscaping', /\b(?:landscap|lawn|yard care|groundskeep|tree service)/i],
  ['Cleaning', /\b(?:cleaning|cleaner|janitorial|maid service)/i],
  ['Property Management', /\b(?:property management|management fee|property manager)/i],
  ['Capital Improvements', /\b(?:capital improvement|renovation|remodel|major upgrade)/i],
  ['Application Fee', /\b(?:rental )?application fee\b/i],
  ['Screening', /\b(?:tenant |background |credit )?screening\b|\bbackground check\b/i],
  ['Insurance', /insurance|premium/i],
  ['Taxes', /property tax|tax bill/i],
  ['Legal', /legal|attorney/i],
  ['Accounting', /account|bookkeep/i],
  ['Advertising', /advertis|listing|marketing/i],
  ['Supplies', /supply|supplies|hardware|material/i],
  ['Auto & Travel', /mileage|travel|hotel|flight/i]
];

/** Categorize locally without sending expense data or credentials to a third party. */
export function categorizeExpense(description = '') {
  const normalized = description.trim();
  const category = categoryRules.find(([, pattern]) => pattern.test(normalized))?.[0] ?? 'Other';
  return {
    category,
    name: normalized.length > 50 ? normalized.slice(0, 50) : normalized
  };
}
