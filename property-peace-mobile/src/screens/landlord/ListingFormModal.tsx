import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteListingPhoto, getListing, getListingOptions, getListingPhotos, saveListing, setListingCover, uploadListingPhotos, type Listing, type ListingOption, type ListingPhoto, type ListingPhotoUpload } from '../../api/listingAPI';
import { listingAmenityKeys, listingBooleans, listingError, listingInitial, listingNumbers, type ListingAmenityKey, type ListingForm, type ListingField } from '../../features/rentals/listingForm';
import { useAppTheme } from '../../theme/AppTheme';
import { FormAction, FormSwitch, FormText, formTitle } from './RentalFormFields';
import { multiUnit, PropertyUnitPicker } from './PropertyUnitPicker';
import type { Property } from '../../api/propertyAPI';

const groups: { title: string; fields: ListingField[] }[] = [
  { title: 'Property & pricing', fields: ['squareFeet', 'monthlyRent', 'securityDeposit', 'yearBuilt', 'dateAvailable'] },
  { title: 'Lease & pets', fields: ['minLeaseDuration', 'maxLeaseDuration', 'additionalLeaseTermsNotes', 'petsAllowed'] },
  { title: 'Marketing', fields: ['marketingDescription', 'videoTourUrl'] },
  { title: 'Applications & screening', fields: ['acceptOnlineApplications', 'applicationFeeRequired', 'applicationFee', 'requireScreening', 'requireIncomeVerification', 'incomeVerificationCost'] },
  { title: 'Listing contact', fields: ['listingContactName', 'listingContactPhone', 'listingContactEmail'] },
  { title: 'Distribution', fields: ['syndicateToListingWebsite', 'syndicateToFreeSites', 'syndicateToPremiumSites'] },
];
const amenityTitles: Record<ListingAmenityKey, string> = { basicAmenityIds: 'Basic amenities', defaultAmenityIds: 'Property amenities', customAmenityIds: 'Custom amenities', defaultFeatureIds: 'Features', customFeatureIds: 'Custom features' };

