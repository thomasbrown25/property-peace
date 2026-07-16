import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../../utils/formatters';

interface FeesCardProps {
  depositAmount?: number;
  depositPaid?: boolean | null;
  loadingDeposits?: boolean;
  onPayDeposit?: () => void;
  onPayFee?: (feeId: string) => void;
}

export default function FeesCard({
  depositAmount,
  depositPaid,
  loadingDeposits,
  onPayDeposit,
  onPayFee,
}: FeesCardProps) {
  const hasDeposit = depositAmount && depositAmount > 0;

  if (!hasDeposit) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fees</Text>
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Fees</Text>
          <Text style={styles.emptyDescription}>
            There are no fees associated with your lease at this time.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Fees</Text>

      {/* Deposit Section */}
      <View style={[styles.feeItem, depositPaid ? styles.paidFee : styles.unpaidFee]}>
        <View style={styles.feeHeader}>
          <View style={styles.feeInfo}>
            <View style={[styles.iconContainer, depositPaid ? styles.successIcon : styles.warningIcon]}>
              {loadingDeposits ? (
                <ActivityIndicator size="small" color="#666666" />
              ) : (
                <Ionicons 
                  name={depositPaid ? 'checkmark-circle' : 'cash-outline'} 
                  size={18} 
                  color={depositPaid ? '#52c41a' : '#faad14'} 
                />
              )}
            </View>
            <View style={styles.feeDetails}>
              <Text style={styles.feeLabel}>Deposit</Text>
              <Text style={styles.feeAmount}>{formatCurrency(depositAmount || 0)}</Text>
            </View>
          </View>
          {!loadingDeposits && depositPaid !== null && (
            <View style={[styles.statusBadge, depositPaid ? styles.paidBadge : styles.unpaidBadge]}>
              <Text style={styles.statusBadgeText}>{depositPaid ? 'Paid' : 'Not Paid'}</Text>
            </View>
          )}
        </View>
        {!loadingDeposits && !depositPaid && onPayDeposit && (
          <TouchableOpacity style={styles.payButton} onPress={onPayDeposit}>
            <Ionicons name="card-outline" size={16} color="#fff" style={styles.payButtonIcon} />
            <Text style={styles.payButtonText}>Pay Now</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Future Fees Section - Placeholder for invoices, pet fees, late fees */}
      {/* This will be populated when those features are implemented */}
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
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  feeItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  paidFee: {
    backgroundColor: 'rgba(82, 196, 26, 0.05)',
    borderColor: 'rgba(82, 196, 26, 0.2)',
  },
  unpaidFee: {
    backgroundColor: 'rgba(250, 173, 20, 0.05)',
    borderColor: 'rgba(250, 173, 20, 0.2)',
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  successIcon: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
  },
  warningIcon: {
    backgroundColor: 'rgba(250, 173, 20, 0.1)',
  },
  feeDetails: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paidBadge: {
    backgroundColor: '#52c41a',
  },
  unpaidBadge: {
    backgroundColor: '#fa8c16',
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: '#1976d2',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  payButtonIcon: {
    marginRight: 6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
