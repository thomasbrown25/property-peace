import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Payment } from '../../types/dashboard';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface RecentPaymentsCardProps {
  payments: Payment[];
  onViewAll?: () => void;
}

export default function RecentPaymentsCard({ payments, onViewAll }: RecentPaymentsCardProps) {
  const recentPayments = payments
    .sort((a, b) => {
      const dateA = new Date(a.paymentDate || 0).getTime();
      const dateB = new Date(b.paymentDate || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Recent Payments</Text>
        {onViewAll && payments.length > 0 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        )}
      </View>

      {payments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={48} color="#999" />
          <Text style={styles.emptyDescription}>
            No payments available. Your payment history will appear here once your landlord sets up your lease.
          </Text>
        </View>
      ) : recentPayments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyDescription}>No payments found</Text>
        </View>
      ) : (
        <View style={styles.paymentsList}>
          {recentPayments.map((payment, index) => (
            <View key={payment.id || `payment-${index}`} style={styles.paymentItem}>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentHeader}>
                  <Ionicons name="checkmark-circle" size={16} color="#52c41a" />
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount || 0)}</Text>
                </View>
                <Text style={styles.paymentDate}>Paid on {formatDate(payment.paymentDate)}</Text>
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>Paid</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  viewAllText: {
    color: '#1976d2',
    fontSize: 14,
  },
  paymentsList: {
    gap: 12,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82, 196, 26, 0.3)',
    borderRadius: 8,
    padding: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
  },
  paymentDate: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 24,
  },
  paidBadge: {
    backgroundColor: '#52c41a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paidBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
