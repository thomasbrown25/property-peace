import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import ListingFormModal from './ListingFormModal';
import { useAppSelector } from '../../store/hooks';
import { getListing, getListings, type Listing } from '../../api/listingAPI';
import RentalWorkspace, { RentalWorkspaceDetail, dateLabel, field, label, moneyLabel, type WorkspaceConfig } from './RentalWorkspace';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ListingsStackParamList } from '../../navigation/types';

const status = (item: Listing): string => {
  const raw = field(item, 'status');
  return ({ 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' } as Record<number, string>)[Number(raw)] ?? (typeof raw === 'string' ? raw : 'Unknown');
};
const titleFor = (item: Listing): string => label(item, 'propertyName') || 'Unnamed property';
const location = (item: Listing): string => [label(item, 'propertyAddress'), label(item, 'unitName')].filter(Boolean).join(' · ') || 'Location unavailable';
const config = (onCreate?: () => void): WorkspaceConfig<Listing> => ({
  title: 'Listings', eyebrow: 'RENTAL MARKETING', subtitle: 'Your property listings in one place.', searchPlaceholder: 'Search property, address or listing number',
  overview: { heading: 'LISTINGS OVERVIEW', metricLabel: 'Active listings', count: items => items.filter(item => status(item) === 'Active').length },
  headerAction: { label: 'New listing', onPress: onCreate },
  filters: ['All', 'Active', 'Draft', 'Expired', 'Unlisted'], load: getListings, status, titleFor,
  subtitleFor: location,
  metaFor: item => `${moneyLabel(field(item, 'monthlyRent'))} / month · #${label(item, 'listingNumber') || label(item, 'id')}`,
  searchFor: item => [titleFor(item), location(item), label(item, 'listingNumber')].join(' '),
  details: item => [
    ['Status', status(item)], ['Listing number', label(item, 'listingNumber')], ['Address', location(item)],
    ['Monthly rent', moneyLabel(field(item, 'monthlyRent'))], ['Available', dateLabel(field(item, 'dateAvailable'))],
    ['Published', field(item, 'publishedAt') ? dateLabel(field(item, 'publishedAt')) : 'Not published'],
    ['Description', label(item, 'marketingDescription')],
  ],
});

export default function ListingsScreen() {
  const [open, setOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const user = useAppSelector(state => state.user.currentUser);
  const userId = String(user?.id ?? user?.Id ?? '');
  const scope = userId ? `${userId}:${String(user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? '')}` : '';
  const workspaceConfig = useMemo(() => config(scope ? () => setOpen(true) : undefined), [scope]);
  return <View style={{ flex: 1 }}><RentalWorkspace config={workspaceConfig} scope={scope} reloadToken={reloadToken} detailRoute="ListingDetail" />
    <ListingFormModal key={scope} visible={open && !!scope} scope={scope} onClose={() => setOpen(false)} onSaved={() => setReloadToken(value => value + 1)} />
  </View>;
}

export function ListingDetailScreen({ route }: NativeStackScreenProps<ListingsStackParamList, 'ListingDetail'>) {
  const [edit, setEdit] = useState(false);
  const [current, setCurrent] = useState(route.params.item);
  return <View style={{ flex: 1 }}><RentalWorkspaceDetail config={config()} item={current} scope={route.params.scope} action={{ label: 'Edit listing', onPress: () => setEdit(true) }} />
    <ListingFormModal visible={edit} scope={route.params.scope} item={current} onClose={() => setEdit(false)} onSaved={() => { void getListing(current.id).then(setCurrent).catch(() => {}); }} />
  </View>;
}
