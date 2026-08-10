export type MaintenanceSignal =
  | 'ActiveFire' | 'GasOdor' | 'CarbonMonoxideAlarm' | 'ElectricalSparking' | 'UncontrolledFlooding'
  | 'NoHeatInColdWeather' | 'NoRunningWater' | 'SewageBackup' | 'OnlyToiletUnusable' | 'EntryCannotBeSecured';

export const EMERGENCY_SIGNALS: readonly MaintenanceSignal[] = [
  'ActiveFire', 'GasOdor', 'CarbonMonoxideAlarm', 'ElectricalSparking', 'UncontrolledFlooding',
];

export const SIGNAL_OPTIONS: ReadonlyArray<{ value: MaintenanceSignal; label: string; emergency: boolean }> = [
  { value: 'ActiveFire', label: 'Active fire or smoke', emergency: true },
  { value: 'GasOdor', label: 'Gas odor', emergency: true },
  { value: 'CarbonMonoxideAlarm', label: 'Carbon monoxide alarm', emergency: true },
  { value: 'ElectricalSparking', label: 'Electrical sparking or burning', emergency: true },
  { value: 'UncontrolledFlooding', label: 'Uncontrolled flooding', emergency: true },
  { value: 'NoHeatInColdWeather', label: 'No heat in cold weather', emergency: false },
  { value: 'NoRunningWater', label: 'No running water', emergency: false },
  { value: 'SewageBackup', label: 'Sewage backup', emergency: false },
  { value: 'OnlyToiletUnusable', label: 'Only toilet is unusable', emergency: false },
  { value: 'EntryCannotBeSecured', label: 'Entry cannot be secured', emergency: false },
];

export const CATEGORIES = ['Plumbing', 'Heating & cooling', 'Electrical', 'Appliance', 'Locks & security', 'Pests', 'Other'] as const;
export type MaintenanceCategory = typeof CATEGORIES[number];

export const MAINTENANCE_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'] as const;
export const MAINTENANCE_MEDIA_LIMITS = { count: 10, imageBytes: 10 * 1024 * 1024, videoBytes: 100 * 1024 * 1024 } as const;
const MAINTENANCE_MEDIA_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };
export const normalizeMaintenanceMediaFileName = (fileName: string | null | undefined, mimeType: string): string => {
  const extension = MAINTENANCE_MEDIA_EXTENSIONS[mimeType.toLowerCase()];
  const fallback = `maintenance-${Date.now()}`;
  const base = (fileName || fallback).replace(/\.[^./\\]+$/, '') || fallback;
  return extension ? `${base}.${extension}` : (fileName || `${fallback}.bin`);
};
export const validateMaintenanceMedia = (
  media: { mimeType: string; fileSize?: number; type: 'image' | 'video' },
  currentCount: number,
): string | null => {
  if (currentCount >= MAINTENANCE_MEDIA_LIMITS.count) return 'Up to 10 photos or videos may be attached.';
  if (/image\/(heic|heif)/i.test(media.mimeType)) return 'HEIC/HEIF could not be converted. In Photos, share or export a compatible JPEG, PNG, or WebP copy and attach that copy.';
  if (!(MAINTENANCE_MEDIA_MIME_TYPES as readonly string[]).includes(media.mimeType.toLowerCase())) {
    return 'Use JPEG, PNG, WebP, MP4, or QuickTime files.';
  }
  const max = media.type === 'video' ? MAINTENANCE_MEDIA_LIMITS.videoBytes : MAINTENANCE_MEDIA_LIMITS.imageBytes;
  if (media.fileSize !== undefined && media.fileSize > max) return `${media.type === 'video' ? 'Videos' : 'Photos'} must be under ${media.type === 'video' ? '100 MB' : '10 MB'}.`;
  return null;
};

export const SAFE_STEPS = [
  { code: 'check-thermostat-settings', label: 'Check thermostat settings', instruction: 'Confirm the thermostat is on, in the intended mode, and set above or below the room temperature as appropriate.' },
  { code: 'check-gfci-reset', label: 'Check one GFCI reset', instruction: 'Press RESET on an accessible GFCI outlet once. Stop for heat, smoke, sparking, burning smell, or visible damage.' },
  { code: 'check-faucet-aerator', label: 'Look at the faucet aerator', instruction: 'With the faucet off, look for a visible blockage at the spout. Do not use tools or disassemble plumbing.' },
] as const;

