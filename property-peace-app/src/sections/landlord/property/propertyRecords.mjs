import { isDetachedSingleUnitType } from '../../../utils/propertyType.js';
import { statusLabel } from '../../../utils/maintenanceWorkflow.js';

const field = (row, key) => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];

export const maintenanceUnitName = (row, property) => {
  const unitId = field(row, 'unitId');
  const unit = (property?.units || []).find(item => String(field(item, 'id')) === String(unitId));
  return field(unit, 'name') || field(row, 'unitName') || '—';
};

export const maintenancePriority = row => {
  const priority = field(row, 'priority');
  return ['Low', 'Medium', 'High'][priority] || priority || '—';
};

export const maintenanceCreated = row => {
  const value = field(row, 'createdAtUtc') ?? field(row, 'createdAt');
  const date = value && new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '—';
};

export const maintenanceTableColumns = property => [
  { label: 'Request', value: row => field(row, 'title') || `Request #${field(row, 'id')}`, link: row => `/landlord/maintenance/${field(row, 'id')}` },
  ...(!isDetachedSingleUnitType(field(property, 'propertyType')) ? [{ label: 'Unit', value: row => maintenanceUnitName(row, property) }] : []),
  { label: 'Priority', value: maintenancePriority, sx: row => ({ color: String(maintenancePriority(row)).toLowerCase() === 'high' ? 'error.main' : 'text.primary' }) },
  { label: 'Created', value: maintenanceCreated },
  { label: 'Status', value: row => field(row, 'status') ? statusLabel(field(row, 'status')) : '—' }
];

export const scopePropertyRecords = (rows, propertyId) =>
  propertyId == null ? [] : (Array.isArray(rows) ? rows : []).filter(row =>
    String(row.propertyId ?? row.PropertyId ?? '') === String(propertyId));

export const filterPropertyRows = (rows, query, status, searchFields, getStatus) => {
  const needle = String(query || '').trim().toLowerCase();
  return rows.filter(row =>
    (status === 'all' || String(getStatus(row) || '').toLowerCase() === String(status).toLowerCase()) &&
    (!needle || searchFields(row).some(value => String(value ?? '').toLowerCase().includes(needle))));
};
