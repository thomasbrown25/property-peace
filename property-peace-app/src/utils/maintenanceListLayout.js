export const maintenanceFilterGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    md: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(4, minmax(0, 1fr))'
  },
  gap: 1.1,
  alignItems: 'center'
};

export const maintenanceFilterControlSx = {
  width: '100%',
  minWidth: 0
};

export const maintenanceFilterSummarySx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: { xs: 'flex-start', lg: 'flex-end' },
  gap: 0.75,
  minWidth: 0,
  flexWrap: 'wrap'
};
