import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import PropertyAPI, { type Property, type Unit } from '../../api/propertyAPI';
import { useAppTheme } from '../../theme/AppTheme';

const idOf = (item: Property | Unit) => item.id ?? item.Id;
export const multiUnit = (property?: Property) => ['multiunit', 'multifamily'].includes(String(property?.propertyType ?? property?.PropertyType ?? '').toLowerCase());
export function PropertyUnitPicker({ propertyId, unitId, onChange, disabled = false }: { propertyId: number | null; unitId: number | null; onChange: (propertyId: number | null, unitId: number | null, property?: Property) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const propertyGeneration = useRef(0);
  const unitGeneration = useRef(0);
  useEffect(() => {
    const request = ++propertyGeneration.current;
    PropertyAPI.getProperties().then(result => { if (request === propertyGeneration.current) setProperties(result); })
      .catch(() => { if (request === propertyGeneration.current) setError('Could not load properties.'); })
      .finally(() => { if (request === propertyGeneration.current) setLoading(false); });
    return () => { propertyGeneration.current++; };
  }, []);
  useEffect(() => {
    const request = ++unitGeneration.current;
    setUnits([]);
    if (propertyId == null) return;
    PropertyAPI.getUnits(propertyId).then(result => { if (request === unitGeneration.current) setUnits(result); })
      .catch(() => { if (request === unitGeneration.current) setError('Could not load units. Choose the property again.'); });
    return () => { unitGeneration.current++; };
  }, [propertyId]);
  const property = properties.find(item => Number(idOf(item)) === propertyId);
  const choose = (value: string, active: boolean, press: () => void) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={press} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, borderRadius: 9, padding: 12, marginBottom: 7, backgroundColor: colors.surface }}><Text style={{ color: colors.text }}>{value}</Text></Pressable>;
  return <View><Text style={{ color: colors.text, fontWeight: '700', marginVertical: 10 }}>Property</Text>
    {loading && <ActivityIndicator color={colors.accent} />}
    {!!error && <Pressable onPress={() => { setError(''); setLoading(true); PropertyAPI.getProperties().then(setProperties).catch(() => setError('Could not load properties.')).finally(() => setLoading(false)); }}><Text accessibilityRole="alert" style={{ color: '#b93535' }}>{error} Tap to retry.</Text></Pressable>}
    {!loading && !error && !properties.length && <Text style={{ color: colors.muted }}>No properties available.</Text>}
    {properties.map(item => { const id = Number(idOf(item)); return Number.isFinite(id) ? choose(`${item.name ?? item.Name ?? item.streetAddress ?? item.address ?? `Property ${id}`}`, id === propertyId, () => { setError(''); onChange(id, null, item); }) : null; })}
    {multiUnit(property) && <><Text style={{ color: colors.text, fontWeight: '700', marginVertical: 10 }}>Unit</Text>{units.map(item => { const id = Number(idOf(item)); return Number.isFinite(id) ? choose(String(item.name ?? item.Name ?? `Unit ${id}`), id === unitId, () => onChange(propertyId, id, property)) : null; })}</>}
  </View>;
}
