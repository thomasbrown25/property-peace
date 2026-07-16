import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Autocomplete,
  Button,
  Grid
} from '@mui/material';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import amenityApi from 'api/amenity';
import featureApi from 'api/feature';
import { openSnackbar } from 'api/snackbar';

// Recommended options when API has no basic amenities (match SeedBasicAmenities.sql). Use negative ids for fallback; only ids > 0 are sent on save.
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

// API may return category as enum number: 0=Parking, 1=Laundry, 2=AirConditioning
const BASIC_CATEGORY_VALUES = { Parking: 0, Laundry: 1, AirConditioning: 2 };

// Fallback default options when API returns none (match SeedDefaultAmenities.sql). Use negative ids; only ids > 0 are sent on save.
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

// Normalize listing item to { id, name, category, isCustom } (API may use Id/Name/Category/IsCustom)
const norm = (a) => ({
  id: a?.id ?? a?.Id,
  name: a?.name ?? a?.Name ?? '',
  category: a?.category ?? a?.Category,
  isCustom: a?.isCustom === true || a?.IsCustom === true
});

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    bgcolor: 'background.paper'
  },
  '& .MuiInputLabel-root': {
    display: 'none'
  },
  '& legend': {
    display: 'none'
  },
  '& fieldset': {
    top: 0
  }
};

