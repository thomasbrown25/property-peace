import React from 'react';
import { Alert, Linking } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { getListings, type Listing } from '../../api/listingAPI';
import RentalWorkspace, { dateLabel, field, label, moneyLabel, type WorkspaceConfig } from './RentalWorkspace';

const status = (item: Listing): string => {
  const raw = field(item, 'status');
  return ({ 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' } as Record<number, string>)[Number(raw)] ?? (typeof raw === 'string' ? raw : 'Unknown');
};
const titleFor = (item: Listing): string => label(item, 'propertyName') || 'Unnamed property';
const location = (item: Listing): string => [label(item, 'propertyAddress'), label(item, 'unitName')].filter(Boolean).join(' · ') || 'Location unavailable';
// Only use the production web app for production API builds; previews need an explicit matching URL.
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '')
  || (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') === 'https://api.propertypeace.io'
    ? 'https://app.propertypeace.io' : undefined);
const config: WorkspaceConfig<Listing> = {
  title: 'Listings', eyebrow: 'RENTAL MARKETING', subtitle: 'Your property listings in one place.', searchPlaceholder: 'Search property, address or listing number',
  headerAction: {
    label: 'Add listing',
    hint: webAppUrl ? 'Opens the listing creation flow in the web app; you may need to sign in there' : 'Web app link not configured for this build',
    onPress: webAppUrl ? () => {
      void Linking.openURL(`${webAppUrl}/landlord/listings/add`).catch(() => Alert.alert('Could not open web app', 'Please try again later.'));
    } : undefined,
  },
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
};

export default function ListingsScreen() {
  const user = useAppSelector(state => state.user.currentUser);
  const userId = String(user?.id ?? user?.Id ?? '');
  const scope = userId ? `${userId}:${String(user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? '')}` : '';
  return <RentalWorkspace config={config} scope={scope} />;
}
