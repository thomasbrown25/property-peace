import type { Unit } from '../../api/propertyAPI';
import type { Tenant } from '../../api/tenantAPI';
import type { PropertyPayment } from '../../api/paymentAPI';

export type RentalMode = 'LongTerm' | 'ShortTerm';
export type PropertyRentalMode = RentalMode | 'Mixed' | 'Empty';
export const unitRentalMode = (unit: Unit): RentalMode =>
  String(unit.rentalMode ?? unit.RentalMode ?? 'LongTerm').toLowerCase() === 'shortterm' ? 'ShortTerm' : 'LongTerm';
export const propertyRentalMode = (units: Unit[]): PropertyRentalMode => {
  if (!units.length) return 'Empty';
  return units.some(unit => unitRentalMode(unit) === 'ShortTerm')
    ? units.some(unit => unitRentalMode(unit) === 'LongTerm') ? 'Mixed' : 'ShortTerm'
    : 'LongTerm';
};
export type RentalModeBlocker = { code?: string; message: string; resolution: string };
export type RentalModePreflight = {
  unitId: number; currentMode: RentalMode; targetMode: RentalMode;
  canChange: boolean; blockers: RentalModeBlocker[]; confirmationMessage: string;
};
export const rentalModeDecision = (result: Pick<RentalModePreflight, 'canChange' | 'blockers'> & { confirmationMessage?: string }) => {
  const blockers = result.blockers ?? [];
  if (!result.canChange || blockers.length) return {
    kind: 'blocked' as const,
    message: blockers.length
      ? blockers.map(blocker => `${blocker.message}\nTo resolve: ${blocker.resolution}`).join('\n\n')
      : 'This unit cannot change mode. Refresh and try again after resolving outstanding obligations.',
  };
  return { kind: 'confirm' as const, message: result.confirmationMessage || 'Changing mode hides the other mode’s workflows. Existing history is retained. Continue?' };
};

/** apiClient rejects the API response body directly; Axios-shaped errors are also accepted. */
export const rentalModeMutationError = (error: any): string => {
  const body = error?.response?.data ?? error;
  const preflight = body?.data ?? body?.Data;
  if (Array.isArray(preflight?.blockers ?? preflight?.Blockers) && (preflight.blockers ?? preflight.Blockers).length) {
    return rentalModeDecision({ canChange: false, blockers: preflight.blockers ?? preflight.Blockers }).message;
  }
  return body?.message ?? body?.Message ?? 'Could not change mode. Refresh and try again.';
};

export const longTermTenants = <T extends Tenant>(tenants: T[], units: Unit[]): T[] => {
  const ids = new Set(units.filter(unit => unitRentalMode(unit) === 'LongTerm').map(unit => String(unit.id ?? unit.Id)));
  return tenants.filter(tenant => tenant.unitId != null || tenant.UnitId != null ? ids.has(String(tenant.unitId ?? tenant.UnitId)) : false);
};

/** Payments have only a unit name, so ambiguous or missing names cannot be attributed safely. */
export const longTermPayments = <T extends Pick<PropertyPayment, 'unitName'>>(payments: T[], units: Unit[]): T[] => {
  const names = new Map<string, RentalMode | 'Mixed'>();
  for (const unit of units) {
    const name = String(unit.name ?? unit.Name ?? '').trim().toLowerCase();
    if (!name) continue;
    names.set(name, names.has(name) ? 'Mixed' : unitRentalMode(unit));
  }
  return payments.filter(payment => names.get(String(payment.unitName ?? '').trim().toLowerCase()) === 'LongTerm');
};
