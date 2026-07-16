import axiosServices from 'utils/axios';

// AI Import Agent
// Uses the backend AI import mapper when available so headers and sample values can be reasoned about,
// then falls back to deterministic local mapping if AI is unavailable.

export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const next = line[i + 1];
      if (c === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < 1) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    rows.push(row);
  }

  return rows;
}

export function normalizeHeader(header = '') {
  return String(header).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function compactHeader(header = '') {
  return normalizeHeader(header).replace(/_/g, '');
}

function scoreHeader(sourceHeader, targetField, aliases = []) {
  const source = normalizeHeader(sourceHeader);
  const sourceCompact = compactHeader(sourceHeader);
  const candidates = [targetField, ...aliases].map((alias) => ({ normalized: normalizeHeader(alias), compact: compactHeader(alias) }));

  for (const candidate of candidates) {
    if (source === candidate.normalized) return 1;
    if (sourceCompact === candidate.compact) return 0.96;
  }

  for (const candidate of candidates) {
    if (source.includes(candidate.normalized) || candidate.normalized.includes(source)) return 0.82;
    if (sourceCompact.includes(candidate.compact) || candidate.compact.includes(sourceCompact)) return 0.78;
  }

  const sourceTokens = new Set(source.split('_').filter(Boolean));
  let bestTokenScore = 0;
  for (const candidate of candidates) {
    const candidateTokens = candidate.normalized.split('_').filter(Boolean);
    if (!candidateTokens.length) continue;
    const matches = candidateTokens.filter((token) => sourceTokens.has(token)).length;
    bestTokenScore = Math.max(bestTokenScore, matches / candidateTokens.length);
  }

  return bestTokenScore >= 0.66 ? Math.min(0.74, bestTokenScore) : 0;
}

export function getRowValue(row, ...keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    for (const header of Object.keys(row)) {
      if (normalizeHeader(header) === normalized) {
        return row[header];
      }
    }
  }
  return '';
}

const FULL_NAME_HEADERS = [
  'full_name',
  'fullname',
  'name',
  'tenant_name',
  'tenant',
  'resident_name',
  'resident',
  'renter_name',
  'occupant_name',
  'applicant_name',
  'contact_name',
  'customer_name'
];

function findValueByHeaderIntent(row, candidates) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const compactCandidates = candidates.map(compactHeader);

  for (const header of Object.keys(row || {})) {
    const normalized = normalizeHeader(header);
    const compact = compactHeader(header);
    if (normalizedCandidates.includes(normalized) || compactCandidates.includes(compact)) {
      return row[header];
    }
  }

  return '';
}

function isFullNameHeader(header) {
  const normalized = normalizeHeader(header);
  const compact = compactHeader(header);
  return FULL_NAME_HEADERS.some((candidate) => normalizeHeader(candidate) === normalized || compactHeader(candidate) === compact);
}

function splitHumanName(value = '') {
  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '')
    .replace(/,?\s+(jr|sr|ii|iii|iv)\.?$/i, '');

  if (!cleaned) return { firstName: '', lastName: '' };

  if (cleaned.includes(',')) {
    const [last, rest] = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
    const restParts = (rest || '').split(' ').filter(Boolean);
    return { firstName: restParts[0] || '', lastName: last || '' };
  }

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function applyDerivedTenantNameFields(mapped, row) {
  const hasTenantNameFields = Object.prototype.hasOwnProperty.call(mapped, 'first_name') && Object.prototype.hasOwnProperty.call(mapped, 'last_name');
  if (!hasTenantNameFields || (String(mapped.first_name || '').trim() && String(mapped.last_name || '').trim())) {
    return mapped;
  }

  const fullName = findValueByHeaderIntent(row, FULL_NAME_HEADERS);
  if (!fullName) return mapped;

  const { firstName, lastName } = splitHumanName(fullName);
  if (!String(mapped.first_name || '').trim() && firstName) mapped.first_name = firstName;
  if (!String(mapped.last_name || '').trim() && lastName) mapped.last_name = lastName;
  return mapped;
}