export default function ListingFormModal({ visible, scope, item, onClose, onSaved }: { visible: boolean; scope: string; item?: Listing; onClose: () => void; onSaved: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(() => listingInitial(item));
  const [original, setOriginal] = useState<ListingForm | null>(null);
  const [requiresUnit, setRequiresUnit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getListingOptions>> | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<ListingPhotoUpload[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const currentId = savedId ?? item?.id;
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setForm(listingInitial(item)); setOriginal(null); setError(''); setRequiresUnit(!!item?.unitId);
    setOptions(null); setPhotos([]); setPendingPhotos([]); setSavedId(null); setLoading(true);
    Promise.all([getListingOptions(), item?.id ? getListing(item.id) : Promise.resolve(null), item?.id ? getListingPhotos(item.id) : Promise.resolve([])])
      .then(([catalog, detail, images]) => { if (live) { setOptions(catalog); setPhotos(images); if (detail) { const loaded = listingInitial(detail); setOriginal(loaded); setForm(loaded); } } })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load listing setup. Close and try again.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [visible, item?.id, scope]);
  const change = (key: ListingField, value: string | boolean) => { setForm(previous => ({ ...previous, [key]: value })); setError(''); };
  const toggle = (key: ListingAmenityKey, id: number) => { setForm(previous => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter(value => value !== id) : [...previous[key], id] })); setError(''); };
  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access in Settings to add listing photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
    if (!result.canceled) setPendingPhotos(previous => [...previous, ...result.assets.map((asset, index) => ({ uri: asset.uri, name: asset.fileName || `listing-${Date.now()}-${index}.jpg`, type: asset.mimeType || 'image/jpeg' }))]);
  };
  const photoAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); if (currentId) setPhotos(await getListingPhotos(currentId)); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update photo.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy || loading || !options || (item && !original) || !scope) return;
    const problem = listingError(form, requiresUnit, original ?? undefined);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      // A created draft is retained when image upload fails, so retry cannot create a duplicate.
      const result = await saveListing(form, currentId);
      if (!currentId) setSavedId(result.id);
      setOriginal(form);
      onSaved();
      if (pendingPhotos.length) {
        try { await uploadListingPhotos(result.id, pendingPhotos); setPendingPhotos([]); }
        catch (reason) { throw new Error(`Listing saved, but photos were not uploaded. Retry Save to upload them. ${reason instanceof Error ? reason.message : ''}`); }
      }
      onClose(); onSaved();
      Alert.alert(item ? 'Listing updated' : 'Draft listing created', 'Your listing and photos were saved. Publishing is a separate step.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save listing. Try again.'); }
    finally { setBusy(false); }
  };
  const section = (title: string) => <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 19, fontWeight: '700', marginTop: 24 }}>{title}</Text>;
  return <Modal visible={visible && !!scope} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }}>
    <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{item ? 'Edit listing' : 'New listing'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close listing form" onPress={onClose} style={{ padding: 14 }}><Text style={{ color: colors.accent }}>Close</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: 50 }}>
      {item || savedId ? <Text style={{ color: colors.muted, marginBottom: 12 }}>Property and unit cannot be changed after creation. Existing dates and numbers can be replaced but not cleared here.</Text> : <PropertyUnitPicker propertyId={form.propertyId} unitId={form.unitId} onChange={(propertyId, unitId, property?: Property) => { setForm(previous => ({ ...previous, propertyId, unitId })); setRequiresUnit(multiUnit(property)); setError(''); }} />}
      {loading && <Text style={{ color: colors.muted }}>Loading listing setup…</Text>}
      {groups.map(group => <View key={group.title}>{section(group.title)}{group.fields.filter(key => key !== 'applicationFee' || form.applicationFeeRequired).filter(key => key !== 'incomeVerificationCost' || form.requireIncomeVerification).map(key => (listingBooleans as readonly string[]).includes(key)
        ? <FormSwitch key={key} title={formTitle(key)} value={Boolean(form[key])} onChange={value => change(key, value)} />
        : <FormText key={key} title={formTitle(key)} value={String(form[key])} onChange={value => change(key, value)} number={(listingNumbers as readonly string[]).includes(key)} multiline={key === 'marketingDescription' || key === 'additionalLeaseTermsNotes'} />)}{group.title === 'Applications & screening' && form.requireScreening && <View>{['Essential', 'Premium'].map((label, index) => <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected: String(form.screeningType) === String(index) }} onPress={() => change('screeningType', String(index))} style={{ paddingVertical: 10 }}><Text style={{ color: colors.text }}>{String(form.screeningType) === String(index) ? '◉' : '○'} {label} screening</Text></Pressable>)}</View>}</View>)}
      {section('Amenities & features')}
      {options && listingAmenityKeys.map(key => <View key={key}><Text style={{ color: colors.text, fontWeight: '600', marginTop: 14 }}>{amenityTitles[key]}</Text>{options[key].length ? options[key].map((option: ListingOption) => <Pressable key={option.id} accessibilityRole="checkbox" accessibilityState={{ checked: form[key].includes(option.id) }} onPress={() => toggle(key, option.id)} style={{ paddingVertical: 10 }}><Text style={{ color: colors.text }}>{form[key].includes(option.id) ? '☑' : '☐'} {option.name}</Text></Pressable>) : <Text style={{ color: colors.muted }}>No options available</Text>}</View>)}
      {section('Photos')}
      <Text style={{ color: colors.muted, marginTop: 6 }}>Choose photos to upload when you save. Existing photos are managed immediately.</Text>
      <Pressable accessibilityRole="button" onPress={() => { void pickPhotos(); }} style={{ paddingVertical: 16 }}><Text style={{ color: colors.accent }}>Add photos</Text></Pressable>
      {photos.map(photo => <View key={photo.id} style={{ marginBottom: 12 }}><Image source={{ uri: photo.blobUrl }} style={{ width: 130, height: 95, borderRadius: 8 }} /><Text style={{ color: colors.text }}>{photo.isCoverPhoto ? 'Cover photo' : 'Listing photo'}</Text><View style={{ flexDirection: 'row', gap: 24 }}>{!photo.isCoverPhoto && <Pressable disabled={busy} onPress={() => { void photoAction(() => setListingCover(currentId!, photo.id)); }}><Text style={{ color: colors.accent }}>Make cover</Text></Pressable>}<Pressable disabled={busy} onPress={() => Alert.alert('Remove photo?', 'This photo will be deleted from the listing.', [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void photoAction(() => deleteListingPhoto(photo.id)); } }])}><Text style={{ color: '#b93535' }}>Remove</Text></Pressable></View></View>)}
      {pendingPhotos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={{ marginBottom: 12 }}><Image source={{ uri: photo.uri }} style={{ width: 130, height: 95, borderRadius: 8 }} /><Pressable onPress={() => setPendingPhotos(previous => previous.filter((_, i) => i !== index))}><Text style={{ color: '#b93535' }}>Remove pending photo</Text></Pressable></View>)}
      {!!error && <Text accessibilityRole="alert" style={{ color: '#b93535', marginTop: 14 }}>{error}</Text>}
      <FormAction label={item || savedId ? 'Save listing' : 'Create draft listing'} busy={busy || loading || !options || !!item && !original} onPress={() => { void submit(); }} />
    </ScrollView>
  </View></Modal>;
}
