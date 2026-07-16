import { Lease } from '../api/leaseAPI';
import { Payment } from '../api/paymentAPI';
import { MaintenanceRequest } from '../api/maintenanceAPI';

export interface RentCollection {
  rentRecords?: RentRecord[];
  RentRecords?: RentRecord[];
  [key: string]: any;
}

export interface RentRecord {
  leaseId?: string;
  LeaseId?: string;
  rentAmount?: number;
  RentAmount?: number;
  overdueAmount?: number;
  OverdueAmount?: number;
  /** Overdue + current period rent when within 15-day charge window. Use for balance due. */
  amountDueNow?: number;
  [key: string]: any;
}

export interface NextRentDue {
  date: Date;
  amount: number;
  overdueAmount: number;
  nextPaymentAmount: number;
  daysUntil: number;
  isOverdue: boolean;
}

export interface Deposit {
  id: string;
  amount?: number;
  receivedDate?: string;
  refundedDate?: string;
  leaseId?: string;
  [key: string]: any;
}

// Re-export types from API modules for convenience
export type { Lease, Payment, MaintenanceRequest };
