export function getFocusedAuthShellPresentation(mode) {
  return {
    logoVariant: mode === 'dark' ? 'dark' : 'lightHeader',
    showDecorativeBackground: false,
    contentMaxWidth: 560
  };
}
