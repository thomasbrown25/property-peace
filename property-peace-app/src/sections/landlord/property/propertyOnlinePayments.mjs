import { rentalMode } from '../../../utils/rentalMode.js';
import { getRentLease } from './propertyHeaderMetrics.mjs';

export function collectsRentOnline(property) {
  const units = property?.units ?? property?.Units ?? [];
  return units.some((unit) => {
    if (rentalMode(unit) === 'shortTerm') return false;
    const lease = getRentLease(unit);
    return (lease?.rentCollectionByPlatform ?? lease?.RentCollectionByPlatform) === true;
  });
}

export function getOnlinePaymentAction(response) {
  if ((response?.success ?? response?.Success) === false) return null;
  const status = response?.data ?? response?.Data ?? response;
  const detailsSubmitted = status?.detailsSubmitted ?? status?.DetailsSubmitted;
  if (typeof detailsSubmitted !== 'boolean') return null;

  return {
    label: detailsSubmitted ? 'Edit online payment settings' : 'Setup online payments',
    description: detailsSubmitted ? 'Manage your Stripe account and payout settings.' : 'Connect Stripe to accept rent payments online.',
    icon: 'settings',
    showInRentCard: !detailsSubmitted
  };
}
