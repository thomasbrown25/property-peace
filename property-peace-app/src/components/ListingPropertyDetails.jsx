import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import EditOutlined from '@ant-design/icons/EditOutlined';
import amenityApi from 'api/amenity';
import featureApi from 'api/feature';
import listingApi from 'api/listing';
import { openSnackbar } from 'api/snackbar';
import { getPropertyById, addOrUpdateProperty } from 'store/property/property.action';
import { selectProperty } from 'store/property/property.selector';
import { addOrUpdateUnit } from 'store/unit/unit.action';
import { setSelectedListing } from 'store/listing/listing.action';
import { propertyTypeOptions } from 'utils/models';
import { BASIC_AMENITY_RECOMMENDED, DEFAULT_PROPERTY_AMENITIES_FALLBACK, DEFAULT_PROPERTY_FEATURES_FALLBACK } from 'utils/amenityFallbacks';
import { isDetachedSingleUnitType } from 'utils/propertyType';

const propertyTypes = propertyTypeOptions.filter((option) =>
  ['singleFamily', 'multiUnit', 'townhouse', 'condominium', 'smallMultiFamily', 'apartmentBuilding', 'other'].includes(option.value)
);
const typeKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const canonicalType = (value) => propertyTypes.find((option) => typeKey(option.value) === typeKey(value))?.value ?? value;
const typeLabel = (value) => propertyTypes.find((option) => option.value === canonicalType(value))?.label
  ?.replace('Single Family Home', 'Single Family') ?? String(value ?? 'Not set');
const groups = ['basicAmenities', 'propertyAmenities', 'propertyFeatures'];
const itemId = (item) => item?.id ?? item?.Id;
const itemName = (item) => typeof item === 'string' ? item : item?.name ?? item?.Name ?? '';
const isCustom = (item) => item?.isCustom === true || item?.IsCustom === true;
const uniqueOptions = (items) => items.filter((item, index, all) => itemId(item) != null && itemName(item) &&
  all.findIndex((other) => String(itemId(other)) === String(itemId(item))) === index);
const initialAmenities = (listing) => Object.fromEntries(groups.map((group) => [group, Array.isArray(listing[group]) ? listing[group] : []]));
const namedItem = (item, group) => ({ ...(typeof item === 'object' ? item : {}), group, name: itemName(item) });

