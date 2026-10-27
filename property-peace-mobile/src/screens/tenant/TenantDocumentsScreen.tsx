import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useAppTheme } from '../../theme/AppTheme';
import { useAppSelector } from '../../store/hooks';
import { documentMime, getMyTenantDocuments, uploadMyTenantDocuments, type TenantDocument } from '../../api/tenantDocumentsAPI';

export default function TenantDocumentsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(state => state.user.currentUser);
  const scope = `${user?.id ?? user?.Id ?? ''}:${user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? ''}`;
  const [result, setResult] = useState<{ scope: string; documents: TenantDocument[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setResult(null); setLoading(true); setError(false);
    getMyTenantDocuments().then(documents => { if (active) setResult({ scope, documents }); })
      .catch(() => { if (active) { setResult(null); setError(true); } })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [scope, revision]));

  const refresh = () => { setRefreshing(true); setRevision(value => value + 1); };
  const upload = async () => {
    if (uploading) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets.length) return;
      setUploading(true);
      await uploadMyTenantDocuments(picked.assets.map(file => ({
        uri: file.uri, name: file.name, mimeType: documentMime(file.name, file.mimeType),
      })));
      Alert.alert('Uploaded', 'Your documents have been added.');
      setRevision(value => value + 1);
    } catch (uploadError: any) {
      Alert.alert('Upload failed', uploadError?.message || 'Please check the file type and size, then try again.');
    } finally {
      setUploading(false);
    }
  };
  const documents = result?.scope === scope ? result.documents : [];
  const openDocument = async (document: TenantDocument) => {
    // SAS URLs are short lived; refresh on focus and never persist them in storage.
    if (!/^https:\/\//i.test(document.blobUrl)) {
      Alert.alert('Document unavailable', 'Pull down to refresh and try again.');
      return;
    }
    try { await Linking.openURL(document.blobUrl); }
    catch { Alert.alert('Couldn’t open document', 'Please try again later.'); }
  };

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <LandlordPageHeader title="Documents" />
    <FlatList data={documents} keyExtractor={item => `${item.id}:${item.leaseId ?? ''}`}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListHeaderComponent={<View>
        <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">Your documents</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>Your lease and documents you’ve uploaded or received.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Upload documents" disabled={uploading}
          onPress={() => void upload()} style={[styles.upload, { backgroundColor: colors.accent, opacity: uploading ? 0.6 : 1 }]}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={20} color="#fff" />}
          <Text style={styles.uploadLabel}>{uploading ? 'Uploading…' : 'Upload files'}</Text>
        </TouchableOpacity>
        {loading && <ActivityIndicator style={styles.state} color={colors.accent} />}
        {error && !loading && <View style={styles.state} accessibilityRole="alert">
          <Text style={{ color: colors.text }}>Couldn’t load documents.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Try again</Text></TouchableOpacity>
        </View>}
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />}
      renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${item.fileName}`} onPress={() => void openDocument(item)} style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.surface }]}><Ionicons name="document-outline" size={24} color={colors.accent} /></View>
        <View style={styles.copy}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{item.fileName || 'Document'}</Text>
          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={2}>{[item.documentTypeName || (item.id === 0 ? 'Lease agreement' : null), item.leaseInfo].filter(Boolean).join(' · ') || 'Document'}</Text>
        </View>
        <Ionicons name="open-outline" size={20} color={colors.muted} />
      </TouchableOpacity>}
      ListEmptyComponent={!loading && !error ? <View style={styles.state}>
        <Ionicons name="folder-open-outline" size={32} color={colors.accent} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No documents yet</Text>
        <Text style={[styles.caption, { color: colors.muted, textAlign: 'center' }]}>Your lease and uploaded documents will appear here.</Text>
      </View> : null}
    />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 20 },
  heading: { fontSize: 28, fontWeight: '800' }, caption: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  upload: { minHeight: 48, borderRadius: 12, marginTop: 22, marginBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  uploadLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  state: { alignItems: 'center', paddingVertical: 44, gap: 8 }, emptyTitle: { fontSize: 18, fontWeight: '700' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84, paddingVertical: 14 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 }, name: { fontSize: 16, fontWeight: '700' }, meta: { fontSize: 13, marginTop: 4 },
});
