// Authenticated apiClient is injected by the native screen; keeping transport injectable
// also lets contract tests exercise the exact tenant-scoped routes without a live server.
export type TenantLease = { id: number; name?: string | null; isActive?: boolean; rentCollectionByPlatform?: boolean | null; propertyName?: string; propertyType?: string; unitName?: string; nextDueDate?: string; startDate?: string | null; endDate?: string | null; rentAmount?: number | null; rentFrequency?: string | null; rentDueDay?: number | null; depositAmount?: number | null };
export type TenantRent = { leaseId: number; rentDue: number; rentDueIsOverdue?: boolean; currentMonthRentDueDate?: string | null; dueDate?: string; unpaidFees?: unknown[]; processingPaymentCount?: number; hasLongProcessingPayment?: boolean };
export type TenantPayment = { id: number | string; leaseId: number; amount: number; stripePaymentIntentId?: string | null; currency?: string; paymentDate?: string; status: string; creditsRent?: boolean; canRetry?: boolean; paymentType?: string; method?: string | null };
export type TenantChargePayment = { id: number; amount: number; status: string; paymentDate: string | null };
export type TenantCharge = { chargeId: string; type: string; title: string; dueDate: string | null; amount: number; paid: number; remaining: number; payments: TenantChargePayment[] };
export type PayReadiness = { allowed: boolean; blockers: Array<{ message?: string; code?: string }> };
type Transport = { get<T = unknown>(url: string): Promise<T>; post<T = unknown>(url: string, data: unknown): Promise<T> };

function unwrap<T>(response: any, label: string): T {
  if (!response || response.success !== true || response.data == null) throw new Error(response?.message || `Unable to load ${label}.`);
  return response.data as T;
}
function validLeaseId(id: unknown): asserts id is number {
  if (!Number.isSafeInteger(id) || Number(id) <= 0) throw new Error('Choose a valid lease.');
}
export function createTenantPaymentsAPI(client: Transport) {
  return {
    async leases(): Promise<TenantLease[]> {
      const data = unwrap<unknown>(await client.get('/api/lease/tenant/my-leases'), 'your leases');
      if (!Array.isArray(data)) throw new Error('Invalid leases response.');
      return data as TenantLease[];
    },
    async rent(leaseId: number): Promise<TenantRent | null> {
      validLeaseId(leaseId);
      const data = unwrap<any>(await client.get(`/api/rent-collection/tenant/my-rent?leaseId=${leaseId}`), 'rent');
      if (!Array.isArray(data?.rentRecords)) throw new Error('Invalid rent response.');
      return data.rentRecords.find((record: TenantRent) => record.leaseId === leaseId) ?? null;
    },
    async history(leaseId: number): Promise<TenantPayment[]> {
      validLeaseId(leaseId);
      const data = await client.get(`/api/payment/${leaseId}/tenant-history`);
      if (!Array.isArray(data)) throw new Error('Invalid payment history response.');
      return data as TenantPayment[];
    },
    async charges(leaseId: number): Promise<TenantCharge[]> {
      validLeaseId(leaseId);
      const data: unknown = await client.get(`/api/payment/${leaseId}/tenant-charges`);
      if (!Array.isArray(data) || !data.every((charge: any) =>
        charge && typeof charge.chargeId === 'string' && charge.chargeId.length > 0 &&
        typeof charge.type === 'string' && typeof charge.title === 'string' &&
        (charge.dueDate == null || typeof charge.dueDate === 'string') &&
        [charge.amount, charge.paid, charge.remaining].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) &&
        Array.isArray(charge.payments) && charge.payments.every((payment: any) =>
          payment && Number.isSafeInteger(payment.id) && payment.id > 0 && typeof payment.status === 'string' &&
          typeof payment.amount === 'number' && Number.isFinite(payment.amount) && payment.amount >= 0 &&
          (payment.paymentDate == null || typeof payment.paymentDate === 'string')))) throw new Error('Invalid tenant charges response.');
      return data as TenantCharge[];
    },
    async readiness(): Promise<PayReadiness> {
      const data: any = await client.get('/api/feature-readiness/rent-payments/pay');
      if (typeof data?.allowed !== 'boolean' || !Array.isArray(data.blockers)) throw new Error('Payment availability could not be verified.');
      return data as PayReadiness;
    },
    async publishableKey(): Promise<string> {
      const data: any = await client.get('/api/stripe/publishable-key');
      if (typeof data?.publishableKey !== 'string' || !/^pk_(test|live)_[A-Za-z0-9]+$/.test(data.publishableKey)) throw new Error('Secure checkout is unavailable.');
      return data.publishableKey;
    },
    async createIntent(leaseId: number, amount: number, operationId: string, chargeId?: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
      validLeaseId(leaseId);
      if (!Number.isFinite(amount) || amount < 0.5 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7) throw new Error('Invalid rent payment amount.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) throw new Error('Invalid payment operation.');
      if (chargeId !== undefined && !(
        (/^fee:[1-9]\d*$/.test(chargeId) && Number.isSafeInteger(Number(chargeId.slice(4)))) ||
        (new RegExp(`^rent:${leaseId}:\\d{4}-\\d{2}-\\d{2}$`).test(chargeId) &&
          !Number.isNaN(Date.parse(chargeId.split(':')[2] + 'T00:00:00Z')) &&
          new Date(chargeId.split(':')[2] + 'T00:00:00Z').toISOString().slice(0, 10) === chargeId.split(':')[2])
      )) throw new Error('Invalid selected charge.');
      const data = unwrap<any>(await client.post('/api/stripe/create-payment-intent', { leaseId, amount, operationId, ...(chargeId === undefined ? {} : { chargeId }) }), 'checkout');
      if (typeof data?.clientSecret !== 'string' || !/^pi_[^\s]+_secret_[^\s]+$/.test(data.clientSecret) || typeof data.paymentIntentId !== 'string' || !/^pi_[^\s]+$/.test(data.paymentIntentId)) throw new Error('Invalid secure checkout response.');
      return { clientSecret: data.clientSecret, paymentIntentId: data.paymentIntentId };
    },
  };
}
