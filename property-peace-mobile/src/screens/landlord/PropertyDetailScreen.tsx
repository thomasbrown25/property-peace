import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI from '../../api/propertyAPI';

type PropertyDetailRouteProp = RouteProp<PropertiesStackParamList, 'PropertyDetail'>;

export default function PropertyDetailScreen() {
  const route = useRoute<PropertyDetailRouteProp>();
  const { propertyId } = route.params;
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      const data = await PropertyAPI.getPropertyById(propertyId);
      setProperty(data);
    } catch (error) {
      console.error('Error loading property:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Property not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{property.name || 'Property Details'}</Text>
        {property.address && <Text style={styles.address}>{property.address}</Text>}
        
        {/* TODO: Add more property details */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  address: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
});
