// Keep categories and destinations consistent across all activity surfaces.
export const ACTIVITY_TYPES = [
  ['LeaseAgreement', 'Lease agreement'], ['Lease', 'Lease'], ['Property', 'Property'],
  ['BankAccount', 'Bank account'], ['TeamMember', 'Team member'], ['Listing', 'Listing'],
  ['Calendar', 'Calendar'], ['Booking', 'Booking'], ['Tenant', 'Tenant'],
  ['Checklist', 'Checklist'], ['Announcement', 'Announcement'], ['Payment', 'Payment'],
  // Legacy categories remain available while older activity sources are supported.
  ['Maintenance', 'Maintenance'], ['Expense', 'Expense'], ['File', 'File'],
  ['Message', 'Message'], ['Application', 'Application'], ['StaffMember', 'Staff member'],
  ['System', 'System'], ['Notification', 'Notification']
].map(([value, label]) => ({ value, label }));

export function getActivityKey(activity, index = 0) {
  return activity.eventKey || JSON.stringify([
    activity.activityType, activity.id ?? activity.relatedId, activity.operation,
    activity.createdAt, activity.conversationId, index
  ]);
}

export function getActivityDestination(activity = {}) {
  const deleted = String(activity.operation || '').toLowerCase() === 'deleted';
  // relatedId is the resource ID; id can instead be an activity-event ID.
  const id = activity.relatedId != null && activity.relatedId !== ''
    ? encodeURIComponent(activity.relatedId) : null;
  const detail = (list, path) => !deleted && id ? path : list;
  switch (activity.activityType) {
    case 'LeaseAgreement': return '/landlord/lease-agreements';
    case 'Lease': return detail('/landlord/leases', `/landlord/leases/${id}`);
    case 'Property': return detail('/landlord/properties', `/landlord/property/${id}`);
    case 'BankAccount': return '/landlord/online-payments';
    case 'TeamMember': return '/landlord/admin-members';
    case 'Listing': return detail('/landlord/listings', `/landlord/listings/${id}`);
    case 'Calendar': return '/landlord/calendar';
    // Bookings have no standalone detail route.
    case 'Booking': return '/landlord/bookings';
    case 'Tenant': return detail('/landlord/leases?tab=tenants', `/landlord/tenants/${id}`);
    case 'Checklist': return detail('/landlord/checklists', `/landlord/checklist/${id}`);
    case 'Announcement': return detail('/landlord/announcements', `/landlord/announcements/details?id=${id}`);
    case 'Payment': return '/landlord/finances?tab=payments';
    case 'Maintenance': return detail('/landlord/maintenances', `/landlord/maintenance/${id}`);
    case 'StaffMember': return detail('/landlord/staff-members', `/landlord/staff-member/${id}`);
    case 'Expense': return '/landlord/finances?tab=expenses';
    case 'File': return '/landlord/files';
    case 'Application': return '/landlord/listings';
    case 'Message': return !deleted && activity.conversationId
      ? `/landlord/messages?conversationId=${encodeURIComponent(activity.conversationId)}` : '/landlord/messages';
    case 'Notification': return '/landlord/notifications';
    default: return null;
  }
}
