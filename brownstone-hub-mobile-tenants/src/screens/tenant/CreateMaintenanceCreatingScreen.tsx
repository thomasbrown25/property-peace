import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaintenanceStackParamList } from '../../navigation/types';
import { LeaseAPI } from '../../api';
import { MaintenanceAPI } from '../../api';
import { generateMaintenanceMetadata } from '../../services/aiService';

type CreateMaintenanceCreatingNavigationProp = NativeStackNavigationProp<MaintenanceStackParamList, 'CreateMaintenanceCreating'>;
type CreateMaintenanceCreatingRouteProp = RouteProp<MaintenanceStackParamList, 'CreateMaintenanceCreating'>;

export default function CreateMaintenanceCreatingScreen() {
  const navigation = useNavigation<CreateMaintenanceCreatingNavigationProp>();
  const route = useRoute<CreateMaintenanceCreatingRouteProp>();
  const insets = useSafeAreaInsets();
  const { description, images } = route.params;
  const [status, setStatus] = useState<string>('Creating your maintenance request...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createMaintenanceRequest();
  }, []);

  const createMaintenanceRequest = async () => {
    try {
      // Step 1: Fetch lease to get propertyId and unitId
      setStatus('Fetching your lease information...');
      const lease = await LeaseAPI.getMyLease();

      if (!lease) {
        throw new Error('No lease found. Please contact your landlord to set up your lease first.');
      }

      // Extract propertyId - check multiple possible locations
      const propertyId = lease.unit?.property?.id || 
                        lease.propertyId || 
                        lease.PropertyId ||
                        (lease as any).property?.id;
      
      if (!propertyId) {
        throw new Error('Property information not found. Please contact your landlord.');
      }

      // Extract unitId - check multiple possible locations
      const unitId = lease.unit?.id || 
                     lease.unitId || 
                     lease.UnitId;

      // Step 2: Fetch categories
      setStatus('Loading maintenance categories...');
      const categories = await MaintenanceAPI.getMaintenanceCategories();

      if (!categories || categories.length === 0) {
        throw new Error('Failed to load maintenance categories. Please try again.');
      }

      // Step 3: Generate metadata using AI
      setStatus('AI is analyzing your request and setting priority...');
      const metadata = await generateMaintenanceMetadata(description, categories);

      // Step 4: Prepare request data
      setStatus('Preparing your request...');
      const requestData = {
        propertyId: typeof propertyId === 'string' ? parseInt(propertyId, 10) : propertyId,
        unitId: unitId ? (typeof unitId === 'string' ? parseInt(unitId, 10) : unitId) : undefined,
        title: metadata.title,
        description: description,
        categoryId: metadata.categoryId,
        priority: metadata.priority,
        status: 'open' as const,
      };

      // Step 5: Prepare images
      const imageFiles = images.map((uri) => ({
        uri,
        type: 'image/jpeg',
        name: `image_${Date.now()}_${Math.random()}.jpg`,
      }));

      // Step 6: Create maintenance request
      setStatus('Creating your maintenance request...');
      await MaintenanceAPI.createMaintenanceRequest(requestData, imageFiles);

      // Success - navigate back to maintenance list
      setStatus('Request created successfully!');
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MaintenanceList' }],
        });
      }, 1000);
    } catch (err: any) {
      console.error('Error creating maintenance request:', err);
      setError(err?.message || 'Failed to create maintenance request. Please try again.');
    }
  };

  const handleRetry = () => {
    setError(null);
    setStatus('Creating your maintenance request...');
    createMaintenanceRequest();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={styles.content}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color="#cf1322" />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.subText}>
          {status.includes('AI') 
            ? 'This may take a few seconds...'
            : 'Please wait...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 24,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
});
