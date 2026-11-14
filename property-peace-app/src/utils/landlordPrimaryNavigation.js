// Keep primary destinations separate from the secondary tools in More.
export const landlordPrimaryLinks = [
  { label: 'Home', to: '/landlord/dashboard' },
  { label: 'Tenants', to: '/landlord/tenants' },
  { label: 'Maintenance', to: '/landlord/maintenances' },
  { label: 'Finances', to: '/landlord/finances' },
  { label: 'Documents', to: '/landlord/documents' }
];

export const landlordMoreLinks = [
  { label: 'Calendar', to: '/landlord/calendar' },
  { label: 'Listings', to: '/landlord/listings' },
  { label: 'Bookings', to: '/landlord/bookings' },
  { label: 'Leases', to: '/landlord/leases' },
  { label: 'Reports', to: '/landlord/reports' },
  { label: 'Settings', to: '/landlord/settings' },
  { label: 'Help', to: '/landlord/help' }
];

export function activeLandlordPrimaryLink(pathname = '', search = '') {
  if (pathname === '/landlord' || pathname === '/landlord/dashboard') {
    return new URLSearchParams(search).get('tab') === 'calendar' ? 'More' : 'Home';
  }
  if (pathname === '/landlord/leases' && new URLSearchParams(search).get('tab') === 'tenants') return 'Tenants';
  if (/^\/landlord\/(properties|property|unit)(\/|$)/.test(pathname)) return 'Properties';
  if (/^\/landlord\/(tenants|renter-profile)(\/|$)/.test(pathname)) return 'Tenants';
  if (/^\/landlord\/(maintenances|maintenance)(\/|$)/.test(pathname)) return 'Maintenance';
  if (/^\/landlord\/(finances|accounting|expenses|payments)(\/|$)/.test(pathname)) return 'Finances';
  if (/^\/landlord\/(documents|files)(\/|$)/.test(pathname)) return 'Documents';
  return pathname.startsWith('/landlord/') ? 'More' : null;
}
