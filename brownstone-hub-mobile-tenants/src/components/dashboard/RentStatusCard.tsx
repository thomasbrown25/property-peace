import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lease, NextRentDue, Deposit } from '../../types/dashboard';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface RentStatusCardProps {
  lease: Lease | null;
  nextRentDue: NextRentDue | null;
  deposit?: Deposit | null;
  depositPaid?: boolean | null;
  loadingDeposits?: boolean;
  onMakePayment?: () => void;
  onPayDeposit?: () => void;
}

export default function RentStatusCard({
  lease,
  nextRentDue,
  deposit,
  depositPaid,
  loadingDeposits,
  onMakePayment,
  onPayDeposit,
}: RentStatusCardProps) {
  if (!lease) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Ionicons name="home-outline" size={48} color="#999" />
          <Text style={styles.emptyTitle}>No Lease Set Up</Text>
          <Text style={styles.emptyDescription}>
            Your landlord has not set up the lease yet. Your rent information will appear here once your landlord creates and assigns a lease to your account.
          </Text>
        </View>
      </View>
    );
  }

  if (!nextRentDue) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rent Status</Text>
        <Text style={styles.emptyDescription}>No upcoming payments</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Rent Status</Text>
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={18} color="#1976d2" />
          <Text style={styles.sectionLabel}>Next Payment Due</Text>
        </View>
        <Text style={styles.dueDate}>{formatDate(nextRentDue.date)}</Text>
        {nextRentDue.daysUntil >= 0 ? (
          <Text style={styles.daysRemaining}>
            {nextRentDue.daysUntil === 0
              ? 'Due today'
              : nextRentDue.daysUntil === 1
                ? 'Due tomorrow'
                : `${nextRentDue.daysUntil} days remaining`}
          </Text>
        ) : (
          <Text style={styles.overdue}>
            {Math.abs(nextRentDue.daysUntil)} {Math.abs(nextRentDue.daysUntil) === 1 ? 'day' : 'days'} overdue
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={[styles.amountCard, nextRentDue.isOverdue && styles.overdueCard]}>
        <View style={styles.amountRow}>
          <View style={[styles.iconContainer, nextRentDue.isOverdue ? styles.errorIcon : styles.successIcon]}>
            <Ionicons name="cash-outline" size={18} color={nextRentDue.isOverdue ? '#cf1322' : '#52c41a'} />
          </View>
          <View style={styles.amountInfo}>
            <View style={styles.amountHeader}>
              <Text style={styles.amountLabel}>Amount Due</Text>
              {nextRentDue.isOverdue && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Overdue</Text>
                </View>
              )}
            </View>
            <Text style={[styles.amountDue, nextRentDue.isOverdue && styles.overdueAmount]}>
              {formatCurrency(nextRentDue.amount)}
            </Text>
          </View>
        </View>
      </View>

      {onMakePayment && (
        <TouchableOpacity style={styles.paymentButton} onPress={onMakePayment}>
          <Ionicons name="card-outline" size={20} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.paymentButtonText}>Make Payment</Text>
        </TouchableOpacity>
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
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  dueDate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  daysRemaining: {
    fontSize: 14,
    color: '#666666',
  },
  overdue: {
    fontSize: 14,
    color: '#cf1322',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  amountCard: {
    backgroundColor: 'rgba(82, 196, 26, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(82, 196, 26, 0.2)',
    position: 'relative',
  },
  overdueCard: {
    backgroundColor: 'rgba(207, 19, 34, 0.05)',
    borderColor: 'rgba(207, 19, 34, 0.2)',
  },
  successCard: {
    backgroundColor: 'rgba(82, 196, 26, 0.05)',
    borderColor: 'rgba(82, 196, 26, 0.2)',
  },
  warningCard: {
    backgroundColor: 'rgba(250, 173, 20, 0.05)',
    borderColor: 'rgba(250, 173, 20, 0.2)',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  errorIcon: {
    backgroundColor: 'rgba(207, 19, 34, 0.1)',
  },
  warningIcon: {
    backgroundColor: 'rgba(250, 173, 20, 0.1)',
  },
  amountInfo: {
    flex: 1,
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  monthlyRent: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#52c41a',
  },
  amountDue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#52c41a',
  },
  overdueAmount: {
    color: '#cf1322',
  },
  badge: {
    backgroundColor: '#cf1322',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  successBadge: {
    backgroundColor: '#52c41a',
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  paymentButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  depositAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#faad14',
    marginTop: 4,
  },
  depositButton: {
    borderWidth: 1,
    borderColor: '#52c41a',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  depositButtonText: {
    color: '#52c41a',
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
  loadingText: {
    color: '#666666',
  },
  depositBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#cf1322',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    zIndex: 1,
  },
  depositBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
  },
});
