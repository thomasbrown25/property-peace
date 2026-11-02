// The visible owner navigation points to existing landlord destinations.
// Calendar's legacy route redirects into the calendar workspace; keep that
// deep link and its active state until calendar routing is separated.
export const landlordPrimaryLinks = [
  { label: 'Dashboard', to: '/landlord/dashboard' },
  { label: 'Calendar', to: '/landlord/calendar' },
  { label: 'Listings', to: '/landlord/listings' },
  { label: 'Bookings', to: '/landlord/bookings' }
];

export function activeLandlordPrimaryLink(pathname = '', search = '') {
  if (pathname === '/landlord/calendar' || pathname.startsWith('/landlord/calendar/')) return 'Calendar';
  if (pathname === '/landlord/dashboard') {
    const tab = new URLSearchParams(search).get('tab');
    if (tab === 'calendar') return 'Calendar';
    return tab === 'tasks' ? null : 'Dashboard';
  }
  if (pathname === '/landlord/listings' || pathname.startsWith('/landlord/listings/')) return 'Listings';
  if (pathname === '/landlord/bookings' || pathname.startsWith('/landlord/bookings/')) return 'Bookings';
  return null;
}
