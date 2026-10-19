import React, { useMemo, useState } from 'react';
import { View, Pressable, Text, Modal } from 'react-native';
import ApplicationFormModal from './ApplicationFormModal';
import { useAppTheme } from '../../theme/AppTheme';
import ApplicationInviteModal from './ApplicationInviteModal';
import { useAppSelector } from '../../store/hooks';
import { getApplication, getLandlordApplications, type RentalApplication } from '../../api/landlordApplicationsAPI';
import RentalWorkspace, { RentalWorkspaceDetail, dateLabel, field, label, moneyLabel, type WorkspaceConfig } from './RentalWorkspace';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApplicationsStackParamList } from '../../navigation/types';

const statuses = ['Draft', 'Submitted', 'Under review', 'Approved', 'Rejected', 'Withdrawn', 'On hold', 'Lease signed', 'Pending'];
const status = (item: RentalApplication): string => {
  const raw = field(item, 'status');
  if (typeof raw === 'number' || /^\d+$/.test(String(raw))) return statuses[Number(raw)] ?? 'Unknown';
  const name = label(item, 'statusName') || String(raw ?? 'Unknown');
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return statuses.find(value => value.toLowerCase() === spaced.toLowerCase()) ?? spaced;
};
const titleFor = (item: RentalApplication): string => [label(item, 'firstName'), label(item, 'lastName')].filter(Boolean).join(' ') || 'Applicant';
const property = (item: RentalApplication): string => [label(item, 'propertyName'), label(item, 'unitName')].filter(Boolean).join(' · ') || 'Property unavailable';

const applicationConfig = (landlordId: string, scope: string, openInvite?: () => void): WorkspaceConfig<RentalApplication> => ({
    title: 'Applications', eyebrow: 'RENTAL PIPELINE', subtitle: 'Track applications for your properties.', searchPlaceholder: 'Search applicant, property or email',
    headerAction: { label: 'Add application', onPress: scope ? openInvite : undefined },
    filters: ['All', 'Submitted', 'Under review', 'Approved', 'Rejected', 'Draft', 'Pending', 'On hold', 'Withdrawn', 'Lease signed'],
    load: () => getLandlordApplications(landlordId), status, titleFor,
    subtitleFor: property,
    metaFor: item => `${dateLabel(field(item, 'submittedAt') || field(item, 'createdAt'))} · ${label(item, 'email') || 'Email unavailable'}`,
    searchFor: item => [titleFor(item), property(item), label(item, 'email')].join(' '),
    details: item => [
      ['Status', status(item)], ['Property', property(item)], ['Email', label(item, 'email')], ['Phone', label(item, 'phoneNumber')],
      ['Submitted', field(item, 'submittedAt') ? dateLabel(field(item, 'submittedAt')) : 'Not submitted'],
      ['Desired move-in', field(item, 'desiredMoveInDate') ? dateLabel(field(item, 'desiredMoveInDate')) : 'Not specified'],
      ['Occupants', field(item, 'numberOfOccupants') == null ? '' : String(field(item, 'numberOfOccupants'))],
      ['Monthly income', field(item, 'monthlyIncome') == null ? '' : moneyLabel(field(item, 'monthlyIncome'))],
      ['Notes', label(item, 'additionalNotes')],
    ],
  });

export default function ApplicationsScreen() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
  const { colors } = useAppTheme();
  const [reloadToken, setReloadToken] = useState(0);
  const user = useAppSelector(state => state.user.currentUser);
  const landlordId = String(user?.id ?? user?.Id ?? '');
  const scope = landlordId ? `${landlordId}:${String(user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? '')}` : '';
  const config = useMemo(() => applicationConfig(landlordId, scope, () => setChooseOpen(true)), [landlordId, scope]);
  return <View style={{ flex: 1 }}><RentalWorkspace config={config} scope={scope} reloadToken={reloadToken} detailRoute="ApplicationDetail" />
    <Modal visible={chooseOpen && !!scope} transparent animationType="fade" onRequestClose={() => setChooseOpen(false)}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}><View style={{ backgroundColor: colors.background, padding: 24, borderRadius: 16 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 16 }}>Add application</Text>
      <Pressable accessibilityRole="button" onPress={() => { setChooseOpen(false); setFormOpen(true); }} style={{ padding: 14 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Enter application myself</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setChooseOpen(false); setInviteOpen(true); }} style={{ padding: 14 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Invite applicant by email</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setChooseOpen(false)} style={{ padding: 14 }}><Text style={{ color: colors.text }}>Cancel</Text></Pressable>
    </View></View></Modal>
    <ApplicationFormModal key={scope} visible={formOpen && !!scope} scope={scope} onClose={() => setFormOpen(false)} onSaved={() => setReloadToken(value => value + 1)} />
    <ApplicationInviteModal key={`invite:${scope}`} visible={inviteOpen && !!scope} scope={scope} onClose={() => setInviteOpen(false)} onSent={() => setReloadToken(value => value + 1)} />
  </View>;
}

export function ApplicationDetailScreen({ route }: NativeStackScreenProps<ApplicationsStackParamList, 'ApplicationDetail'>) {
  const [edit, setEdit] = useState(false);
  const [current, setCurrent] = useState(route.params.item);
  return <View style={{ flex: 1 }}><RentalWorkspaceDetail config={applicationConfig('', '')} item={current} scope={route.params.scope} action={{ label: 'Edit application', onPress: () => setEdit(true) }} />
    <ApplicationFormModal visible={edit} scope={route.params.scope} item={current} onClose={() => setEdit(false)} onSaved={() => { void getApplication(current.id).then(setCurrent); }} />
  </View>;
}
