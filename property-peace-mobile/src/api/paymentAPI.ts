import apiClient from '../services/apiClient';

export interface PropertyPayment {
  id: number;
  propertyId: number;
  amount: number;
  paymentDate: string;
  status: string;
  tenantName?: string | null;
  unitName?: string | null;
  method?: string | null;
  feeName?: string | null;
}

const PaymentAPI = {
  async getByProperty(propertyId: string | number): Promise<PropertyPayment[]> {
    const response = await apiClient.get<PropertyPayment[] | { data: PropertyPayment[] }>(
      `/api/payment/all?propertyId=${encodeURIComponent(String(propertyId))}`,
    );
    const payments = Array.isArray(response) ? response : response?.data;
    if (!Array.isArray(payments)) throw new Error('Payments unavailable');
    return payments.filter(payment => String(payment.propertyId) === String(propertyId));
  },
};

export default PaymentAPI;