export default function ListingPropertyDetails({ listing, editPage = false }) {
  const navigate = useNavigate();
  const propertyId = listing?.propertyId;
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const [loadedId, setLoadedId] = useState(null);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [draft, setDraft] = useState(null);
  const [selectedAmenities, setSelectedAmenities] = useState(() => initialAmenities(listing));
  const [options, setOptions] = useState({ basicAmenities: [], propertyAmenities: [], propertyFeatures: [] });
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('propertyAmenities');
  const [searching, setSearching] = useState(false);

  const refreshProperty = useCallback(() => setRefreshVersion((version) => version + 1), []);
  useEffect(() => {
    let active = true;
    setLoadedId(null);
    setConfirmEdit(false);
    if (propertyId != null) {
      Promise.resolve(dispatch(getPropertyById(propertyId))).finally(() => {
        if (active) setLoadedId(String(propertyId));
      });
    }
    return () => { active = false; };
  }, [dispatch, propertyId, refreshVersion]);

  // The shared store may still contain a property selected on a different page.
  const property = loadedId === String(propertyId) && selectedProperty && String(selectedProperty.id) === String(propertyId)
    ? selectedProperty : null;
  const unit = (listing.unitId != null
    ? property?.units?.find((candidate) => String(candidate.id) === String(listing.unitId))
    : property?.units?.length === 1 && isDetachedSingleUnitType(property?.propertyType) ? property.units[0] : null) ?? null;

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;
    Promise.all([amenityApi.getBasicAmenities(), amenityApi.getDefaultAmenities(), amenityApi.getCustomAmenities(),
      featureApi.getDefaultFeatures(), featureApi.getCustomFeatures()])
      .then(([basic, defaults, custom, features, customFeatures]) => {
        if (!active) return;
        setOptions({
          basicAmenities: uniqueOptions([...(basic.data?.length ? basic.data : Object.values(BASIC_AMENITY_RECOMMENDED).flat()), ...selectedAmenities.basicAmenities]),
          propertyAmenities: uniqueOptions([...(defaults.data?.length ? defaults.data : DEFAULT_PROPERTY_AMENITIES_FALLBACK), ...(custom.data ?? []), ...selectedAmenities.propertyAmenities]),
          propertyFeatures: uniqueOptions([...(features.data?.length ? features.data : DEFAULT_PROPERTY_FEATURES_FALLBACK), ...(customFeatures.data ?? []), ...selectedAmenities.propertyFeatures])
        });
      })
      .catch(() => openSnackbar({ open: true, message: 'Could not load amenity choices.', variant: 'alert', alert: { color: 'error' } }));
    return () => { active = false; };
  }, [editing]); // Choices are fetched once per edit session; draft selections are kept separately.

  const startEdit = () => {
    navigate(`/landlord/listings/${listing.id}/edit`);
  };

  useEffect(() => {
    if (!editPage || !property || draft) return;
    setDraft({ name: property.name ?? '', propertyType: canonicalType(property.propertyType) ?? '',
      yearBuilt: property.yearBuilt ?? '', unitName: unit?.name ?? '', bedrooms: unit?.bedrooms ?? '',
      baths: unit?.baths ?? '', squareFeet: unit?.squareFeet ?? '', marketingDescription: listing.marketingDescription ?? '' });
    setSelectedAmenities(initialAmenities(listing));
    setSearch('');
    setEditing(true);
    setConfirmEdit(false);
  }, [editPage, property, unit, listing, draft]);
  const change = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));
  const selected = groups.flatMap((group) => selectedAmenities[group].map((item) => namedItem(item, group)));
  const available = options[kind].filter((item) => !selectedAmenities[kind].some((chosen) => String(itemId(chosen)) === String(itemId(item))));
  const query = search.trim();
  const matchesExisting = [...groups.flatMap((group) => [...options[group], ...selectedAmenities[group]])]
    .some((item) => itemName(item).toLowerCase() === query.toLowerCase());

  const addSelected = (item, group = kind) => {
    if (!item || selectedAmenities[group].some((chosen) => String(itemId(chosen)) === String(itemId(item)))) return;
    setSelectedAmenities((current) => ({ ...current, [group]: [...current[group], item] }));
    setSearch('');
  };
  const addCustom = async () => {
    if (!query || matchesExisting || searching) return;
    setSearching(true);
    try {
      const result = kind === 'propertyFeatures'
        ? await featureApi.createCustomFeature({ name: query })
        : await amenityApi.createCustomAmenity({ name: query, category: 'PropertyAmenity' });
      if (!result?.success || !result.data?.id) throw new Error(result?.message || 'Could not add the item.');
      const item = { ...result.data, isCustom: true };
      setOptions((current) => ({ ...current, [kind]: [...current[kind], item] }));
      addSelected(item);
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || error.message || 'Could not add the item.', variant: 'alert', alert: { color: 'error' } });
    } finally { setSearching(false); }
  };

  const save = async () => {
    if (!property || !draft?.name.trim() || !draft.propertyType) return;
    const number = (value) => value === '' ? null : Number(value);
    if ((draft.yearBuilt !== '' && (!Number.isInteger(number(draft.yearBuilt)) || number(draft.yearBuilt) < 0)) ||
      (unit && ([draft.bedrooms, draft.baths].some((value) => value !== '' && (Number.isNaN(Number(value)) || Number(value) < 0)) ||
        (draft.squareFeet !== '' && (!Number.isInteger(number(draft.squareFeet)) || number(draft.squareFeet) < 0))))) {
      openSnackbar({ open: true, message: 'Enter valid non-negative property and unit numbers.', variant: 'alert', alert: { color: 'error' } });
      return;
    }
    setSaving(true);
    try {
      // The property and unit are shared across listings. Never send editable address fields from this screen.
      await dispatch(addOrUpdateProperty({ ...property, id: property.id, name: draft.name.trim(), propertyType: draft.propertyType,
        yearBuilt: number(draft.yearBuilt), landlordId: property.landlordId,
        streetAddress: property.streetAddress, city: property.city, state: property.state, zipCode: property.zipCode }));
      if (unit) await dispatch(addOrUpdateUnit({ ...unit, id: unit.id, name: draft.unitName.trim() || unit.name,
        bedrooms: String(draft.bedrooms ?? ''), baths: String(draft.baths ?? ''), squareFeet: number(draft.squareFeet) ?? 0,
        isOccupied: unit.isOccupied, PropertyId: property.id, type: unit.type || '', rentAmount: unit.rentAmount || 0,
        amenities: unit.amenities || [], includedUtility: unit.includedUtility || [] }));
      const ids = (group, custom) => selectedAmenities[group].filter((item) => Number(itemId(item)) > 0 && isCustom(item) === custom).map(itemId);
      const fallback = (group) => selectedAmenities[group].filter((item) => Number(itemId(item)) < 0)
        .map((item) => ({ name: itemName(item), category: item.category }));
      const response = await listingApi.updateListing(listing.id, {
        id: listing.id,
        marketingDescription: draft.marketingDescription,
        basicAmenityIds: selectedAmenities.basicAmenities.map(itemId).filter((id) => Number(id) > 0),
        defaultAmenityIds: ids('propertyAmenities', false), customAmenityIds: ids('propertyAmenities', true),
        defaultFeatureIds: ids('propertyFeatures', false), customFeatureIds: ids('propertyFeatures', true),
        basicAmenitySelections: fallback('basicAmenities'), defaultAmenitySelections: fallback('propertyAmenities'),
        defaultFeatureSelections: fallback('propertyFeatures')
      });
      if (!response?.success) throw new Error(response?.message || 'Could not save listing amenities.');
      const published = await listingApi.publishListing(listing.id);
      if (!published?.success) throw new Error(published?.message || 'Changes saved, but the listing could not be published.');
      dispatch(setSelectedListing(published.data?.data ?? published.data ?? response.data?.data ?? response.data));
      setEditing(false);
      refreshProperty();
      navigate(`/landlord/listings/${listing.id}`);
      openSnackbar({ open: true, message: 'Listing changes published.', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: `${error?.response?.data?.message || error.message || 'Save failed.'} Some changes may have saved; review before retrying.`, variant: 'alert', alert: { color: 'error' } });
    } finally { setSaving(false); }
  };

  const field = (label, value, editable, fieldName, inputProps = {}) => <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={label}>
    {editing && editable ? <TextField fullWidth size="small" label={label} value={draft[fieldName]} onChange={change(fieldName)} {...inputProps} />
      : <><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={600}>{value ?? 'Not set'}</Typography></>}
  </Grid>;

  return <Stack spacing={2.5}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
      <Box>
        <Typography variant="h5" fontWeight={800}>{editPage ? 'Edit listing' : 'Property Details'}</Typography>
        <Typography variant="body2" color="text.secondary">Live details from the linked property and unit.</Typography>
      </Box>
      {editPage && <Stack direction="row" spacing={1} sx={{ ml: 'auto', flexShrink: 0 }}>
        <Button disabled={saving} onClick={() => navigate(`/landlord/listings/${listing.id}`)}>Cancel</Button>
        <Button variant="contained" disabled={saving || !editing || !draft?.name.trim() || !draft?.propertyType || (listing.unitId != null && !unit)} onClick={save}>{saving ? 'Publishing…' : 'Publish'}</Button>
      </Stack>}
      {!editPage && property && !editing && <Tooltip title="Edit property details"><IconButton aria-label="Edit property details" onClick={() => setConfirmEdit(true)}><EditOutlined /></IconButton></Tooltip>}
    </Stack>
    {property ? <>
      <Grid container spacing={2}>
        {field('Property', property.name, true, 'name', { required: true })}
        {field('Address', [property.streetAddress, property.city, property.state, property.zipCode].filter(Boolean).join(', '), false)}
        {field('Property type', typeLabel(property.propertyType), true, 'propertyType', { select: true, required: true,
          children: propertyTypes.map((type) => <MenuItem key={type.value} value={type.value}>{typeLabel(type.value)}</MenuItem>) })}
        {field('Year Built', property?.yearBuilt, true, 'yearBuilt', { type: 'number', slotProps: { htmlInput: { min: 0, step: 1 } } })}
        {unit && <>
          {field('Unit', unit.name, true, 'unitName')}
          {field('Bedrooms', unit?.bedrooms, true, 'bedrooms', { type: 'number', slotProps: { htmlInput: { min: 0, step: 1 } } })}
          {field('Bathrooms', unit?.baths, true, 'baths', { type: 'number', slotProps: { htmlInput: { min: 0, step: 0.5 } } })}
          {field('Square Feet', unit?.squareFeet != null ? `${Number(unit.squareFeet).toLocaleString()} sqft` : null, true, 'squareFeet', { type: 'number', slotProps: { htmlInput: { min: 0, step: 1 } } })}
        </>}
      </Grid>
      {listing.unitId != null && !unit && <Typography color="warning.main" variant="body2">Linked unit could not be found on this property.</Typography>}
    </> : <Typography color="text.secondary" variant="body2">
      {propertyId == null ? 'No property is linked to this listing.' : loadedId !== String(propertyId) ? 'Loading linked property…' : 'Linked property unavailable.'}
    </Typography>}

    {editing && <TextField label="Listing description" multiline minRows={5} fullWidth value={draft.marketingDescription} onChange={change('marketingDescription')} />}
    {!editing && listing.marketingDescription && <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Listing Description</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>
        {listing.marketingDescription}
      </Typography>
    </Box>}

    {(editing || selected.length > 0 || groups.some((group) => listing[group]?.length)) && <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Amenities & Features</Typography>
      {editing && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }} sx={{ mb: selected.length ? 2 : 0 }}>
        <TextField select size="small" label="Type" value={kind} onChange={(event) => { setKind(event.target.value); setSearch(''); }} sx={{ minWidth: 160 }}>
          <MenuItem value="propertyAmenities">Amenity</MenuItem><MenuItem value="propertyFeatures">Feature</MenuItem>
          <MenuItem value="basicAmenities">Basic amenity</MenuItem>
        </TextField>
        <Autocomplete freeSolo options={available} getOptionLabel={itemName} inputValue={search}
          onInputChange={(_, value) => setSearch(value)} onChange={(_, value) => {
            if (value && typeof value !== 'string') addSelected(value);
          }} sx={{ minWidth: 220, flex: 1 }}
          renderInput={(params) => <TextField {...params} size="small" label="Search amenities and features" />} />
        {query && !matchesExisting && kind !== 'basicAmenities' && <Button variant="outlined" disabled={searching} onClick={addCustom} sx={{ whiteSpace: 'nowrap', minHeight: 40 }}>Add “{query}”</Button>}
      </Stack>}
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
        {(editing ? selected : groups.flatMap((group) => (listing[group] ?? []).map((item) => namedItem(item, group)))).map((item, index) =>
          <Chip key={`${item.group}-${itemId(item) ?? item.name}-${index}`} label={item.name} size="small"
            onDelete={editing ? () => setSelectedAmenities((current) => ({ ...current,
              [item.group]: current[item.group].filter((chosen) => itemId(item) != null
                ? String(itemId(chosen)) !== String(itemId(item)) : itemName(chosen) !== item.name) })) : undefined} />)}
      </Stack>
    </Box>}

    <Dialog open={confirmEdit && !!property} onClose={() => setConfirmEdit(false)} aria-labelledby="edit-property-warning">
      <DialogTitle id="edit-property-warning">Edit property details?</DialogTitle>
      <DialogContent><Typography>Changes to the property or unit will appear everywhere they are used, not just on this listing. The address cannot be changed here. Continue?</Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmEdit(false)}>Cancel</Button><Button variant="contained" onClick={startEdit}>Continue to edit</Button></DialogActions>
    </Dialog>
  </Stack>;
}
ListingPropertyDetails.propTypes = { listing: PropTypes.object.isRequired, editPage: PropTypes.bool };
