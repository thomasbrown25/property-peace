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

// Creation actions use the semantic primary palette in both light and dark themes.
export const creationActionSx = {
  ...managementPageHeaderActionSx,
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  '&:hover': { bgcolor: 'primary.dark', color: 'primary.contrastText' }
};
