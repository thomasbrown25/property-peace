/**
 * Fallback amenity/feature options when API returns empty (negative ids).
 * Used to build name+category payload so backend can resolve to real ids and persist.
 */

const BASIC_AMENITY_RECOMMENDED = {
  Parking: [
    { id: -1, name: 'Street parking', category: 'Parking' },
    { id: -2, name: 'Garage', category: 'Parking' },
    { id: -3, name: 'Parking lot', category: 'Parking' },
    { id: -4, name: 'Driveway', category: 'Parking' },
    { id: -5, name: 'No parking', category: 'Parking' }
  ],
  Laundry: [
    { id: -10, name: 'In unit', category: 'Laundry' },
    { id: -11, name: 'In building', category: 'Laundry' },
    { id: -12, name: 'Hookups only', category: 'Laundry' },
    { id: -13, name: 'No laundry', category: 'Laundry' }
  ],
  AirConditioning: [
    { id: -20, name: 'Central', category: 'AirConditioning' },
    { id: -21, name: 'Window units', category: 'AirConditioning' },
    { id: -22, name: 'Ductless mini-split', category: 'AirConditioning' },
    { id: -23, name: 'None', category: 'AirConditioning' }
  ]
};

const DEFAULT_PROPERTY_AMENITIES_FALLBACK = [
  { id: -1, name: 'Dishwasher', category: 'PropertyAmenity' },
  { id: -2, name: 'Air conditioning', category: 'PropertyAmenity' },
  { id: -3, name: 'Washer & dryer in unit', category: 'PropertyAmenity' },
  { id: -4, name: 'Patio', category: 'PropertyAmenity' },
  { id: -5, name: 'Hardwood flooring', category: 'PropertyAmenity' },
  { id: -6, name: 'Oversized closets', category: 'PropertyAmenity' },
  { id: -7, name: 'Fireplace', category: 'PropertyAmenity' },
  { id: -8, name: 'Refrigerator', category: 'PropertyAmenity' },
  { id: -9, name: 'Ceiling fan(s)', category: 'PropertyAmenity' },
  { id: -10, name: 'Yard', category: 'PropertyAmenity' },
  { id: -11, name: 'Utilities included', category: 'PropertyAmenity' },
  { id: -12, name: 'Furnished', category: 'PropertyAmenity' },
  { id: -13, name: 'Parking', category: 'PropertyAmenity' },
  { id: -14, name: 'Laundry', category: 'PropertyAmenity' }
];

const DEFAULT_PROPERTY_FEATURES_FALLBACK = [
  { id: -20, name: 'Gym', category: 'PropertyFeature' },
  { id: -21, name: 'Pool', category: 'PropertyFeature' },
  { id: -22, name: 'Elevator', category: 'PropertyFeature' },
  { id: -23, name: 'Storage', category: 'PropertyFeature' },
  { id: -24, name: 'Security system', category: 'PropertyFeature' },
  { id: -25, name: 'Wheelchair accessible', category: 'PropertyFeature' },
  { id: -26, name: 'Pet-friendly building', category: 'PropertyFeature' },
  { id: -27, name: 'On-site laundry', category: 'PropertyFeature' },
  { id: -28, name: 'Balcony', category: 'PropertyFeature' },
  { id: -29, name: 'Rooftop', category: 'PropertyFeature' },
  { id: -30, name: 'Parking garage', category: 'PropertyFeature' },
  { id: -31, name: 'Bike storage', category: 'PropertyFeature' }
];

const basicById = {};
Object.values(BASIC_AMENITY_RECOMMENDED).forEach((arr) => {
  arr.forEach((o) => {
    basicById[o.id] = o;
  });
});
const defaultAmenityById = {};
DEFAULT_PROPERTY_AMENITIES_FALLBACK.forEach((o) => {
  defaultAmenityById[o.id] = o;
});
const defaultFeatureById = {};
DEFAULT_PROPERTY_FEATURES_FALLBACK.forEach((o) => {
  defaultFeatureById[o.id] = o;
});

/**
 * Build selection-by-name payload for backend when formData contains negative (fallback) ids.
 * @param {object} formData - { basicAmenityIds, defaultAmenityIds, defaultFeatureIds }
 * @returns {{ basicAmenitySelections: array, defaultAmenitySelections: array, defaultFeatureSelections: array }}
 */
export function getFallbackSelections(formData) {
  const basicAmenitySelections = [];
  (formData.basicAmenityIds || []).forEach((id) => {
    const n = Number(id);
    if (n <= 0 && basicById[n]) {
      basicAmenitySelections.push({ category: basicById[n].category, name: basicById[n].name });
    }
  });
  const defaultAmenitySelections = [];
  (formData.defaultAmenityIds || []).forEach((id) => {
    const n = Number(id);
    if (n <= 0 && defaultAmenityById[n]) {
      defaultAmenitySelections.push({ category: defaultAmenityById[n].category, name: defaultAmenityById[n].name });
    }
  });
  const defaultFeatureSelections = [];
  (formData.defaultFeatureIds || []).forEach((id) => {
    const n = Number(id);
    if (n <= 0 && defaultFeatureById[n]) {
      defaultFeatureSelections.push({ category: defaultFeatureById[n].category, name: defaultFeatureById[n].name });
    }
  });
  return { basicAmenitySelections, defaultAmenitySelections, defaultFeatureSelections };
}

export { BASIC_AMENITY_RECOMMENDED, DEFAULT_PROPERTY_AMENITIES_FALLBACK, DEFAULT_PROPERTY_FEATURES_FALLBACK };
