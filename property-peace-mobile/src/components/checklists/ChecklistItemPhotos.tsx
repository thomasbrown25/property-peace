import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ChecklistAPI from '../../api/checklistAPI';
import { toChecklistUploadAsset } from '../../features/checklists/checklistModel';
import { getChecklistItemPhotos } from '../../features/checklists/checklistPhotoModel';
import type {
  Checklist,
  ChecklistItem,
  ChecklistUploadAsset,
  Id,
  ImagePickerAssetLike,
} from '../../features/checklists/checklistTypes';

type Props = {
  checklistId: Id;
  item: ChecklistItem;
  disabled: boolean;
  failedAsset: ChecklistUploadAsset | null;
  onFailedAssetChange: (asset: ChecklistUploadAsset | null) => void;
  onBusyChange: (busy: boolean) => boolean;
  onChecklistUpdated: (checklist: Checklist) => void;
};

const message = (error: any, fallback: string) => error?.message || error?.Message || fallback;

export default function ChecklistItemPhotos({ checklistId, item, disabled, failedAsset, onFailedAssetChange, onBusyChange, onChecklistUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');
  const [error, setError] = useState('');
  const photos = useMemo(() => getChecklistItemPhotos(item), [item]);
  const itemId = item.id;

  const upload = async (asset: ChecklistUploadAsset) => {
    if (itemId == null || disabled || !onBusyChange(true)) return;
    setUploading(true);
    setError('');
    try {
      const saved = await ChecklistAPI.uploadItemImage(checklistId, itemId, asset);
      onFailedAssetChange(null);
      onChecklistUpdated(saved);
    } catch (uploadError) {
      onFailedAssetChange(asset);
      setError(message(uploadError, 'Photo upload failed.'));
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  };

  const usePickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const picked = result.assets[0] as ImagePickerAssetLike;
    void upload(toChecklistUploadAsset(picked));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph this room.');
      return;
    }
    usePickerResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }));
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access in Settings to attach a room photo.');
      return;
    }
    usePickerResult(await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    }));
  };

  const chooseSource = () => {
    if (itemId == null || uploading || disabled) return;
    Alert.alert('Add room photo', 'Choose where the photo comes from.', [
      { text: 'Camera', onPress: () => void takePhoto() },
      { text: 'Photo library', onPress: () => void choosePhoto() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (blobName: string, key: string) => {
    if (itemId == null || disabled) return;
    Alert.alert('Delete photo?', 'This removes the photo from this checklist item.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!onBusyChange(true)) return;
          setDeletingKey(key);
          setError('');
          try {
            onChecklistUpdated(await ChecklistAPI.deleteItemImage(checklistId, itemId, blobName));
          } catch (deleteError) {
            setError(message(deleteError, 'Photo could not be deleted.'));
          } finally {
            setDeletingKey('');
            onBusyChange(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Photos</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add room photo"
          style={[styles.addButton, (itemId == null || uploading || disabled) && styles.disabled]}
          onPress={chooseSource}
          disabled={itemId == null || uploading || disabled}
        >
          {uploading ? <ActivityIndicator size="small" color="#0b5d55" /> : <Ionicons name="camera-outline" size={18} color="#0b5d55" />}
          <Text style={styles.addText}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
          {photos.map((photo) => (
            <View key={photo.key} style={styles.photoWrap}>
              <Image source={{ uri: photo.url }} style={styles.photo} accessibilityLabel={`${item.name} inspection photo`} />
              {photo.blobName && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
                  style={styles.deleteButton}
                  onPress={() => removePhoto(photo.blobName!, photo.key)}
                  disabled={disabled || deletingKey === photo.key}
                >
                  {deletingKey === photo.key
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="close" size={16} color="#fff" />}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {!!failedAsset && !uploading && (
        <TouchableOpacity style={styles.retryButton} onPress={() => void upload(failedAsset)} disabled={disabled}>
          <Ionicons name="refresh" size={16} color="#9a3412" />
          <Text style={styles.retryText}>Upload failed · Retry {failedAsset.name}</Text>
        </TouchableOpacity>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {itemId == null && <Text style={styles.hint}>Save this item before adding photos.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: '#52687a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#e4f2ee' },
  addText: { color: '#0b5d55', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  photoStrip: { gap: 10, paddingVertical: 2 },
  photoWrap: { position: 'relative' },
  photo: { width: 108, height: 82, borderRadius: 10, backgroundColor: '#e4e9ed' },
  deleteButton: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25, 38, 48, 0.82)' },
  retryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  retryText: { color: '#9a3412', fontSize: 12, fontWeight: '800' },
  error: { color: '#b42318', fontSize: 12 },
  hint: { color: '#738494', fontSize: 12 },
});
