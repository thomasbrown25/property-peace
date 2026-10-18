import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import ApplicationInviteModal from './ApplicationInviteModal';
import { useAppSelector } from '../../store/hooks';
import { getLandlordApplications, type RentalApplication } from '../../api/landlordApplicationsAPI';
import RentalWorkspace, { dateLabel, field, label, moneyLabel, type WorkspaceConfig } from './RentalWorkspace';

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

export default function ApplicationsScreen() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const user = useAppSelector(state => state.user.currentUser);
  const landlordId = String(user?.id ?? user?.Id ?? '');
  const scope = landlordId ? `${landlordId}:${String(user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? '')}` : '';
  const config = useMemo<WorkspaceConfig<RentalApplication>>(() => ({
    title: 'Applications', eyebrow: 'RENTAL PIPELINE', subtitle: 'Track applications for your properties.', searchPlaceholder: 'Search applicant, property or email',
    headerAction: { label: 'Add application', onPress: scope ? () => setInviteOpen(true) : undefined },
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
  }), [landlordId, scope]);
  return <View style={{ flex: 1 }}><RentalWorkspace config={config} scope={scope} reloadToken={reloadToken} />
    <ApplicationInviteModal key={scope} visible={inviteOpen && !!scope} scope={scope} onClose={() => setInviteOpen(false)} onSent={() => setReloadToken(value => value + 1)} />
  </View>;
}
