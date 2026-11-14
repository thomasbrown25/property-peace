// Portal brand colors. Status colors (success, warning, error, info) are
// intentionally separate: mint is a decorative accent, not a success state.
export const brand = Object.freeze({
  forest: '#102C29',
  teal: '#247568',
  mint: '#B9E4CB',
  ivory: '#F8F7F1',
  slate: '#24343A'
});

export const portalSurfaces = Object.freeze({
  light: { app: brand.ivory, paper: '#FFFFFF', raised: '#FFFFFF', nested: '#F1F5F0' },
  dark: { app: '#101F1E', paper: '#1A302D', raised: '#24403B', nested: brand.forest }
});
