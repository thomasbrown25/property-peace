import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { LeasesStackParamList } from '../../navigation/types';

type LeaseDetailRouteProp = RouteProp<LeasesStackParamList, 'LeaseDetail'>;

export default function LeaseDetailScreen() {
  const route = useRoute<LeaseDetailRouteProp>();
  const { leaseId } = route.params;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Lease Details</Text>
        <Text style={styles.subtitle}>Lease ID: {leaseId}</Text>
        
        {/* TODO: Add lease details */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
});