export const isEmergency = (signals: readonly MaintenanceSignal[]) => signals.some((signal) => EMERGENCY_SIGNALS.includes(signal));
export const isClosedStatus = (status?: string | number) => ['resolved', 'cancelled', '4', '8'].includes(String(status ?? '').toLowerCase());
export const findPendingCompletion = <T extends { status?: string | number; Status?: string | number }>(
  item?: { completions?: T[]; Completions?: T[] },
): T | undefined => {
  const completions = item?.completions ?? item?.Completions ?? [];
  return completions.find((completion) => ['submitted', '1'].includes(String(completion.status ?? completion.Status).toLowerCase()));
};
export const currentCycleCompletionAttachmentIds = (item: any): number[] => {
  const resolutionCycle = Number(item?.resolutionCycle ?? item?.ResolutionCycle ?? 1);
  const attachments: any[] = item?.attachments ?? item?.Attachments ?? [];
  return attachments
    .filter((attachment) => {
      const purpose = String(attachment?.purpose ?? attachment?.Purpose ?? '').toLowerCase();
      const lifecycle = attachment?.lifecycleState ?? attachment?.LifecycleState;
      const active = lifecycle === undefined || ['active', '2'].includes(String(lifecycle).toLowerCase());
      return active && ['completion', '2'].includes(purpose)
        && Number(attachment?.resolutionCycle ?? attachment?.ResolutionCycle) === resolutionCycle;
    })
    .map((attachment) => Number(attachment?.id ?? attachment?.Id))
    .filter((id) => Number.isFinite(id) && id > 0);
};
export const displayStatus = (status?: string | number) => {
  const values: Record<string, string> = { '0': 'Reported', reported: 'Reported', '1': 'Acknowledged', acknowledged: 'Acknowledged', '2': 'Scheduled', scheduled: 'Scheduled', '3': 'In Progress', inprogress: 'In Progress', '4': 'Resolved', resolved: 'Resolved', '5': 'Awaiting your confirmation', awaitingtenant: 'Awaiting your confirmation', '6': 'Awaiting approval', awaitingapproval: 'Awaiting approval', '7': 'Assigned', assigned: 'Assigned', '8': 'Cancelled', cancelled: 'Cancelled' };
  const raw = String(status ?? 'Reported');
  return values[raw.toLowerCase()] ?? raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
};

export const emergencyGuidance = (signals: readonly MaintenanceSignal[]) => {
  if (!isEmergency(signals)) return null;
  if (signals.includes('ActiveFire') || signals.includes('GasOdor') || signals.includes('CarbonMonoxideAlarm')) {
    return 'Leave the building immediately. Once outside, call 911. Do not use switches, flames, or re-enter the building.';
  }
  if (signals.includes('ElectricalSparking')) return 'Keep away from the affected area. Do not touch electrical panels or wet surfaces. Call 911 if there is fire, smoke, or immediate danger.';
  return 'Move away from the flooding and electrical hazards. Do not enter standing water. Call 911 if anyone is in immediate danger.';
};

export const extractRoles = (user: any): string[] => {
  const active = user?.currentOrganizationRole ?? user?.CurrentOrganizationRole;
  const value = active ? [active] : user?.roles ?? user?.Roles ?? user?.role ?? user?.Role ?? [];
  return (Array.isArray(value) ? value : [value]).map(String).map((role) => role.toLowerCase());
};
export const isTenantUser = (user: any) => extractRoles(user).includes('tenant');
export type MaintenanceAudience = 'tenant' | 'landlord' | 'unsupported';
export const maintenanceAudience = (user: any): MaintenanceAudience => {
  const roles = extractRoles(user);
  if (roles.length !== 1) return 'unsupported';
  if (roles[0] === 'tenant') return 'tenant';
  if (roles[0] === 'landlord' || roles[0] === 'admin' || roles[0] === 'owner' || roles[0] === 'manager') return 'landlord';
  return 'unsupported'; // Vendors need a purpose-built, least-privilege workflow rather than landlord controls.
};
