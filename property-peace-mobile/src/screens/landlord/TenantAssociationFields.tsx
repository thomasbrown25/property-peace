import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import PropertyAPI, { type Property, type Unit } from '../../api/propertyAPI';
import type { TenantForm } from '../../features/tenants/tenantForm';
import { useAppTheme } from '../../theme/AppTheme';

const idOf = (item: Record<string, any>): number | null => {
  const id = Number(item.id ?? item.Id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
export default function TenantAssociationFields({ form, onChange, onReadyChange, disabled = false }: { form: TenantForm; onChange: (change: Partial<TenantForm>) => void; onReadyChange?: (ready: boolean) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState('');
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [unitLoading, setUnitLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPropertyLoading(true);
    PropertyAPI.getProperties().then(result => { if (active) setProperties(result); })
      .catch(() => { if (active) setError('Could not load properties.'); })
      .finally(() => { if (active) setPropertyLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    setUnits([]);
    if (form.propertyId == null) { setUnitLoading(false); return () => { active = false; }; }
    setUnitLoading(true);
    PropertyAPI.getUnits(form.propertyId).then(result => { if (active) setUnits(result); })
      .catch(() => { if (active) setError('Could not load units.'); })
      .finally(() => { if (active) setUnitLoading(false); });
    return () => { active = false; };
  }, [form.propertyId, retry]);
  const unit = units.find(item => idOf(item) === form.unitId);
  const loading = propertyLoading || unitLoading;
  const ready = !loading && !error && (form.propertyId == null || properties.some(item => idOf(item) === form.propertyId))
    && (form.unitId == null || !!unit);
  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);
  const leases = [...(unit?.leases ?? unit?.Leases ?? []), ...(unit?.lease ?? unit?.Lease ? [unit?.lease ?? unit?.Lease] : [])]
    .filter((item, index, all) => idOf(item) && !item.isDeleted && !item.IsDeleted && all.findIndex(other => idOf(other) === idOf(item)) === index);
  const option = (label: string, selected: boolean, action: () => void) => <TouchableOpacity key={label} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: disabled || loading || !!error }} disabled={disabled || loading || !!error} onPress={action}
    style={{ padding: 12, borderWidth: 1, borderRadius: 10, borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface, marginBottom: 7 }}><Text style={{ color: colors.text }}>{label}</Text></TouchableOpacity>;
  return <View>
    <Text style={{ color: colors.text, fontWeight: '700', marginTop: 12, marginBottom: 8 }}>Property & unit</Text>
    {!!error && <TouchableOpacity onPress={() => { setError(''); setRetry(value => value + 1); }} accessibilityRole="button"><Text style={{ color: '#c33232' }}>{error} Tap to retry.</Text></TouchableOpacity>}
    {!loading && !error && !ready && <Text accessibilityRole="alert" style={{ color: '#c33232' }}>The selected property or unit is unavailable. Choose a valid association before saving.</Text>}
    {loading && <ActivityIndicator color={colors.accent} />}
    {option('No property / unit', form.propertyId == null && form.unitId == null, () => onChange({ propertyId: null, unitId: null, leaseId: null }))}
    {properties.map(property => { const id = idOf(property); return id ? option(String(property.name ?? property.Name ?? property.streetAddress ?? `Property ${id}`), form.propertyId === id, () => { setError(''); onChange({ propertyId: id, unitId: null, leaseId: null }); }) : null; })}
    {form.propertyId != null && <><Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Unit</Text>
      {units.map(item => { const id = idOf(item); return id ? option(String(item.name ?? item.Name ?? `Unit ${id}`), form.unitId === id, () => onChange({ unitId: id, leaseId: null })) : null; })}
      {!loading && !units.length && !error && <Text style={{ color: colors.muted }}>No units available for this property.</Text>}
    </>}
    {form.unitId != null && <><Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Lease (optional)</Text>
      {option('Use current unit lease (if any)', form.leaseId == null, () => onChange({ leaseId: null }))}
      {form.leaseId != null && !leases.some(item => idOf(item) === form.leaseId) && <Text style={{ color: colors.muted }}>Existing lease #{form.leaseId} will be preserved unless you choose another.</Text>}
      {leases.map(item => { const id = idOf(item); return id ? option(`Lease #${id}${item.startDate ? ` · ${String(item.startDate).slice(0, 10)}` : ''}`, form.leaseId === id, () => onChange({ leaseId: id })) : null; })}
      {!leases.length && <Text style={{ color: colors.muted }}>No leases available for this unit.</Text>}
    </>}
  </View>;
}
