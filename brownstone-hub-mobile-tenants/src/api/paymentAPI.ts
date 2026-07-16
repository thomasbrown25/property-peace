import apiClient from '../services/apiClient';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  leaseId?: string;
  LeaseId?: string;
  status?: string;
  [key: string]: any;
}

class PaymentAPI {
  private client = apiClient;

  async getPaymentsByLease(leaseId: string): Promise<Payment[]> {
    try {
      const response = await this.client.get<ApiResponse<Payment[]> | Payment[]>(`/api/payment/${leaseId}`);
      // Handle both response formats
      if (Array.isArray(response)) {
        return response;
      }
      if (response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    } catch (error) {
      console.warn('Could not fetch payments:', error);
      return [];
    }
  }

  async checkBankAccountSetup(leaseId: string | number): Promise<boolean> {
    try {
      // Try to create a test payment intent with $0.01 to check if bank account is set up
      // If it fails, bank account is not set up
      const response = await this.client.post<ApiResponse<{ clientSecret?: string }>>('/api/stripe/create-payment-intent', {
        leaseId: typeof leaseId === 'string' ? parseInt(leaseId, 10) : leaseId,
        amount: 0.01,
        description: 'Bank account check'
      });
      return response.success === true && !!response.data?.clientSecret;
    } catch (error: any) {
      // If error indicates no bank account, return false
      if (error?.response?.status === 400 || error?.response?.status === 404) {
        return false;
      }
      // For other errors, assume no bank account to be safe
      console.warn('Could not check bank account setup:', error);
      return false;
    }
  }

  async createPaymentIntent(leaseId: string | number, amount: number, description?: string): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
    try {
      const response = await this.client.post<ApiResponse<{ clientSecret: string; paymentIntentId: string }>>('/api/stripe/create-payment-intent', {
        leaseId: typeof leaseId === 'string' ? parseInt(leaseId, 10) : leaseId,
        amount: amount,
        description: description || `Payment for lease #${leaseId}`
      });
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId: string, leaseId: string | number, amount: number, paymentDate: Date): Promise<boolean> {
    try {
      // Format payment date as ISO string
      const paymentDateString = paymentDate.toISOString();
      
      const response = await this.client.post<ApiResponse<boolean>>('/api/stripe/confirm-payment', {
        paymentIntentId: paymentIntentId,
        leaseId: typeof leaseId === 'string' ? parseInt(leaseId, 10) : leaseId,
        amount: amount,
        paymentDate: paymentDateString
      });
      
      return response.success === true;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }
}

export default new PaymentAPI();
export type { Payment };
