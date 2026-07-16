import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MessagesStackParamList } from '../../navigation/types';

type SearchScreenRouteProp = RouteProp<MessagesStackParamList, 'Search'>;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<SearchScreenRouteProp>();
  const [searchQuery, setSearchQuery] = useState('Garden City');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [showRentalTypeFilter, setShowRentalTypeFilter] = useState(false);
  const [showBedsFilter, setShowBedsFilter] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedRentalTypes, setSelectedRentalTypes] = useState<string[]>([]);
  const [selectedBeds, setSelectedBeds] = useState<string>('Any');
  // Additional filters from FiltersScreen
  const [selectedBathrooms, setSelectedBathrooms] = useState<string>('Any');
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [yearBuilt, setYearBuilt] = useState<string>('Any');
  const [squareFeet, setSquareFeet] = useState<string>('Any');
  const [acceptsOnlineApplications, setAcceptsOnlineApplications] = useState(false);
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);
  const [sliderTrackLayout, setSliderTrackLayout] = useState({ x: 0, width: 0 });
  const [draggingHandle, setDraggingHandle] = useState<'min' | 'max' | null>(null);

  // Listen for filter updates from FiltersScreen
  useEffect(() => {
    const params = route.params;
    if (params) {
      if (params.selectedBathrooms !== undefined) setSelectedBathrooms(params.selectedBathrooms);
      if (params.selectedPets !== undefined) setSelectedPets(params.selectedPets);
      if (params.yearBuilt !== undefined) setYearBuilt(params.yearBuilt);
      if (params.squareFeet !== undefined) setSquareFeet(params.squareFeet);
      if (params.acceptsOnlineApplications !== undefined) setAcceptsOnlineApplications(params.acceptsOnlineApplications);
    }
  }, [route.params]);

  // Helper functions to format filter button text
  const getPriceButtonText = () => {
    if (!minPrice && !maxPrice) return 'Price';
    const min = minPrice ? `$${minPrice}` : '';
    const max = maxPrice ? `$${maxPrice}` : '';
    if (min && max) return `${min}-${max}`;
    if (min) return `$${minPrice}+`;
    if (max) return `Up to $${maxPrice}`;
    return 'Price';
  };

  const getRentalTypeButtonText = () => {
    if (selectedRentalTypes.length === 0) return 'Rental Type';
    const text = selectedRentalTypes.join(', ');
    return text.length > 20 ? text.substring(0, 17) + '...' : text;
  };

  const getBedsButtonText = () => {
    if (selectedBeds === 'Any') return 'Beds';
    return `${selectedBeds} Beds`;
  };

  const getMoreButtonText = () => {
    const hasFilters = selectedBathrooms !== 'Any' || 
                      selectedPets.length > 0 || 
                      yearBuilt !== 'Any' || 
                      squareFeet !== 'Any' || 
                      acceptsOnlineApplications;
    return hasFilters ? 'More' : 'More';
  };

  const hasMoreFilters = () => {
    return selectedBathrooms !== 'Any' || 
           selectedPets.length > 0 || 
           yearBuilt !== 'Any' || 
           squareFeet !== 'Any' || 
           acceptsOnlineApplications;
  };

  // Calculate price values from slider positions (0-100 represents $0-$10,000)
  const minPriceValue = Math.round(sliderMin * 100);
  const maxPriceValue = Math.round(sliderMax * 100);

  const handleSliderTrackPress = (evt: any) => {
    if (sliderTrackLayout.width === 0) return;
    const { locationX } = evt.nativeEvent;
    const percentage = Math.max(0, Math.min(100, (locationX / sliderTrackLayout.width) * 100));
    
    // Determine which handle to move based on which is closer
    const distanceToMin = Math.abs(percentage - sliderMin);
    const distanceToMax = Math.abs(percentage - sliderMax);
    
    if (distanceToMin < distanceToMax) {
      const newMin = Math.min(percentage, sliderMax - 1);
      setSliderMin(newMin);
    } else {
      const newMax = Math.max(percentage, sliderMin + 1);
      setSliderMax(newMax);
    }
  };

  const updateSliderValue = (pageX: number, handle: 'min' | 'max') => {
    if (sliderTrackLayout.width === 0) return;
    const relativeX = pageX - sliderTrackLayout.x;
    const percentage = Math.max(0, Math.min(100, (relativeX / sliderTrackLayout.width) * 100));
    
    if (handle === 'min') {
      const newMin = Math.min(percentage, sliderMax - 1);
      setSliderMin(newMin);
    } else {
      const newMax = Math.max(percentage, sliderMin + 1);
      setSliderMax(newMax);
    }
  };

  const minPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setDraggingHandle('min'),
    onPanResponderMove: (evt) => {
      updateSliderValue(evt.nativeEvent.pageX, 'min');
    },
    onPanResponderRelease: () => setDraggingHandle(null),
  });

  const maxPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setDraggingHandle('max'),
    onPanResponderMove: (evt) => {
      updateSliderValue(evt.nativeEvent.pageX, 'max');
    },
    onPanResponderRelease: () => setDraggingHandle(null),
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="heart-outline" size={24} color="#1976d2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="list" size={24} color="#1976d2" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#1976d2" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Buttons */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              (activeFilter === 'price' || (minPrice || maxPrice)) && styles.filterButtonActive
            ]}
            onPress={() => {
              setActiveFilter('price');
              setShowPriceFilter(true);
            }}
          >
            <Text style={[
              styles.filterButtonText,
              (activeFilter === 'price' || (minPrice || maxPrice)) && styles.filterButtonTextActive
            ]}>
              {getPriceButtonText()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              (activeFilter === 'rentalType' || selectedRentalTypes.length > 0) && styles.filterButtonActive
            ]}
            onPress={() => {
              setActiveFilter('rentalType');
              setShowRentalTypeFilter(true);
            }}
          >
            <Text style={[
              styles.filterButtonText,
              (activeFilter === 'rentalType' || selectedRentalTypes.length > 0) && styles.filterButtonTextActive
            ]}>
              {getRentalTypeButtonText()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              (activeFilter === 'beds' || selectedBeds !== 'Any') && styles.filterButtonActive
            ]}
            onPress={() => {
              setActiveFilter('beds');
              setShowBedsFilter(true);
            }}
          >
            <Text style={[
              styles.filterButtonText,
              (activeFilter === 'beds' || selectedBeds !== 'Any') && styles.filterButtonTextActive
            ]}>
              {getBedsButtonText()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              (activeFilter === 'more' || hasMoreFilters()) && styles.filterButtonActive
            ]}
            onPress={() => {
              setActiveFilter('more');
              navigation.navigate('Filters', {
                selectedBathrooms,
                selectedPets,
                yearBuilt,
                squareFeet,
                acceptsOnlineApplications,
              });
            }}
          >
            <Text style={[
              styles.filterButtonText,
              (activeFilter === 'more' || hasMoreFilters()) && styles.filterButtonTextActive
            ]}>
              {getMoreButtonText()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={48} color="#CCCCCC" />
            <Text style={styles.mapPlaceholderText}>Map View</Text>
            <Text style={styles.mapPlaceholderSubtext}>Map integration coming soon</Text>
          </View>
        </View>

        {/* Save Search Button */}
        <TouchableOpacity style={styles.saveSearchButton}>
          <Ionicons name="notifications-outline" size={20} color="#FFFFFF" style={styles.saveSearchIcon} />
          <Text style={styles.saveSearchText}>Save Search</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Price Filter Drawer */}
      <Modal
        visible={showPriceFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPriceFilter(false);
          setActiveFilter(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowPriceFilter(false);
            setActiveFilter(null);
          }}
        >
          <View style={[styles.filterDrawer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Price Range</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPriceFilter(false);
                  setActiveFilter(null);
                }}
                style={styles.filterDrawerClose}
              >
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterDrawerContent}>
              {/* Price Input Fields */}
              <View style={styles.priceInputsContainer}>
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.priceInputLabel}>Min</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="$ No Min"
                    placeholderTextColor="#999999"
                    value={minPrice}
                    onChangeText={setMinPrice}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.priceInputSeparator}>-</Text>
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.priceInputLabel}>Max</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="$ No Max"
                    placeholderTextColor="#999999"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Price Range Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>Min.</Text>
                  <Text style={styles.sliderLabel}>Max.</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleSliderTrackPress}
                  style={styles.sliderTrack}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    setSliderTrackLayout({ x, width });
                  }}
                >
                  <View 
                    style={[
                      styles.sliderFill, 
                      { 
                        left: `${sliderMin}%`,
                        width: `${sliderMax - sliderMin}%`
                      }
                    ]} 
                  />
                  <View
                    {...minPanResponder.panHandlers}
                    style={[styles.sliderHandle, { left: `${sliderMin}%` }]}
                  >
                    <View style={styles.sliderHandleInner} />
                  </View>
                  <View
                    {...maxPanResponder.panHandlers}
                    style={[styles.sliderHandle, { left: `${sliderMax}%` }]}
                  >
                    <View style={styles.sliderHandleInner} />
                  </View>
                </TouchableOpacity>
                <View style={styles.sliderValues}>
                  <Text style={styles.sliderValueText}>
                    {minPriceValue === 0 ? '$ No Min' : `$${minPriceValue.toLocaleString()}`}
                  </Text>
                  <Text style={styles.sliderValueText}>
                    {maxPriceValue === 10000 ? '$ No Max' : `$${maxPriceValue.toLocaleString()}`}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.filterDrawerActions}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setSliderMin(0);
                    setSliderMax(100);
                  }}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.showResultsButton}
                  onPress={() => {
                    setShowPriceFilter(false);
                    // TODO: Apply filters and show results
                  }}
                >
                  <Text style={styles.showResultsButtonText}>Show Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rental Type Filter Drawer */}
      <Modal
        visible={showRentalTypeFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowRentalTypeFilter(false);
          setActiveFilter(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowRentalTypeFilter(false);
            setActiveFilter(null);
          }}
        >
          <View style={[styles.filterDrawer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Rental Type</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRentalTypeFilter(false);
                  setActiveFilter(null);
                }}
                style={styles.filterDrawerClose}
              >
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterDrawerContent}>
              {/* Rental Type Options */}
              <View style={styles.rentalTypeList}>
                {['House', 'Apartment', 'Condo', 'Multiplex', 'Townhome', 'Single Room'].map((type) => {
                  const isSelected = selectedRentalTypes.includes(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={styles.rentalTypeOption}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedRentalTypes(selectedRentalTypes.filter(t => t !== type));
                        } else {
                          setSelectedRentalTypes([...selectedRentalTypes, type]);
                        }
                      }}
                    >
                      <Text style={styles.rentalTypeOptionText}>{type}</Text>
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

              {/* Action Buttons */}
              <View style={styles.filterDrawerActions}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setSelectedRentalTypes([]);
                  }}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.showResultsButton}
                  onPress={() => {
                    setShowRentalTypeFilter(false);
                    // TODO: Apply filters and show results
                  }}
                >
                  <Text style={styles.showResultsButtonText}>Show Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Beds Filter Drawer */}
      <Modal
        visible={showBedsFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowBedsFilter(false);
          setActiveFilter(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowBedsFilter(false);
            setActiveFilter(null);
          }}
        >
          <View style={[styles.filterDrawer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Beds</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowBedsFilter(false);
                  setActiveFilter(null);
                }}
                style={styles.filterDrawerClose}
              >
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterDrawerContent}>
              {/* Bed Options */}
              <View style={styles.bedsOptionsContainer}>
                {['Any', 'Studio', '1', '2', '3', '4', '5+'].map((bedOption) => {
                  const isSelected = selectedBeds === bedOption;
                  return (
                    <TouchableOpacity
                      key={bedOption}
                      style={[
                        styles.bedOptionButton,
                        isSelected && styles.bedOptionButtonActive
                      ]}
                      onPress={() => setSelectedBeds(bedOption)}
                    >
                      <Text style={[
                        styles.bedOptionText,
                        isSelected && styles.bedOptionTextActive
                      ]}>
                        {bedOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.filterDrawerActions}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setSelectedBeds('Any');
                  }}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.showResultsButton}
                  onPress={() => {
                    setShowBedsFilter(false);
                    // TODO: Apply filters and show results
                  }}
                >
                  <Text style={styles.showResultsButtonText}>Show Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Beds Filter Drawer */}
      <Modal
        visible={showBedsFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowBedsFilter(false);
          setActiveFilter(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowBedsFilter(false);
            setActiveFilter(null);
          }}
        >
          <View style={[styles.filterDrawer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Beds</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowBedsFilter(false);
                  setActiveFilter(null);
                }}
                style={styles.filterDrawerClose}
              >
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterDrawerContent}>
              {/* Bed Options */}
              <View style={styles.bedsOptionsContainer}>
                {['Any', 'Studio', '1', '2', '3', '4', '5+'].map((bedOption) => {
                  const isSelected = selectedBeds === bedOption;
                  return (
                    <TouchableOpacity
                      key={bedOption}
                      style={[
                        styles.bedOptionButton,
                        isSelected && styles.bedOptionButtonActive
                      ]}
                      onPress={() => setSelectedBeds(bedOption)}
                    >
                      <Text style={[
                        styles.bedOptionText,
                        isSelected && styles.bedOptionTextActive
                      ]}>
                        {bedOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.filterDrawerActions}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setSelectedBeds('Any');
                  }}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.showResultsButton}
                  onPress={() => {
                    setShowBedsFilter(false);
                    // TODO: Apply filters and show results
                  }}
                >
                  <Text style={styles.showResultsButtonText}>Show Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterDrawer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  filterDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterDrawerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  filterDrawerClose: {
    padding: 4,
  },
  filterDrawerContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  priceInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  priceInputSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginTop: 24,
  },
  sliderContainer: {
    marginBottom: 32,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    position: 'relative',
    marginBottom: 12,
  },
  sliderFill: {
    height: 4,
    backgroundColor: '#1976d2',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  sliderHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1976d2',
    position: 'absolute',
    top: -10,
    marginLeft: -12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderHandleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1976d2',
  },
  sliderValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  filterDrawerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1976d2',
  },
  showResultsButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    flex: 1,
    marginLeft: 16,
    alignItems: 'center',
  },
  showResultsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mapContainer: {
    height: 500,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 4,
  },
  saveSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveSearchIcon: {
    marginRight: 8,
  },
  saveSearchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rentalTypeList: {
    marginBottom: 32,
  },
  rentalTypeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  rentalTypeOptionText: {
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
  bedsOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  bedOptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    minWidth: 80,
    alignItems: 'center',
  },
  bedOptionButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  bedOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  bedOptionTextActive: {
    color: '#FFFFFF',
  },
});