function transformMappedValue(value, transformation) {
  if (transformation === 'split_first') return splitHumanName(value).firstName;
  if (transformation === 'split_last') return splitHumanName(value).lastName;
  return value ?? '';
}

function buildMappedRowsFromMapping(rows, fieldDefinitions, mapping) {
  const mappedRows = rows.map((row) => {
    const mapped = { __raw: row };
    fieldDefinitions.forEach((field) => {
      const match = mapping[field.key];
      mapped[field.key] = match?.source ? transformMappedValue(row[match.source], match.transformation) : '';
    });
    return applyDerivedTenantNameFields(mapped, row);
  });

  const mappedFields = fieldDefinitions
    .filter((field) => mapping[field.key] || mappedRows.some((row) => String(row[field.key] || '').trim()))
    .map((field) => field.key);
  const unmappedFields = fieldDefinitions
    .filter((field) => field.required && !mappedRows.some((row) => String(row[field.key] || '').trim()))
    .map((field) => field.key);

  return { mappedRows, mappedFields, unmappedFields };
}

export function aiMapCsvRows(rows, fieldDefinitions, { minimumConfidence = 0.66 } = {}) {
  if (!rows?.length) {
    return { rows: [], mapping: {}, unmappedFields: [], mappedFields: [], sourceHeaders: [] };
  }

  const sourceHeaders = Object.keys(rows[0] || {});
  const usedHeaders = new Set();
  const mapping = {};

  fieldDefinitions.forEach((field) => {
    let best = null;
    sourceHeaders.forEach((header) => {
      if (usedHeaders.has(header)) return;
      if ((field.key === 'first_name' || field.key === 'last_name') && isFullNameHeader(header)) return;
      const confidence = scoreHeader(header, field.key, field.aliases || []);
      if (confidence >= minimumConfidence && (!best || confidence > best.confidence)) {
        best = { source: header, confidence, transformation: 'none' };
      }
    });

    if (best) {
      mapping[field.key] = best;
      usedHeaders.add(best.source);
    }
  });

  const { mappedRows, mappedFields, unmappedFields } = buildMappedRowsFromMapping(rows, fieldDefinitions, mapping);

  return { rows: mappedRows, mapping, mappedFields, unmappedFields, sourceHeaders, usedFallback: true };
}

export async function aiMapCsvRowsWithAgent(entityType, rows, fieldDefinitions, options = {}) {
  const fallbackResult = aiMapCsvRows(rows, fieldDefinitions, options);

  if (!rows?.length) return fallbackResult;

  try {
    const sourceHeaders = Object.keys(rows[0] || {});
    const response = await axiosServices.post('/api/ai-import/map-csv', {
      entityType,
      sourceHeaders,
      sampleRows: rows.slice(0, 10),
      expectedFields: fieldDefinitions.map((field) => ({
        key: field.key,
        required: Boolean(field.required),
        aliases: field.aliases || []
      }))
    });

    const aiMappings = response?.data?.data?.mappings || response?.data?.mappings || [];
    if (!aiMappings.length) return fallbackResult;

    const mapping = {};
    aiMappings.forEach((match) => {
      if (!match?.fieldKey || !match?.sourceHeader) return;
      mapping[match.fieldKey] = {
        source: match.sourceHeader,
        confidence: Number(match.confidence || 0),
        transformation: match.transformation || 'none',
        reason: match.reason || ''
      };
    });

    const { mappedRows, mappedFields, unmappedFields } = buildMappedRowsFromMapping(rows, fieldDefinitions, mapping);

    return {
      rows: mappedRows,
      mapping,
      mappedFields,
      unmappedFields,
      sourceHeaders,
      usedAi: true,
      fallback: fallbackResult
    };
  } catch (error) {
    return {
      ...fallbackResult,
      usedFallback: true,
      aiError: error?.response?.data?.message || error?.message || 'AI import mapping unavailable'
    };
  }
}

