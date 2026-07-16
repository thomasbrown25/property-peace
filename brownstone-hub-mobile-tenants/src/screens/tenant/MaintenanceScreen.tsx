import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaintenanceStackParamList } from '../../navigation/types';
import { MaintenanceAPI } from '../../api';
import { MaintenanceRequest } from '../../api/maintenanceAPI';
import moment from 'moment';

type MaintenanceScreenNavigationProp = NativeStackNavigationProp<MaintenanceStackParamList, 'MaintenanceList'>;

export default function MaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MaintenanceScreenNavigationProp>();
  const [currentRequests, setCurrentRequests] = useState<MaintenanceRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<MaintenanceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMaintenanceRequests = useCallback(async () => {
    try {
      setLoading(true);
      const [current, history] = await Promise.all([
        MaintenanceAPI.getCurrentRequests(),
        MaintenanceAPI.getHistoryRequests(),
      ]);
      setCurrentRequests(current);
      setHistoryRequests(history);
    } catch (error) {
      console.error('Error fetching maintenance requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMaintenanceRequests();
  }, [fetchMaintenanceRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMaintenanceRequests();
  }, [fetchMaintenanceRequests]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return moment(dateString).format('MMM D, YYYY');
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return moment(dateString).fromNow();
  };

  const getStatusColor = (status?: string) => {
    if (!status) return '#999';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'completed' || lowerStatus === 'resolved') return '#52c41a';
    if (lowerStatus === 'in-progress' || lowerStatus === 'inprogress') return '#1976d2';
    if (lowerStatus === 'pending' || lowerStatus === 'onhold') return '#faad14';
    if (lowerStatus === 'cancelled') return '#999';
    return '#1976d2'; // default for 'open'
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return '#999';
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority === 'high') return '#d32f2f';
    if (lowerPriority === 'medium') return '#faad14';
    return '#52c41a'; // low
  };

  const getStatusLabel = (status?: string) => {
    if (!status) return 'Open';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'in-progress' || lowerStatus === 'inprogress') return 'In Progress';
    if (lowerStatus === 'onhold') return 'On Hold';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const requests = activeTab === 'current' ? currentRequests : historyRequests;

  const renderRequestItem = (request: MaintenanceRequest) => (
    <TouchableOpacity
      key={request.id}
      style={styles.requestCard}
      onPress={() => navigation.navigate('MaintenanceDetail', { maintenanceId: String(request.id) })}
    >
      <View style={styles.requestHeader}>
        <View style={styles.requestIconContainer}>
          <Ionicons 
            name="construct-outline" 
            size={20} 
            color={activeTab === 'current' ? '#1976d2' : '#52c41a'} 
          />
        </View>
        <View style={styles.requestContent}>
          <Text style={styles.requestTitle} numberOfLines={2}>
            {request.title || 'Maintenance Request'}
          </Text>
          {request.description && (
            <Text style={styles.requestDescription} numberOfLines={2}>
              {request.description}
            </Text>
          )}
          <View style={styles.requestMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#999" />
              <Text style={styles.metaText}>
                {activeTab === 'current' 
                  ? formatRelativeTime(request.createdAt) 
                  : formatDate(request.createdAt)}
              </Text>
            </View>
            {request.priority && (
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(request.priority) + '20' }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(request.priority) }]}>
                  {request.priority.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
            {getStatusLabel(request.status)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <Text style={styles.title}>Maintenance</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.tabActive]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            Current ({currentRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History ({historyRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading maintenance requests...</Text>
        </View>
      ) : requests.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.emptyState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976d2" />}
        >
          <Ionicons name="construct-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>No {activeTab === 'current' ? 'Current' : 'History'} Requests</Text>
          <Text style={styles.emptyDescription}>
            {activeTab === 'current' 
              ? "You don't have any active maintenance requests."
              : "You don't have any completed maintenance requests."}
          </Text>
          {activeTab === 'current' && (
            <TouchableOpacity
              style={styles.newRequestButton}
              onPress={() => navigation.navigate('CreateMaintenanceStep1')}
            >
              <Text style={styles.newRequestButtonText}>Create New Request</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976d2" />}
        >
          <View style={styles.requestsList}>
            {requests.map(renderRequestItem)}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1976d2',
  },
  tabText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1976d2',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#666666',
    marginTop: 10,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  newRequestButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  newRequestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestsList: {
    padding: 20,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  requestIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestContent: {
    flex: 1,
    minWidth: 0,
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
    marginBottom: 8,
    lineHeight: 20,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666666',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
