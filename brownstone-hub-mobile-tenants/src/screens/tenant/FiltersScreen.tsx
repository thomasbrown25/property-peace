import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MessagesStackParamList } from '../../navigation/types';

type FiltersScreenRouteProp = RouteProp<MessagesStackParamList, 'Filters'>;

export default function FiltersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<FiltersScreenRouteProp>();
  const [selectedBathrooms, setSelectedBathrooms] = useState<string>('Any');
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [yearBuilt, setYearBuilt] = useState<string>('Any');
  const [squareFeet, setSquareFeet] = useState<string>('Any');
  const [acceptsOnlineApplications, setAcceptsOnlineApplications] = useState(false);

  // Initialize from route params if available
  useEffect(() => {
    const params = route.params as any;
    if (params) {
      if (params.selectedBathrooms) setSelectedBathrooms(params.selectedBathrooms);
      if (params.selectedPets) setSelectedPets(params.selectedPets);
      if (params.yearBuilt) setYearBuilt(params.yearBuilt);
      if (params.squareFeet) setSquareFeet(params.squareFeet);
      if (params.acceptsOnlineApplications !== undefined) setAcceptsOnlineApplications(params.acceptsOnlineApplications);
    }
  }, [route.params]);

  const togglePet = (pet: string) => {
    if (selectedPets.includes(pet)) {
      setSelectedPets(selectedPets.filter(p => p !== pet));
    } else {
      setSelectedPets([...selectedPets, pet]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filters</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Bathrooms Section */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Bathrooms</Text>
          <View style={styles.optionsContainer}>
            {['Any', '1', '2', '3', '4', '5+'].map((bathroom) => {
              const isSelected = selectedBathrooms === bathroom;
              return (
                <TouchableOpacity
                  key={bathroom}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonActive
                  ]}
                  onPress={() => setSelectedBathrooms(bathroom)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    isSelected && styles.optionButtonTextActive
                  ]}>
                    {bathroom}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Pets Section */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Pets</Text>
          <View style={styles.checkboxList}>
            {['Cats allowed', 'Large Dogs allowed', 'Small Dogs allowed'].map((pet) => {
              const isSelected = selectedPets.includes(pet);
              return (
                <TouchableOpacity
                  key={pet}
                  style={styles.checkboxOption}
                  onPress={() => togglePet(pet)}
                >
                  <Text style={styles.checkboxOptionText}>{pet}</Text>
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected
                  ]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Year Built Section */}
        <View style={styles.filterSection}>
          <TouchableOpacity style={styles.dropdownSection}>
            <Text style={styles.sectionTitle}>Year built</Text>
            <View style={styles.dropdownRight}>
              <Text style={styles.dropdownValue}>{yearBuilt}</Text>
              <Ionicons name="chevron-down" size={20} color="#666666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Square Feet Section */}
        <View style={styles.filterSection}>
          <TouchableOpacity style={styles.dropdownSection}>
            <Text style={styles.sectionTitle}>Square feet</Text>
            <View style={styles.dropdownRight}>
              <Text style={styles.dropdownValue}>{squareFeet}</Text>
              <Ionicons name="chevron-down" size={20} color="#666666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Accepts Online Applications Section */}
        <View style={styles.filterSection}>
          <View style={styles.toggleSection}>
            <Text style={styles.sectionTitle}>Accepts online applications</Text>
            <Switch
              value={acceptsOnlineApplications}
              onValueChange={setAcceptsOnlineApplications}
              trackColor={{ false: '#E0E0E0', true: '#1976d2' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
            />
          </View>
        </View>
      </ScrollView>

      {/* Show Results Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={styles.showResultsButton}
          onPress={() => {
            // Pass filter values back to SearchScreen via navigation params
            navigation.navigate('Search' as never, {
              selectedBathrooms,
              selectedPets,
              yearBuilt,
              squareFeet,
              acceptsOnlineApplications,
            } as never);
          }}
        >
          <Text style={styles.showResultsButtonText}>Show Results</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    minWidth: 60,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
  },
  checkboxList: {
    gap: 0,
  },
  checkboxOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  checkboxOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  dropdownSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  showResultsButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  showResultsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
