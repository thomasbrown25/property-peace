export const managementPageHeaderContainerSx = {
  mb: 2.5,
  background: 'transparent',
  boxShadow: 'none'
};

export const managementPageHeaderTitleSx = {
  color: 'text.primary',
  fontWeight: 700,
  lineHeight: 1.15
};

export const managementPageHeaderDescriptionSx = {
  mt: 0.5,
  color: 'text.secondary'
};

export const managementPageHeaderActionSx = {
  textTransform: 'none',
  fontWeight: 700,
  boxShadow: 'none'
};

// Keep create/add actions in the brand navy regardless of the active theme.
export const creationActionSx = {
  ...managementPageHeaderActionSx,
  bgcolor: '#061e35',
  color: '#fff',
  '&:hover': { bgcolor: '#0b2f4f', color: '#fff' }
};
