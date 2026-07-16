import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaintenanceStackParamList } from '../../navigation/types';
import { MaintenanceAPI, MaintenanceRequest } from '../../api/maintenanceAPI';
import moment from 'moment';

type MaintenanceDetailNavigationProp = NativeStackNavigationProp<MaintenanceStackParamList, 'MaintenanceDetail'>;
type MaintenanceDetailRouteProp = RouteProp<MaintenanceStackParamList, 'MaintenanceDetail'>;

export default function MaintenanceDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MaintenanceDetailNavigationProp>();
  const route = useRoute<MaintenanceDetailRouteProp>();
  const { maintenanceId } = route.params;
  
  const [maintenance, setMaintenance] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchMaintenance();
  }, [maintenanceId]);

  const fetchMaintenance = async () => {
    try {
      setLoading(true);
      const data = await MaintenanceAPI.getMaintenanceRequestById(maintenanceId);
      if (data) {
        setMaintenance(data);
      } else {
        Alert.alert('Error', 'Maintenance request not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching maintenance request:', error);
      Alert.alert('Error', 'Failed to load maintenance request');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsResolved = async () => {
    if (!maintenance) return;

    Alert.alert(
      'Mark as Resolved',
      'Are you sure you want to mark this maintenance request as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Resolved',
          onPress: async () => {
            try {
              setResolving(true);
              await MaintenanceAPI.markAsResolved(maintenanceId);
              // Refetch maintenance data
              await fetchMaintenance();
              Alert.alert('Success', 'Maintenance request marked as resolved', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error: any) {
              console.error('Error marking maintenance as resolved:', error);
              Alert.alert('Error', error.message || 'Failed to mark maintenance as resolved');
            } finally {
              setResolving(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return moment(dateString).format('MMM D, YYYY [at] h:mm A');
  };

  const formatTimeOpen = (createdAt?: string) => {
    if (!createdAt) return 'N/A';
    const now = moment();
    const created = moment(createdAt);
    const duration = moment.duration(now.diff(created));

    const days = Math.floor(duration.asDays());
    const hours = Math.floor(duration.asHours()) % 24;
    const minutes = Math.floor(duration.asMinutes()) % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`);

    return parts.join(', ');
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return '#999';
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority === 'high') return '#d32f2f';
    if (lowerPriority === 'medium') return '#faad14';
    return '#52c41a'; // low
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1976d2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maintenance Details</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading maintenance request...</Text>
        </View>
      </View>
    );
  }

  if (!maintenance) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1976d2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maintenance Details</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Maintenance request not found</Text>
        </View>
      </View>
    );
  }

  const { title, description, priority, status, images, createdAt, updatedAt } = maintenance;
  const isResolved = status?.toLowerCase() === 'completed' || status?.toLowerCase() === 'resolved';
  const isCancelled = status?.toLowerCase() === 'cancelled';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maintenance Details</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Request Information */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={20} color="#1976d2" />
            <Text style={styles.cardTitle}>Request Information</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Title</Text>
            <Text style={styles.value}>{title || 'Maintenance Request'}</Text>
          </View>

          {description && (
            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.value}>{description}</Text>
            </View>
          )}

          {priority && (
            <View style={styles.section}>
              <Text style={styles.label}>Priority</Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(priority) + '20' }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(priority) }]}>
                  {priority.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={20} color="#1976d2" />
            <Text style={styles.cardTitle}>Timeline</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Submitted</Text>
            <Text style={styles.value}>{formatDate(createdAt)}</Text>
          </View>

          {updatedAt && updatedAt !== createdAt && (
            <View style={styles.section}>
              <Text style={styles.label}>Last Updated</Text>
              <Text style={styles.value}>{formatDate(updatedAt)}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Time Open</Text>
            <Text style={styles.value}>{formatTimeOpen(createdAt)}</Text>
          </View>
        </View>

        {/* Images */}
        {images && images.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={20} color="#1976d2" />
              <Text style={styles.cardTitle}>Images</Text>
            </View>
            <View style={styles.imageGrid}>
              {Array.isArray(images) ? images.map((image: any, index: number) => {
                const imageUrl = typeof image === 'string' ? image : image.url || image.uri;
                return (
                  <Image
                    key={index}
                    source={{ uri: imageUrl }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                );
              }) : null}
            </View>
          </View>
        )}

        {/* Mark as Resolved Button */}
        {!isResolved && !isCancelled && (
          <TouchableOpacity
            style={[styles.resolveButton, resolving && styles.resolveButtonDisabled]}
            onPress={handleMarkAsResolved}
            disabled={resolving}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.resolveButtonText}>
              {resolving ? 'Marking as Resolved...' : 'Mark as Resolved'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
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
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  image: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  resolveButton: {
    backgroundColor: '#52c41a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  resolveButtonDisabled: {
    opacity: 0.6,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
