// Charge balances are authoritative server values. Never derive remaining from payments.
export function chargePresentation(charge) {
  const isRent = String(charge.type || '').toLowerCase() === 'rent';
  const isPooledDeposit = String(charge.type || '').toLowerCase() === 'deposit'
    && /^deposit:pooled:[^:]+$/.test(String(charge.chargeId || ''));
  return { ...charge, isRent, canPay: isRent && Number(charge.remaining) > 0, isPooledDeposit };
}

export function readChargesResponse(response) {
  const charges = Array.isArray(response) ? response : response?.success !== false ? response?.data : null;
  if (!Array.isArray(charges)) throw new Error('Charge information is unavailable. Please try again.');
  return charges;
}

export function leaseChargeOptions(properties, propertyId, unitId) {
  return (properties || []).flatMap((property) => {
    if (propertyId && String(property.id) !== String(propertyId)) return [];
    return (property.units || []).flatMap((unit) => {
      if (unitId && String(unit.id) !== String(unitId)) return [];
      const lease = unit.lease || unit.Lease;
      const id = lease?.id ?? lease?.Id;
      return id ? [{ id, label: `${property.name || 'Property'}${unit.name ? ` · ${unit.name}` : ''}` }] : [];
    });
  });
}
