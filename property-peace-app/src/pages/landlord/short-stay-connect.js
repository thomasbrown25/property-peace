import axios from 'utils/axios';
import { getInitialStripeOnboardingUrl } from 'utils/stripeOrganizationRequestLifecycle';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

export function connectStatusFromResponse(response) {
  const envelope = response?.data;
  if (!envelope || envelope.success === false) throw new Error(envelope?.message || 'Stripe Connect status is unavailable.');
  const status = envelope.data ?? envelope;
  if (!status || typeof status !== 'object' || !('accountId' in status)) throw new Error('Stripe Connect status is unavailable.');
  return status;
}

export function connectReadiness(status) {
  if (!status) return null;
  const label = (value) => value === true ? 'Enabled' : value === false ? 'Not enabled' : 'Unavailable';
  return {
    charges: label(status.chargesEnabled),
    payouts: label(status.payoutsEnabled),
    card: ['active', 'pending', 'inactive', 'unrequested'].includes(status.cardPaymentsCapabilityStatus)
      ? status.cardPaymentsCapabilityStatus : 'Unavailable',
    kyc: status.detailsSubmitted === true ? 'Details submitted' : 'Stripe onboarding incomplete'
  };
}

export const shortStayConnectAPI = {
  async status() { return connectStatusFromResponse(await axios.get('/api/stripe/account-status', noStore)); },
  async preparation() { return (await axios.get('/api/stripe/connect-preparation', noStore)).data; },
  async create(context) {
    const { ein, ...preparation } = context;
    const saved = (await axios.post('/api/stripe/connect-preparation', preparation)).data;
    if (!saved?.id || !Array.isArray(saved.propertyIds) || !saved.updatedAt) throw new Error('Could not confirm saved payout setup.');
    const result = (await axios.post('/api/stripe/connect-account', {
      operatingType: preparation.operatingType,
      legalBusinessName: preparation.operatingType === 'business' ? preparation.displayName : null,
      ein: preparation.operatingType === 'business' ? ein : undefined
    })).data;
    const url = getInitialStripeOnboardingUrl(result);
    if (!url) throw new Error(result?.message || 'Stripe did not return an onboarding link.');
    return url;
  },
  async onboard() {
    const result = (await axios.post('/api/stripe/account-link', { type: 'account_onboarding' })).data;
    const url = result?.onboardingUrl;
    if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Stripe did not return an onboarding link.');
    return url;
  }
};
