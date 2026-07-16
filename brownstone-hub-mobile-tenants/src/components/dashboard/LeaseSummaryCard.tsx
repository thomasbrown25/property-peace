import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lease } from '../../types/dashboard';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface LeaseSummaryCardProps {
  lease: Lease | null;
  onViewDetails?: () => void;
}

export default function LeaseSummaryCard({ lease, onViewDetails }: LeaseSummaryCardProps) {
  if (!lease) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#999" />
          <Text style={styles.emptyTitle}>No Lease Information</Text>
          <Text style={styles.emptyDescription}>
            Your lease details will appear here once your landlord creates and assigns a lease to your account. If you believe this is an error, please contact your landlord.
          </Text>
        </View>
      </View>
    );
  }

  const propertyDisplay = lease.unit?.property?.name || lease.propertyName || 'Unknown Property';
  const unitDisplay = lease.unit?.name || lease.unitName;
  const isSingleFamily = lease.unit?.property?.propertyType?.toLowerCase() === 'singlefamily';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Lease Summary</Text>
        {onViewDetails && (
          <TouchableOpacity onPress={onViewDetails} style={styles.viewButton}>
            <Text style={styles.viewButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#1976d2" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="home-outline" size={18} color="#1976d2" />
          <Text style={styles.sectionLabel}>Property</Text>
        </View>
        <Text style={styles.propertyName}>{propertyDisplay}</Text>
        {unitDisplay && !isSingleFamily && (
          <Text style={styles.unitName}>Unit: {unitDisplay}</Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={18} color="#1976d2" />
          <Text style={styles.sectionLabel}>Lease Period</Text>
        </View>
        <Text style={styles.leasePeriod}>
          {formatDate(lease.startDate)} - {lease.endDate ? formatDate(lease.endDate) : 'Ongoing'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cash-outline" size={18} color="#1976d2" />
          <Text style={styles.sectionLabel}>Monthly Rent</Text>
        </View>
        <Text style={styles.monthlyRent}>{formatCurrency(lease.rentAmount || 0)}</Text>
      </View>
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
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#1976d2',
    fontSize: 14,
    marginRight: 4,
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
  propertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  unitName: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  leasePeriod: {
    fontSize: 16,
    color: '#333333',
  },
  monthlyRent: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
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
