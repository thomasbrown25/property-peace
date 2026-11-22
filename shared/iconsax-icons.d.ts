export type IconsaxIconName =
  | 'activity'
  | 'add'
  | 'arrowRight'
  | 'calendar'
  | 'chatBubbles'
  | 'check'
  | 'checkCircle'
  | 'checklists'
  | 'chevronDown'
  | 'clock'
  | 'close'
  | 'document'
  | 'dollarCircle'
  | 'downloadDocument'
  | 'edit'
  | 'filter'
  | 'flash'
  | 'help'
  | 'home'
  | 'house'
  | 'insurance'
  | 'leaseAdd'
  | 'leases'
  | 'magnifier'
  | 'mail'
  | 'maintenance'
  | 'menu'
  | 'messages'
  | 'moneys'
  | 'more'
  | 'notification'
  | 'payments'
  | 'phone'
  | 'playCircle'
  | 'properties'
  | 'reopen'
  | 'reports'
  | 'search'
  | 'send'
  | 'settings'
  | 'shop'
  | 'sort'
  | 'stopCircle'
  | 'support'
  | 'tag'
  | 'team'
  | 'trash'
  | 'uploadDocument'
  | 'user'
  | 'wallet'
  | 'warning';

export type IconsaxIconVariant = 'linear' | 'bold' | 'bulk';

type IconsaxPath = {
  d: string;
  fill?: 'none' | 'currentColor';
  stroke?: 'none' | 'currentColor';
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  strokeMiterlimit?: number;
  opacity?: number;
  fillRule?: 'nonzero' | 'evenodd';
  clipRule?: 'nonzero' | 'evenodd';
};

type IconsaxDrawing = { viewBox: string; paths: readonly IconsaxPath[] };

export const iconsaxIcons: Record<IconsaxIconName, { linear: IconsaxDrawing; bold?: IconsaxDrawing; bulk?: IconsaxDrawing }>;
