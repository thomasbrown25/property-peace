import apiClient from '../services/apiClient';

export type MoneyCenterItem = {
  sourceId: string;
  sourceType: string;
  occurredAt: string;
  direction: string;
  amount: number;
  treatment: string;
  propertyId: number;
  propertyName: string;
  unitName?: string | null;
  category: string;
  description: string;
  counterparty?: string | null;
  needsAttention: boolean;
  hasReceipt: boolean;
};

export type MoneyCenterOverview = {
  cameIn?: number;
  wentOut?: number;
  recordedNetCashFlow?: number;
  dueNow?: number;
  upcomingObligations?: number;
  attention?: { uncategorizedCount?: number; missingReceiptCount?: number; overdueObligationCount?: number; settlementCount?: number };
  dataQuality?: { warnings?: string[]; isBankFeedConnected?: boolean };
};

export type MoneyCenterItems = { items: MoneyCenterItem[]; totalCount: number; disclosures?: string[] };
export type FinanceScope = { from: string; to: string; propertyId?: number };

function query(scope: FinanceScope, limit?: number) {
  const parameters = [`from=${encodeURIComponent(scope.from)}`, `to=${encodeURIComponent(scope.to)}`, 'upcomingDays=30'];
  if (scope.propertyId) parameters.push(`propertyId=${encodeURIComponent(String(scope.propertyId))}`);
  if (limit) parameters.push(`limit=${limit}`);
  return parameters.join('&');
}

// Unlike several older endpoints, money-center returns its DTO directly, not ServiceResponse.Data.
const moneyCenterAPI = {
  async getOverview(scope: FinanceScope): Promise<MoneyCenterOverview> {
    const result = await apiClient.get<MoneyCenterOverview>(`/api/money-center?${query(scope)}`);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Finances overview unavailable');
    return result;
  },
  async getItems(scope: FinanceScope): Promise<MoneyCenterItems> {
    const result = await apiClient.get<MoneyCenterItems>(`/api/money-center/items?${query(scope, 1000)}`);
    if (!result || !Array.isArray(result.items) || !Number.isFinite(result.totalCount)) throw new Error('Finances activity unavailable');
    return result;
  },
};

export default moneyCenterAPI;
