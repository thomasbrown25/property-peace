import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaintenanceRequest } from '../../types/dashboard';
import { formatRelativeTime } from '../../utils/formatters';

interface MaintenanceRequestsCardProps {
  requests: MaintenanceRequest[];
  onNewRequest?: () => void;
  onRequestPress?: (requestId: string) => void;
}

export default function MaintenanceRequestsCard({
  requests,
  onNewRequest,
  onRequestPress,
}: MaintenanceRequestsCardProps) {
  const openRequests = requests.filter(
    (req) => req.status?.toLowerCase() !== 'completed' && req.status?.toLowerCase() !== 'cancelled'
  );
  const displayRequests = openRequests.slice(0, 3);

  const getPriorityColor = (priority?: string) => {
    if (priority === 'high' || priority === 'urgent') return '#cf1322';
    if (priority === 'medium') return '#faad14';
    return '#999';
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Maintenance Requests</Text>
        {onNewRequest && (
          <TouchableOpacity onPress={onNewRequest} style={styles.newButton}>
            <Ionicons name="add" size={18} color="#1976d2" />
            <Text style={styles.newButtonText}>New Request</Text>
          </TouchableOpacity>
        )}
      </View>

      {displayRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="construct-outline" size={48} color="#999" />
          <Text style={styles.emptyDescription}>No open maintenance requests</Text>
          {onNewRequest && (
            <TouchableOpacity style={styles.emptyButton} onPress={onNewRequest}>
              <Ionicons name="add" size={16} color="#1976d2" style={styles.emptyButtonIcon} />
              <Text style={styles.emptyButtonText}>Submit Request</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.requestsList}>
          {displayRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestItem}
              onPress={() => onRequestPress?.(request.id)}
            >
              <View style={styles.requestContent}>
                <Text style={styles.requestTitle}>{request.title || 'Maintenance Request'}</Text>
                <Text style={styles.requestDescription} numberOfLines={2}>
                  {request.description || 'No description'}
                </Text>
                {request.createdAt && (
                  <Text style={styles.requestTime}>{formatRelativeTime(request.createdAt)}</Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getPriorityColor(request.priority) }]}>
                <Text style={styles.statusText}>{request.status || 'Open'}</Text>
              </View>
            </TouchableOpacity>
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newButtonText: {
    color: '#1976d2',
    fontSize: 14,
    marginLeft: 4,
  },
  requestsList: {
    gap: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(25, 118, 210, 0.05)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(25, 118, 210, 0.1)',
  },
  requestContent: {
    flex: 1,
    marginRight: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    lineHeight: 20,
  },
  requestTime: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
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
    marginBottom: 16,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 6,
    padding: 8,
    paddingHorizontal: 16,
  },
  emptyButtonIcon: {
    marginRight: 4,
  },
  emptyButtonText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
});
