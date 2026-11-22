import { filterControlSx } from '../themes/filterControlStyles.js';

export const maintenanceFilterGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
    xl: 'minmax(0, 1.9fr) repeat(5, minmax(0, 1fr))'
  },
  gap: 1,
  alignItems: 'center',
  '& > :last-child': { gridColumn: { xs: '1 / -1', sm: 'auto' } }
};

export const maintenanceFilterControlSx = {
  ...filterControlSx,
  minWidth: 0,
  width: '100%'
};

export const maintenanceSearchControlSx = {
  ...maintenanceFilterControlSx,
  gridColumn: { xs: '1 / -1', sm: 'auto', lg: '1 / -1', xl: 'auto' }
};

export const maintenanceRequestColumns = 'minmax(0, 1.55fr) minmax(0, 1.1fr) minmax(0, .95fr) minmax(0, .85fr) 44px';
