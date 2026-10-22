// The visible owner navigation points to existing landlord destinations.
// Calendar's legacy route redirects into the calendar workspace; keep that
// deep link and its active state until calendar routing is separated.
export const landlordPrimaryLinks = [
  { label: 'Today', to: '/landlord/dashboard' },
  { label: 'Calendar', to: '/landlord/calendar' },
  { label: 'Listings', to: '/landlord/listings' },
  { label: 'Properties', to: '/landlord/properties' }
];

export function activeLandlordPrimaryLink(pathname = '', search = '') {
  if (pathname === '/landlord/calendar' || pathname.startsWith('/landlord/calendar/')) return 'Calendar';
  if (pathname === '/landlord/dashboard') {
    const tab = new URLSearchParams(search).get('tab');
    if (tab === 'calendar') return 'Calendar';
    return tab === 'tasks' ? null : 'Today';
  }
  if (pathname === '/landlord/listings' || pathname.startsWith('/landlord/listings/')) return 'Listings';
  if (pathname === '/landlord/properties' || pathname.startsWith('/landlord/properties/')) return 'Properties';
  return null;
}