function AmenityField({ label, children }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" fontWeight={600} color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export default function ListingAmenitiesStep({
  formData,
  setFormData,
  savedBasicAmenities = [],
  savedPropertyAmenities = [],
  savedPropertyFeatures = []
}) {
  const [basicAmenities, setBasicAmenities] = useState([]);
  const [defaultAmenities, setDefaultAmenities] = useState([]);
  const [defaultFeatures, setDefaultFeatures] = useState([]);
  const [customAmenities, setCustomAmenities] = useState([]);
  const [customFeatures, setCustomFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCustomAmenityName, setNewCustomAmenityName] = useState('');
  const [showAddCustomAmenity, setShowAddCustomAmenity] = useState(false);
  const [newCustomFeatureName, setNewCustomFeatureName] = useState('');
  const [showAddCustomFeature, setShowAddCustomFeature] = useState(false);

  const savedBasic = Array.isArray(savedBasicAmenities) ? savedBasicAmenities.map(norm).filter((a) => a.id != null) : [];
  const savedPropA = Array.isArray(savedPropertyAmenities) ? savedPropertyAmenities.map(norm).filter((a) => a.id != null) : [];
  const savedPropF = Array.isArray(savedPropertyFeatures) ? savedPropertyFeatures.map(norm).filter((a) => a.id != null) : [];

  useEffect(() => {
    loadAmenities();
  }, []);

  const loadAmenities = async () => {
    try {
      setLoading(true);
      const [basicRes, defaultAmenityRes, customAmenityRes, defaultFeatureRes, customFeatureRes] = await Promise.all([
        amenityApi.getBasicAmenities(),
        amenityApi.getDefaultAmenities(),
        amenityApi.getCustomAmenities(),
        featureApi.getDefaultFeatures(),
        featureApi.getCustomFeatures()
      ]);

      if (basicRes.success) {
        setBasicAmenities(basicRes.data);
      }
      if (defaultAmenityRes.success && Array.isArray(defaultAmenityRes.data)) {
        setDefaultAmenities(defaultAmenityRes.data.length > 0 ? defaultAmenityRes.data : DEFAULT_PROPERTY_AMENITIES_FALLBACK);
      } else {
        setDefaultAmenities(DEFAULT_PROPERTY_AMENITIES_FALLBACK);
      }
      if (defaultFeatureRes.success && Array.isArray(defaultFeatureRes.data)) {
        const list = defaultFeatureRes.data.map((f) => ({ id: f.id ?? f.Id, name: f.name ?? f.Name ?? '', category: 'PropertyFeature' }));
        setDefaultFeatures(list.length > 0 ? list : DEFAULT_PROPERTY_FEATURES_FALLBACK);
      } else {
        setDefaultFeatures(DEFAULT_PROPERTY_FEATURES_FALLBACK);
      }
      if (customAmenityRes.success) {
        setCustomAmenities(customAmenityRes.data ?? []);
      }
      if (customFeatureRes.success) {
        const list = (customFeatureRes.data ?? []).map((f) => ({ id: f.id ?? f.Id, name: f.name ?? f.Name ?? '', isCustom: true }));
        setCustomFeatures(list);
      }
    } catch (error) {
      console.error('Error loading amenities and features:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomAmenity = async () => {
    if (!newCustomAmenityName.trim()) return;
    try {
      const response = await amenityApi.createCustomAmenity({
        name: newCustomAmenityName.trim(),
        category: 'PropertyAmenity'
      });
      if (response.success) {
        setCustomAmenities([...customAmenities, response.data]);
        setFormData(prev => ({
          ...prev,
          customAmenityIds: [...(prev.customAmenityIds ?? []), response.data.id]
        }));
        setNewCustomAmenityName('');
        setShowAddCustomAmenity(false);
        openSnackbar({
          open: true,
          message: 'Custom amenity added successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({ message: response.message ?? 'Failed to add custom amenity', severity: 'error' });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to add custom amenity',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleAddCustomFeature = async () => {
    if (!newCustomFeatureName.trim()) return;
    try {
      const response = await featureApi.createCustomFeature({ name: newCustomFeatureName.trim() });
      if (response.success) {
        setCustomFeatures([...customFeatures, response.data]);
        setFormData(prev => ({
          ...prev,
          customFeatureIds: [...(prev.customFeatureIds ?? []), response.data.id]
        }));
        setNewCustomFeatureName('');
        setShowAddCustomFeature(false);
        openSnackbar({ message: 'Custom feature added', severity: 'success' });
      } else {
        openSnackbar({ message: response.message ?? 'Failed to add custom feature', severity: 'error' });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to add custom feature',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Get basic amenity options by category. Use listing's saved BasicAmenityIds first so pre-selection always has a matching option.
  const getBasicAmenityOptions = (category) => {
    const categoryNum = BASIC_CATEGORY_VALUES[category];
    const matchCategory = (a) => {
      const c = a?.category ?? a?.Category;
      const cStr = String(c ?? '').toLowerCase();
      const categoryStr = String(category ?? '').toLowerCase();
      return cStr === categoryStr || (typeof categoryNum === 'number' && Number(c) === categoryNum);
    };
    const fromSaved = savedBasic.filter(matchCategory);
    const fromApi = (basicAmenities || []).filter(matchCategory);
    const savedIds = new Set(fromSaved.map((a) => Number(a.id)));
    const merged = [...fromSaved, ...fromApi.filter((a) => !savedIds.has(Number(a.id)))];
    return merged.length > 0 ? merged : (BASIC_AMENITY_RECOMMENDED[category] || []);
  };

  // Handle basic amenity selection (option can be from API or recommended fallback)
  const handleBasicAmenityChange = (category, option) => {
    const options = getBasicAmenityOptions(category);
    const amenity = options.find((a) => a.name === (option?.name ?? option));
    if (!amenity) return;
    const amenityId = Number(amenity.id);
    setFormData((prev) => {
      const currentIds = prev.basicAmenityIds || [];
      const othersInCategory = options.map((a) => Number(a.id));
      const filtered = currentIds.filter((id) => !othersInCategory.includes(Number(id)));
      return {
        ...prev,
        basicAmenityIds: [...filtered, amenityId]
      };
    });
  };

  // Get selected basic amenity id for a category (so we match by id with Number() for API string/number)
  const getSelectedBasicAmenityId = (category) => {
    const options = getBasicAmenityOptions(category);
    const id = formData.basicAmenityIds?.find((id) =>
      options.some((a) => Number(a.id) === Number(id))
    );
    return id != null ? id : null;
  };

  // Get selected basic amenity option object for Autocomplete value (match by id)
  const getSelectedBasicAmenityOption = (category) => {
    const selectedId = getSelectedBasicAmenityId(category);
    if (selectedId == null) return null;
    const options = getBasicAmenityOptions(category);
    const option = options.find((a) => Number(a.id) === Number(selectedId)) ?? null;
    return option;
  };

  // Handle amenity/feature toggle
  const handleToggleAmenity = (id, type) => {
    setFormData(prev => {
      const key = type === 'amenity' ? 'defaultAmenityIds' : 'defaultFeatureIds';
      const currentIds = prev[key] || [];
      if (currentIds.includes(id)) {
        return { ...prev, [key]: currentIds.filter(i => i !== id) };
      } else {
        return { ...prev, [key]: [...currentIds, id] };
      }
    });
  };

  const isIdInList = (list, optionId) =>
    (list ?? []).some((id) => Number(id) === Number(optionId));

  // Merge saved listing amenities/features into display lists so saved ids (e.g. 34,35,36) show as options and selected
  const isPropertyAmenity = (a) => a.category === 'PropertyAmenity' || a.category === 3;
  const isPropertyFeature = (a) => a.category === 'PropertyFeature' || a.category === 4;
  const defaultAmenityIds = new Set(defaultAmenities.map((a) => Number(a.id)));
  const defaultFeatureIdsSet = new Set(defaultFeatures.map((a) => Number(a.id)));
  const defaultAmenitiesDisplay = [
    ...defaultAmenities,
    ...savedPropA.filter((s) => isPropertyAmenity(s) && !s.isCustom && !defaultAmenityIds.has(Number(s.id)))
  ];
  const defaultFeaturesDisplay = [
    ...defaultFeatures,
    ...savedPropF.filter((s) => isPropertyFeature(s) && !s.isCustom && !defaultFeatureIdsSet.has(Number(s.id)))
  ];
  const customAmenityIdsSet = new Set((customAmenities || []).map((a) => Number(a.id)));
  const customFeatureIdsSet = new Set((customFeatures || []).map((a) => Number(a.id)));
  const customAmenitiesDisplay = [
    ...customAmenities,
    ...savedPropA.filter((s) => isPropertyAmenity(s) && s.isCustom && !customAmenityIdsSet.has(Number(s.id)))
  ];
  const customFeaturesDisplay = [
    ...customFeatures,
    ...savedPropF.filter((s) => isPropertyFeature(s) && s.isCustom && !customFeatureIdsSet.has(Number(s.id)))
  ];

  const handleToggleCustomAmenity = (id, type) => {
    setFormData(prev => {
      const key = type === 'amenity' ? 'customAmenityIds' : 'customFeatureIds';
      const currentIds = prev[key] || [];
      if (currentIds.includes(id)) {
        return { ...prev, [key]: currentIds.filter(i => i !== id) };
      } else {
        return { ...prev, [key]: [...currentIds, id] };
      }
    });
  };

  const handleRemoveCustomOption = async (id, type) => {
    try {
      const response = type === 'feature'
        ? await featureApi.deleteCustomFeature(id)
        : await amenityApi.deleteCustomAmenity(id);
      if (response.success) {
        if (type === 'amenity') {
          setCustomAmenities((prev) => prev.filter((a) => a.id !== id));
          setFormData((prev) => ({
            ...prev,
            customAmenityIds: (prev.customAmenityIds || []).filter((i) => i !== id)
          }));
        } else {
          setCustomFeatures((prev) => prev.filter((f) => f.id !== id));
          setFormData((prev) => ({
            ...prev,
            customFeatureIds: (prev.customFeatureIds || []).filter((i) => i !== id)
          }));
        }
        openSnackbar({
          open: true,
          message: type === 'amenity' ? 'Custom amenity removed' : 'Custom feature removed',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else throw new Error(response?.message);
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to remove',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  if (loading) {
    return <Box sx={{ textAlign: 'center', py: 4 }}>Loading amenities...</Box>;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
        Amenities & Features
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
        Select the amenities and features for this listing.
      </Typography>

      <Stack spacing={4} sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Basic Amenities */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Basic Amenities
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose the essential amenities available for this property.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <AmenityField label="Parking">
                <Autocomplete
                  options={getBasicAmenityOptions('Parking')}
                  getOptionLabel={(option) => option?.name ?? ''}
                  isOptionEqualToValue={(opt, val) => opt && val && Number(opt.id) === Number(val.id)}
                  value={getSelectedBasicAmenityOption('Parking')}
                  onChange={(e, newValue) => handleBasicAmenityChange('Parking', newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="" placeholder="e.g. Garage" sx={fieldSx} />
                  )}
                />
              </AmenityField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <AmenityField label="Laundry">
                <Autocomplete
                  options={getBasicAmenityOptions('Laundry')}
                  getOptionLabel={(option) => option?.name ?? ''}
                  isOptionEqualToValue={(opt, val) => opt && val && Number(opt.id) === Number(val.id)}
                  value={getSelectedBasicAmenityOption('Laundry')}
                  onChange={(e, newValue) => handleBasicAmenityChange('Laundry', newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="" placeholder="e.g. In unit" sx={fieldSx} />
                  )}
                />
              </AmenityField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <AmenityField label="Air conditioning">
                <Autocomplete
                  options={getBasicAmenityOptions('AirConditioning')}
                  getOptionLabel={(option) => option?.name ?? ''}
                  isOptionEqualToValue={(opt, val) => opt && val && Number(opt.id) === Number(val.id)}
                  value={getSelectedBasicAmenityOption('AirConditioning')}
                  onChange={(e, newValue) => handleBasicAmenityChange('AirConditioning', newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="" placeholder="e.g. Central" sx={fieldSx} />
                  )}
                />
              </AmenityField>
            </Grid>
          </Grid>
        </Box>

        {/* Property Amenities */}
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            Property Amenities
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the amenities for this listing. Click to toggle.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
            {defaultAmenitiesDisplay.map((amenity) => (
              <Button
                key={amenity.id}
                variant={isIdInList(formData.defaultAmenityIds, amenity.id) ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleToggleAmenity(amenity.id, 'amenity')}
                sx={{ textTransform: 'none' }}
              >
                {amenity.name}
              </Button>
            ))}
            {customAmenitiesDisplay.map((amenity) => {
              const isSelected = isIdInList(formData.customAmenityIds, amenity.id);
              return (
                <Box
                  key={amenity.id}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '1px solid',
                    borderColor: isSelected ? 'transparent' : 'primary.main',
                    borderRadius: 10,
                    bgcolor: isSelected ? 'primary.main' : 'transparent',
                    color: isSelected ? 'primary.contrastText' : 'primary.main',
                    fontSize: '0.8125rem',
                    minHeight: 32,
                    '&:hover': {
                      bgcolor: isSelected ? 'primary.dark' : 'action.hover'
                    }
                  }}
                >
                  <Box
                    component="span"
                    onClick={() => handleToggleCustomAmenity(amenity.id, 'amenity')}
                    sx={{ px: 1.25, py: 0.75, cursor: 'pointer', textTransform: 'none' }}
                  >
                    {amenity.name}
                  </Box>
                  <Box
                    component="span"
                    data-remove-custom
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveCustomOption(amenity.id, 'amenity');
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pl: 0.75,
                      pr: 0.75,
                      py: 0.5,
                      cursor: 'pointer',
                      color: 'inherit',
                      '&:hover': { opacity: 0.85 }
                    }}
                    aria-label="Remove custom amenity"
                  >
                    <CloseOutlined style={{ fontSize: 12 }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
          {showAddCustomAmenity ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                label=""
                placeholder="e.g. Private entrance"
                value={newCustomAmenityName}
                onChange={(e) => setNewCustomAmenityName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddCustomAmenity();
                }}
                sx={fieldSx}
              />
              <Button size="small" variant="contained" onClick={handleAddCustomAmenity}>
                Add
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setShowAddCustomAmenity(false);
                  setNewCustomAmenityName('');
                }}
              >
                Cancel
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              startIcon={<PlusOutlined />}
              onClick={() => setShowAddCustomAmenity(true)}
              sx={{ color: 'primary.main', textTransform: 'none' }}
            >
              Add custom amenity
            </Button>
          )}
        </Box>

        {/* Property Features */}
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            Property features
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose the in-unit and building features included with this property.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
            {defaultFeaturesDisplay.map((feature) => (
              <Button
                key={feature.id}
                variant={isIdInList(formData.defaultFeatureIds, feature.id) ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleToggleAmenity(feature.id, 'feature')}
                sx={{ textTransform: 'none' }}
              >
                {feature.name}
              </Button>
            ))}
            {customFeaturesDisplay.map((feature) => {
              const isSelected = isIdInList(formData.customFeatureIds, feature.id);
              return (
                <Box
                  key={feature.id}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '1px solid',
                    borderColor: isSelected ? 'transparent' : 'primary.main',
                    borderRadius: 10,
                    bgcolor: isSelected ? 'primary.main' : 'transparent',
                    color: isSelected ? 'primary.contrastText' : 'primary.main',
                    fontSize: '0.8125rem',
                    minHeight: 32,
                    '&:hover': {
                      bgcolor: isSelected ? 'primary.dark' : 'action.hover'
                    }
                  }}
                >
                  <Box
                    component="span"
                    onClick={() => handleToggleCustomAmenity(feature.id, 'feature')}
                    sx={{ px: 1.25, py: 0.75, cursor: 'pointer', textTransform: 'none' }}
                  >
                    {feature.name}
                  </Box>
                  <Box
                    component="span"
                    data-remove-custom
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveCustomOption(feature.id, 'feature');
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pl: 0.75,
                      pr: 0.75,
                      py: 0.5,
                      cursor: 'pointer',
                      color: 'inherit',
                      '&:hover': { opacity: 0.85 }
                    }}
                    aria-label="Remove custom feature"
                  >
                    <CloseOutlined style={{ fontSize: 12 }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
          {showAddCustomFeature ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5 }}>
              <TextField
                size="small"
                label=""
                placeholder="e.g. Rooftop deck"
                value={newCustomFeatureName}
                onChange={(e) => setNewCustomFeatureName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddCustomFeature();
                }}
                sx={fieldSx}
              />
              <Button size="small" variant="contained" onClick={handleAddCustomFeature}>
                Add
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setShowAddCustomFeature(false);
                  setNewCustomFeatureName('');
                }}
              >
                Cancel
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              startIcon={<PlusOutlined />}
              onClick={() => setShowAddCustomFeature(true)}
              sx={{ color: 'primary.main', textTransform: 'none' }}
            >
              Add custom feature
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