export const IMPORT_FIELD_DEFINITIONS = {
  tenants: [
    {
      key: 'first_name',
      required: true,
      aliases: ['first', 'first name', 'firstname', 'fname', 'f name', 'given name', 'given', 'tenant first name']
    },
    {
      key: 'last_name',
      required: true,
      aliases: ['last', 'last name', 'lastname', 'lname', 'l name', 'surname', 'family name', 'family', 'tenant last name']
    },
    { key: 'email', required: false, aliases: ['email address', 'e-mail', 'mail', 'tenant email', 'contact email'] },
    { key: 'phone_number', required: false, aliases: ['phone', 'phone number', 'mobile', 'cell', 'cell phone', 'tenant phone', 'telephone'] }
  ],
  properties: [
    { key: 'property_type', required: true, aliases: ['type', 'property type', 'building type', 'home type'] },
    { key: 'property_name', required: false, aliases: ['name', 'property name', 'nickname', 'nick name', 'property nickname'] },
    { key: 'room_rentals', required: false, aliases: ['room rentals', 'room rental', 'rent by room', 'rooms rented', 'shared rooms'] },
    { key: 'street_address', required: true, aliases: ['address', 'street', 'street address', 'property address', 'address 1', 'line 1'] },
    { key: 'city', required: false, aliases: ['city', 'town', 'municipality'] },
    { key: 'state', required: false, aliases: ['state', 'province', 'region'] },
    { key: 'zip_code', required: false, aliases: ['zip', 'zipcode', 'zip code', 'postal code', 'postcode'] },
    { key: 'beds', required: true, aliases: ['bed', 'beds', 'bedrooms', 'br'] },
    { key: 'baths', required: true, aliases: ['bath', 'baths', 'bathrooms', 'ba'] },
    { key: 'square_feet', required: false, aliases: ['sqft', 'sq ft', 'square feet', 'square footage', 'square foot'] },
    { key: 'year_built', required: false, aliases: ['year built', 'built', 'built year', 'construction year'] }
  ],
  vendors: [
    { key: 'name', required: true, aliases: ['vendor', 'vendor name', 'contact name', 'contractor', 'contractor name', 'name'] },
    { key: 'business_name', required: false, aliases: ['business', 'company', 'company name', 'business name', 'organization'] },
    { key: 'email', required: false, aliases: ['email address', 'e-mail', 'vendor email', 'contact email'] },
    { key: 'phone', required: false, aliases: ['phone number', 'mobile', 'cell', 'telephone', 'vendor phone'] },
    { key: 'category', required: false, aliases: ['trade', 'service', 'service type', 'vendor type', 'specialty', 'speciality'] },
    { key: 'address', required: false, aliases: ['street address', 'mailing address', 'address 1', 'street'] },
    { key: 'city', required: false, aliases: ['city', 'town'] },
    { key: 'state', required: false, aliases: ['state', 'province', 'region'] },
    { key: 'zip_code', required: false, aliases: ['zip', 'zipcode', 'zip code', 'postal code', 'postcode'] },
    { key: 'tax_id', required: false, aliases: ['tax id', 'tin', 'ein', 'ssn', 'taxpayer id'] },
    { key: 'license_number', required: false, aliases: ['license', 'license no', 'license number', 'contractor license'] },
    { key: 'requires_1099', required: false, aliases: ['1099', 'requires 1099', 'send 1099', 'needs 1099'] },
    { key: 'notes', required: false, aliases: ['note', 'notes', 'memo', 'description'] }
  ]
};

export function formatMappingSummary(mapping) {
  return Object.entries(mapping || {}).map(([field, match]) => ({
    field,
    source: match.source,
    confidence: Math.round((match.confidence || 0) * 100)
  }));
}
